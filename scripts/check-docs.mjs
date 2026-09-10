#!/usr/bin/env node

import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docsDirectory = path.join(repositoryRoot, 'docs');
const apiDirectory = path.join(docsDirectory, 'api');
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

// Serve only docs, using an ephemeral loopback port for browser checks.
async function startServer() {
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const filename = path.resolve(docsDirectory, `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`);
      if (!filename.startsWith(`${docsDirectory}${path.sep}`)) {
        response.writeHead(403).end();
        return;
      }
      const body = await readFile(filename);
      response.writeHead(200, { 'Content-Type': contentTypes[path.extname(filename)] || 'application/octet-stream' });
      response.end(body);
    } catch (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500).end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server;
}

// Parse generated HTML with the browser's HTML parser. Check template-generated
// links and assets; pre-existing links in handwritten API descriptions are separate.
async function checkGeneratedLinks(page, origin) {
  const filenames = (await readdir(apiDirectory)).filter((filename) => filename.endsWith('.html')).sort();
  const pages = new Map();
  for (const filename of filenames) {
    const html = await readFile(path.join(apiDirectory, filename), 'utf8');
    const result = await page.evaluate((text) => {
      const document = new DOMParser().parseFromString(text, 'text/html');
      const ids = Array.from(document.querySelectorAll('[id], a[name]'), (element) => element.id || element.getAttribute('name'));
      const source = document.querySelector('pre.source code');
      // highlight.js assigns these anchors after syntax highlighting in the browser.
      if (source) {
        source.textContent.split('\n').forEach((_, index) => ids.push(`line${index + 1}`));
      }
      const selectors = [
        'script[src]', 'link[href]', 'img[src]', '.navigation a[href]',
        '.navbar a[href]', '.quick-links a[href]', '.details a[href]',
        '.tag-source a[href]', '.nameContainer .inherited a[href]'
      ];
      const references = Array.from(document.querySelectorAll(selectors.join(', ')), (element) => ({
        value: element.getAttribute('href') || element.getAttribute('src'),
        anchor: element.tagName === 'A'
      }));
      return { ids, references };
    }, html);
    pages.set(`/api/${filename}`, { ids: new Set(result.ids), references: result.references });
  }

  for (const filename of ['index.html', 'Viewer.html', 'Feature.html', 'Plot.html']) {
    assert(pages.has(`/api/${filename}`), `Missing API page: ${filename}`);
  }

  const assets = new Map();
  const errors = new Set();
  let linkCount = 0;
  for (const [pathname, entry] of pages) {
    for (const reference of entry.references) {
      const url = new URL(reference.value, `${origin}${pathname}`);
      if (url.origin !== origin) continue;
      const target = decodeURIComponent(url.pathname).replace(/\/$/, '/index.html');
      if (!assets.has(target)) {
        const filename = path.resolve(docsDirectory, `.${target}`);
        const withinDocs = filename.startsWith(`${docsDirectory}${path.sep}`);
        assets.set(target, withinDocs && await access(filename).then(() => true, () => false));
      }
      if (!assets.get(target)) {
        errors.add(`${pathname}: missing ${reference.value}`);
      } else if (reference.anchor && url.hash && pages.has(target)) {
        const id = decodeURIComponent(url.hash.slice(1));
        if (!pages.get(target).ids.has(id)) errors.add(`${pathname}: missing anchor ${reference.value}`);
      }
      linkCount++;
    }
  }
  assert.equal(errors.size, 0, `Generated documentation links failed:\n${[...errors].slice(0, 30).join('\n')}`);
  console.log(`Checked ${filenames.length} API pages and ${linkCount} generated links/assets.`);
}

async function checkBrowser(context, origin) {
  const page = await context.newPage();
  for (const filename of ['index.html', 'Viewer.html', 'Feature.html', 'Plot.html']) {
    await page.goto(`${origin}/api/${filename}`);
    await page.locator('.main').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.page-title').getAttribute('data-filename'), filename);
    assert(await page.locator('.navigation .item').count() > 0, `Empty navigation on ${filename}`);
  }

  await page.goto(`${origin}/api/Viewer.html`);
  const search = page.getByRole('searchbox', { name: 'Search API' });
  const items = page.locator('.navigation .item');
  const itemCount = await items.count();
  const viewer = items.filter({ has: page.locator('.title a[href="Viewer.html"]') });
  const members = viewer.locator('.itemMembers li[data-name]');
  const memberCount = await members.count();
  assert.equal(await members.filter({ visible: true }).count(), memberCount);

  // fill dispatches an input event, covering paste and the native search clear button.
  await search.fill('zoomFactor');
  assert(await items.filter({ visible: true }).count() < itemCount);
  assert(await members.filter({ visible: true }).count() < memberCount);
  for (const punctuation of ['[', '.*', '(', '\\']) {
    await search.fill(punctuation);
    assert.equal(await items.filter({ visible: true }).count(), 0, 'Search interpreted punctuation as a pattern.');
  }
  await search.fill('');
  assert.equal(await items.filter({ visible: true }).count(), itemCount);
  assert.equal(await members.filter({ visible: true }).count(), memberCount, 'Clearing search left members hidden.');
  assert.equal(await page.locator('.itemMembers li[hidden]').count(), 0);
  await search.fill('viewer');
  const lowercaseMatches = await items.filter({ visible: true }).evaluateAll((elements) => elements.map((element) => element.dataset.name));
  await search.fill('');
  await search.pressSequentially('vIeWeR');
  const mixedCaseMatches = await items.filter({ visible: true }).evaluateAll((elements) => elements.map((element) => element.dataset.name));
  assert.deepEqual(mixedCaseMatches, lowercaseMatches, 'Search must ignore case.');
  assert(mixedCaseMatches.includes('Viewer'));
  await search.fill('');

  const toggle = viewer.getByRole('button', { name: 'Toggle Viewer members' });
  await toggle.focus();
  await toggle.press('Enter');
  await viewer.locator('.itemMembers').waitFor({ state: 'hidden' });
  await search.fill('Viewer');
  await viewer.locator('.itemMembers').waitFor({ state: 'visible' });
  await search.fill('');
  await viewer.locator('.itemMembers').waitFor({ state: 'hidden' });
  await toggle.focus();
  await toggle.press('Space');
  await viewer.locator('.itemMembers').waitFor({ state: 'visible' });
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true');

  const sourceLink = await page.locator('.tag-source a[href*=".js.html#line"]').first().getAttribute('href');
  assert(sourceLink, 'Viewer source link is missing.');
  const sourceUrl = new URL(sourceLink, page.url());
  await page.goto(sourceUrl.href);
  assert(await page.evaluate((id) => Boolean(document.getElementById(id)), sourceUrl.hash.slice(1)), 'Source line anchor was not created.');
  const sourceText = await readFile(path.join(repositoryRoot, 'src/Viewer.js'), 'utf8');
  assert.equal(await page.locator('pre.source code').textContent(), sourceText.replace(/^[\t ]+$/gm, ''), 'Highlighting changed source text.');
  assert.equal(await page.locator('pre.source [id^="line"]').count(), sourceText.split('\n').length);
  assert(await page.locator('pre.source .token').count() > 0, 'Source syntax highlighting is missing.');
  const targetTop = await page.locator(sourceUrl.hash).evaluate((element) => element.getBoundingClientRect().top);
  assert(targetTop >= 50 && targetTop < 150, 'Source link did not scroll below the fixed navigation.');

  await page.goto(`${origin}/api/Viewer.html`);
  // The top menu and sidebar share one breakpoint, with no intermediate collapse.
  for (const width of [768, 767, 640, 576]) {
    await page.setViewportSize({ width, height: 844 });
    await page.locator('#sidebar-nav').waitFor({ state: 'visible' });
    await page.locator('#navbarNavDropdown').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.navbar-toggler:visible, .sidebar-toggle:visible').count(), 0);
    const navbar = await page.locator('.navbar').evaluate((element) => ({
      height: element.getBoundingClientRect().height,
      right: document.querySelector('#docs-theme').getBoundingClientRect().right
    }));
    assert(navbar.height <= 56 && navbar.right <= width, `Navbar wraps or overflows at ${width}px.`);
  }
  await page.setViewportSize({ width: 575, height: 844 });
  await page.locator('#navbarNavDropdown').waitFor({ state: 'hidden' });
  await page.locator('#sidebar-nav').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('.navbar-toggler:visible, .sidebar-toggle:visible').count(), 2);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#sidebar-nav').waitFor({ state: 'hidden' });
  await page.locator('.sidebar-toggle').focus();
  await page.locator('.sidebar-toggle').press('Enter');
  await page.locator('#sidebar-nav.show').waitFor({ state: 'visible' });
  await page.locator('.sidebar-toggle').click();
  await page.locator('#sidebar-nav').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Toggle navigation', exact: true }).click();
  await page.locator('#navbarNavDropdown.show').waitFor({ state: 'visible' });
  await chooseTheme(page, 'dark');
  await checkTheme(page, 'dark');
  await page.getByRole('button', { name: 'Toggle navigation', exact: true }).click();
  await page.locator('#navbarNavDropdown').waitFor({ state: 'hidden' });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'API overflows the mobile viewport.');
  await page.close();
  console.log('API browser checks passed: literal search, clearing, keyboard controls, highlighted source anchors, and mobile navigation.');
}

async function checkSharedAssets(page, origin) {
  const filenames = (await readdir(docsDirectory, { recursive: true }))
    .filter((filename) => filename.endsWith('.html') && !filename.startsWith(`api${path.sep}`));
  let pageCount = 0;
  const missingAssets = [];
  for (const filename of filenames) {
    const html = await readFile(path.join(docsDirectory, filename), 'utf8');
    if (!html.includes('styles/general.css')) continue;
    pageCount++;
    const result = await page.evaluate((html) => {
      const document = new DOMParser().parseFromString(html, 'text/html');
      return {
        assets: Array.from(document.querySelectorAll('script[src], link[href]'), (element) => element.getAttribute('src') || element.getAttribute('href')),
        head: Array.from(document.head.children, (element) => element.getAttribute('src') || element.getAttribute('href')),
        markdown: Boolean(document.querySelector('#markdown-in'))
      };
    }, html);
    const themeIndex = result.head.findIndex((url) => url?.endsWith('scripts/theme.js'));
    const styleIndex = result.head.findIndex((url) => url?.endsWith('.css'));
    assert(themeIndex !== -1 && themeIndex < styleIndex, `Theme must load before styles: ${filename}`);
    assert(!result.assets.some((url) => /\/(marked|gumshoe)\.min\.js$/.test(url)), `Retired browser dependency on ${filename}`);
    if (result.markdown) {
      assert(result.assets.some((url) => url.endsWith('/markdown-it.min.js')), `Missing Markdown parser on ${filename}`);
    }
    for (const asset of result.assets) {
      const url = new URL(asset, `${origin}/${filename}`);
      if (url.origin !== origin) continue;
      const exists = await access(path.join(docsDirectory, decodeURIComponent(url.pathname))).then(() => true, () => false);
      if (!exists) missingAssets.push(`${filename}: ${asset}`);
    }
  }
  assert.deepEqual(missingAssets, [], 'Missing shared documentation assets.');
  console.log(`Checked shared theme loading and assets on ${pageCount} documentation pages.`);
}

async function checkMarkdown(context, origin) {
  const page = await context.newPage();
  await page.goto(`${origin}/docs.html`);
  const headings = await page.evaluate(() => {
    const source = [
      '# Repeat', '# Repeat', '# Repeat-1', '# Repeat',
      '## Create [Viewer](api/Viewer.html)',
      '### <div class="cgv-btn"></div> Reset Button',
      '## `cgv.features()`', '## ![Map](images/map.png)'
    ].join('\n\n');
    const ids = () => Array.from(new DOMParser().parseFromString(renderDocsMarkdown(source), 'text/html')
      .querySelectorAll('h1,h2,h3'), (element) => element.id);
    return [ids(), ids()];
  });
  const expected = ['repeat', 'repeat-1', 'repeat-1-1', 'repeat-2', 'create-viewer', '-reset-button', 'cgvfeatures', 'map'];
  assert.deepEqual(headings, [expected, expected], 'Markdown heading URLs changed or leaked between renders.');
  assert.equal(await page.locator('#markdown-out [id="s.record-action-advantages"] li pre code').count(), 4,
    'Record action examples must stay inside their list items.');

  await page.goto(`${origin}/tutorials/details-json-files.html`);
  assert(await page.locator('#markdown-out pre code').allTextContents()
    .then((blocks) => blocks.some((text) => text.includes('<script') && text.includes('</script>'))),
  'Escaped HTML examples must remain readable code.');

  // Exercise examples assembled from Markdown, including asynchronous sequence extraction.
  for (const tutorial of ['controls', 'sequence', 'json', 'cgparse']) {
    await page.goto(`${origin}/tutorials/tutorial-${tutorial}.html`);
    // A random sequence can contain no ORFs; both generated plots must still load.
    await page.waitForFunction((tutorial) => tutorial === 'sequence'
      ? window.cgv?.plots().length === 2
      : window.cgv?.features().length > 0, tutorial);
    assert(await page.locator('#final-code code').textContent().then((text) => text.includes('CGView.Viewer')),
      `Combined example code is missing in ${tutorial}.`);
    if (tutorial === 'controls') {
      assert.equal(await page.locator('#markdown-out [id="-reset-button"]').count(), 1, 'Existing control heading URL changed.');
      const originalFormat = await page.evaluate(() => cgv.format);
      await page.locator('main #btn-toggle-format').click();
      await page.waitForFunction((format) => cgv.format !== format, originalFormat);
    }
  }

  await page.goto(`${origin}/json.html`);
  const ranges = await page.locator('#sidebar-nav a[href^="#lines."]').evaluateAll((links) => links.map((link) => ({
    name: link.textContent,
    range: link.hash.slice('#lines.'.length).split('-').map(Number)
  })));
  const lines = (await page.locator('#lines code').textContent()).split('\n');
  assert.equal(ranges.length, 13, 'JSON navigation is incomplete.');
  for (const { name, range: [start, end] } of ranges) {
    assert(lines[start - 1]?.includes(`${name}":`), `JSON link for ${name} starts at the wrong line.`);
    if (end) assert(/^\s*[}\]]/.test(lines[end - 1]), `JSON link for ${name} ends at the wrong line.`);
  }
  const settings = page.locator('#sidebar-nav a').filter({ hasText: /^settings$/ });
  await settings.click();
  await page.locator('#lines .temporary.line-highlight').waitFor({ state: 'visible' });
  await page.locator('#sidebar-nav li.active a').filter({ hasText: /^settings$/ }).waitFor({ state: 'visible' });
  await page.close();
  console.log('Markdown checks passed: heading URLs, HTML examples, list structure, live tutorials, and JSON line links.');
}

async function checkSectionNavigation(context, origin) {
  const page = await context.newPage();
  const waitForActive = async (hash) => {
    await page.waitForFunction((hash) => {
      const current = document.querySelectorAll('#sidebar-nav li.active a[aria-current="location"]');
      return current.length === 1 && current[0].hash === hash;
    }, hash);
  };

  await page.goto(`${origin}/docs.html#s.Viewer`);
  await waitForActive('#s.Viewer');
  for (const hash of ['#s.adding-records', '#s.Sequence', '#s.overview']) {
    // Change the scroll position without changing the URL to test actual tracking.
    await page.evaluate((hash) => {
      const section = document.querySelector(`main #${CSS.escape(hash.slice(1))}`);
      const offset = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop);
      window.scrollTo(0, window.scrollY + section.getBoundingClientRect().top - offset);
    }, hash);
    await waitForActive(hash);
  }
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await waitForActive('#s.Divider');
  await page.evaluate(() => window.scrollTo(0, 0));
  await waitForActive('#s.setup');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#sidebar-nav').waitFor({ state: 'hidden' });
  await page.locator('.sidebar-toggle').click();
  await page.locator('#sidebar-nav.show').waitFor({ state: 'visible' });
  await page.locator('#sidebar-nav a[href="#s.Feature"]').click();
  await waitForActive('#s.Feature');
  await page.locator('.sidebar-toggle').click();
  await page.locator('#sidebar-nav').waitFor({ state: 'hidden' });
  await waitForActive('#s.Feature');

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${origin}/index.html`);
  await waitForActive('#s.welcome');
  await page.locator('#sidebar-nav a[href="#s.features"]').click();
  await waitForActive('#s.features');
  await page.locator('#sidebar-nav a[href="#s.example"]').click();
  await waitForActive('#s.example');
  await page.evaluate(() => window.scrollTo(0, 0));
  await waitForActive('#s.welcome');
  await page.close();
  console.log('Section navigation checks passed: dotted deep links, scroll direction, short final sections, and mobile navigation.');
}

// Change modes through the same button used by mouse, touch, and keyboard users.
async function chooseTheme(page, theme) {
  if (await page.locator('html').getAttribute('data-bs-theme') !== theme) {
    await page.getByRole('button', { name: `Switch to ${theme} mode`, exact: true }).click();
  }
}

async function checkTheme(page, theme) {
  await page.waitForFunction((value) => document.documentElement.dataset.bsTheme === value, theme);
  const target = theme === 'dark' ? 'light' : 'dark';
  assert.equal(await page.getByRole('button', { name: `Switch to ${target} mode`, exact: true }).count(), 1);
  assert.equal(await page.locator('#docs-theme').textContent().then((text) => text.trim()), '', 'Theme button should contain only an icon.');
  assert.equal(await page.locator('#docs-theme svg:visible').count(), 1, 'Theme button should show one icon.');
  const colors = await page.locator('main.welcome .over-content, main:not(.welcome)').first().evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, text: style.color };
  });
  const luminance = (color) => color.match(/[\d.]+/g).slice(0, 3)
    .map((channel) => Number(channel) / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  const background = luminance(colors.background);
  const text = luminance(colors.text);
  assert(theme === 'dark' ? background < 0.1 : background > 0.9, `Incorrect ${theme} content background on ${page.url()}`);
  assert((Math.max(background, text) + 0.05) / (Math.min(background, text) + 0.05) >= 4.5, `Unreadable ${theme} body text on ${page.url()}`);
}

async function checkThemes(context, origin) {
  const page = await context.newPage();
  await page.goto(`${origin}/api/Viewer.html`);
  await page.evaluate(() => localStorage.removeItem('cgview-docs-theme'));
  await page.reload();
  await page.emulateMedia({ colorScheme: 'dark' });
  await checkTheme(page, 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await checkTheme(page, 'light');
  const toggle = page.getByRole('button', { name: 'Switch to dark mode', exact: true });
  await toggle.focus();
  await toggle.press('Enter');
  await checkTheme(page, 'dark');
  await page.getByRole('button', { name: 'Switch to light mode', exact: true }).press('Space');
  await checkTheme(page, 'light');
  await chooseTheme(page, 'dark');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.emulateMedia({ colorScheme: 'light' });
  await checkTheme(page, 'dark');

  const paths = ['api/Viewer.html', 'docs.html', 'tutorials/tutorial-basic.html', 'examples/example-small.html', 'json.html', 'index.html'];
  for (const theme of ['dark', 'light']) {
    await chooseTheme(page, theme);
    for (const pathname of paths) {
      await page.goto(`${origin}/${pathname}`);
      assert.equal(await page.evaluate(() => localStorage.getItem('cgview-docs-theme')), theme, 'Theme preference did not persist.');
      await checkTheme(page, theme);
      if (await page.locator('pre code').count()) {
        assert(await page.locator('pre code .token').count() > 0, `Code highlighting is missing on ${pathname}`);
      }
      if (pathname.startsWith('tutorials/') || pathname.startsWith('examples/')) {
        await page.waitForFunction(() => window.cgv?.features().length > 0);
      }
      if (pathname === 'json.html') {
        assert(await page.locator('code .json-link[href="api/Viewer.html"]').count() > 0, 'JSON syntax links stopped working.');
      }
    }
  }

  // Existing tabs follow changes, and clearing storage restores the system preference.
  const second = await context.newPage();
  await second.emulateMedia({ colorScheme: 'dark' });
  await second.goto(`${origin}/api/Feature.html`);
  await chooseTheme(page, 'dark');
  await checkTheme(second, 'dark');
  await chooseTheme(page, 'light');
  await checkTheme(second, 'light');
  await page.evaluate(() => localStorage.removeItem('cgview-docs-theme'));
  await checkTheme(second, 'dark');
  assert.equal(await second.evaluate(() => localStorage.getItem('cgview-docs-theme')), null);
  await second.close();

  // Disabled storage must not prevent theming or other page scripts from running.
  const isolated = await context.newPage();
  await isolated.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage disabled', 'SecurityError'); } });
  });
  await isolated.emulateMedia({ colorScheme: 'dark' });
  await isolated.goto(`${origin}/api/Viewer.html`);
  await checkTheme(isolated, 'dark');
  await chooseTheme(isolated, 'light');
  await checkTheme(isolated, 'light');
  await isolated.getByRole('searchbox', { name: 'Search API' }).fill('Viewer');
  await isolated.locator('.navigation .item[data-name="Viewer"]').waitFor({ state: 'visible' });
  assert(await isolated.locator('.navigation .item:visible').count() < await isolated.locator('.navigation .item').count());
  await isolated.close();
  await page.close();
  console.log('Theme checks passed: light/dark pages, system changes, persistence, cross-tab updates, blocked storage, tutorials, and JSON links.');
}

async function main() {
  const server = await startServer();
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    context.setDefaultTimeout(10000);
    const errors = [];
    context.on('page', (page) => {
      page.on('pageerror', (error) => errors.push(`${page.url()}: ${error.message}`));
      page.on('response', (response) => {
        if (response.url().startsWith(`${origin}/`) && response.status() >= 400) {
          errors.push(`${response.status()} ${response.url()}`);
        }
      });
    });
    // Keep checks independent of analytics and external CDNs.
    await context.route('**/*', (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const parser = await context.newPage();
    await checkGeneratedLinks(parser, origin);
    await checkSharedAssets(parser, origin);
    await parser.close();
    await checkBrowser(context, origin);
    await checkMarkdown(context, origin);
    await checkSectionNavigation(context, origin);
    await checkThemes(context, origin);
    assert.deepEqual(errors, [], 'Documentation browser errors.');
  } finally {
    await browser?.close();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
