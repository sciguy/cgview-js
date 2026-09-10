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
      // linenumber.js assigns these anchors after syntax highlighting in the browser.
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
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.url().startsWith(`${origin}/`) && response.status() >= 400) {
      errors.push(`${response.status()} ${response.url()}`);
    }
  });

  for (const filename of ['index.html', 'Viewer.html', 'Feature.html', 'Plot.html']) {
    await page.goto(`${origin}/api/${filename}`);
    await page.locator('.main').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.page-title').getAttribute('data-filename'), filename);
    assert(await page.locator('.navigation .item').count() > 0, `Empty navigation on ${filename}`);
  }

  await page.goto(`${origin}/api/Viewer.html`);
  await page.locator('#search').pressSequentially('Viewer');
  await page.locator('.navigation .item[data-name="Viewer"]').waitFor({ state: 'visible' });
  const itemCount = await page.locator('.navigation .item').count();
  assert(await page.locator('.navigation .item:visible').count() < itemCount, 'API search did not filter navigation.');
  await page.locator('#search').fill('');
  await page.locator('#search').press('Backspace');
  assert.equal(await page.locator('.navigation .item:visible').count(), itemCount, 'Clearing search did not restore navigation.');

  const sourceLink = await page.locator('.tag-source a[href*=".js.html#line"]').first().getAttribute('href');
  assert(sourceLink, 'Viewer source link is missing.');
  const sourceUrl = new URL(sourceLink, page.url());
  await page.goto(sourceUrl.href);
  assert(await page.evaluate((id) => Boolean(document.getElementById(id)), sourceUrl.hash.slice(1)), 'Source line anchor was not created.');

  await page.goto(`${origin}/api/Viewer.html`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#sidebar-nav').waitFor({ state: 'hidden' });
  await page.locator('.sidebar-toggle').click();
  await page.locator('#sidebar-nav').waitFor({ state: 'visible' });
  assert.deepEqual(errors, [], 'Documentation browser errors.');
  console.log('Browser checks passed: class pages, search, source anchors, and mobile navigation.');
}

async function main() {
  const server = await startServer();
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    context.setDefaultTimeout(10000);
    // Keep checks independent of analytics and external CDNs.
    await context.route('**/*', (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await checkGeneratedLinks(await context.newPage(), origin);
    await checkBrowser(context, origin);
  } finally {
    await browser?.close();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
