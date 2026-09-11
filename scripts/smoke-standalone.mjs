import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {mkdir, readFile, realpath, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
import {parseAst} from 'rollup/parseAst';
import * as externalD3 from 'd3';
import {bundleVariants, bundleFormats} from './build/bundles.mjs';

// Check every generated browser bundle against the core build, then exercise
// the single-file demo without external scripts, stylesheets, or map requests.
// Usage: cgview-run node scripts/smoke-standalone.mjs [published-docs-directory]
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docs = await realpath(process.argv[2] || path.join(root, 'docs'));
const artifacts = path.join(root, '.agents/dependencies');
await mkdir(artifacts, {recursive: true});
const fixture = JSON.parse(await readFile(path.join(docs, 'test/maps/basic_mito_no_plots.json'), 'utf8'));
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml'};
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/external-d3.mjs') {
      response.setHeader('Content-Type', 'text/javascript');
      response.end(`export const {${Object.keys(externalD3).join(',')}} = globalThis.d3;`);
      return;
    }
    if (pathname === '/empty') {
      response.setHeader('Content-Type', 'text/html');
      response.end('<!doctype html><html><head><link rel="icon" href="data:,"></head><body><div id="map"></div></body></html>');
      return;
    }
    let file = path.resolve(docs, `.${pathname}`);
    if (path.relative(docs, file).startsWith('..')) { response.writeHead(403).end(); return; }
    if ((await stat(file)).isDirectory()) { file = path.join(file, 'index.html'); }
    response.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    response.end(await readFile(file));
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const results = [];
let browser;

async function finishedDrawing(page) {
  await page.waitForFunction(() => window.cgv && !cgv.loading && cgv.layout._slotTimeoutID === undefined);
}

try {
  browser = await chromium.launch({headless: true});
  const fingerprints = {};
  let originalExports;
  for (const variant of bundleVariants) {
    for (const {format, minified} of bundleFormats) {
      await checkVariant(variant, format, minified);
    }
    console.log(`${variant.id}: both outputs passed`);
  }

  async function checkVariant(variant, format, minified) {
    const file = `${variant.stem}${format === 'es' ? '.esm' : ''}${minified ? '.min' : ''}.js`;
    const code = await readFile(path.join(docs, 'dist', file), 'utf8');
    const sourceMap = JSON.parse(await readFile(path.join(docs, 'dist', `${file}.map`), 'utf8'));
    assert.ok(sourceMap.sources.length && sourceMap.mappings.length, `${file}: nonempty source map`);
    assert.equal(sourceMap.file, file);
    assert.ok(code.includes(`sourceMappingURL=${file}.map`), `${file}: correct source-map URL`);
    assert.equal(sourceMap.sources.some(source => source.includes('/node_modules/d3-')), variant.d3,
      `${file}: D3 inclusion in source map`);
    assert.equal(sourceMap.sources.some(source => source.includes('/node_modules/svgcanvas/')), variant.svg,
      `${file}: SVG inclusion in source map`);
    const imports = parseAst(code).body.filter(node => node.type === 'ImportDeclaration').map(node => node.source.value);
    assert.deepEqual(imports, format === 'es' && !variant.d3 ? ['d3'] : [], `${file}: external imports`);
    if (variant.d3) { assert.ok(code.includes('Bundled:') && code.includes('d3-zoom'), `${file}: D3 notices`); }
    if (variant.svg) { assert.ok(code.includes('svgcanvas 2.3.0'), `${file}: SVG notices`); }
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/empty`);
    if (!variant.d3) {
      await page.addScriptTag({url: `${base}/scripts/d3.min.js`});
    }
    if (!variant.css) { await page.addStyleTag({url: `${base}/dist/cgview.css`}); }
    if (format === 'es') {
      if (!variant.d3) {
        await page.addScriptTag({type: 'importmap', content: JSON.stringify({imports: {d3: `${base}/external-d3.mjs`}})});
      }
      await page.evaluate(async url => { window.CGView = await import(url); }, `${base}/dist/${file}`);
    } else {
      await page.evaluate(url => new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.nonce = 'bundle-smoke';
        script.src = url;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      }), `${base}/dist/${file}`);
    }
    const exports = await page.evaluate(() => Object.keys(CGView).sort());
    if (!originalExports) { originalExports = exports; }
    assert.deepEqual(exports, originalExports, `${file}: unchanged public exports`);
    assert.deepEqual(await page.evaluate(() => [typeof window.d3, typeof window.svgcanvas]),
      [variant.d3 ? 'undefined' : 'object', 'undefined'], `${file}: expected external globals`);
    assert.equal(await page.locator('style[data-cgview-styles]').count(), Number(variant.css));
    if (variant.css && format === 'iife') {
      assert.equal(await page.locator('style[data-cgview-styles]').evaluate(style => style.nonce), 'bundle-smoke');
    }
    await page.evaluate(fixture => {
      window.cgv = new CGView.Viewer('#map', {width: 700, height: 560});
      cgv.io.loadJSON(fixture);
      cgv.draw();
    }, fixture);
    assert.equal(await page.evaluate(() => typeof cgv.externals.SVGContext), variant.svg ? 'function' : 'undefined');
    for (const layout of ['circular', 'linear']) {
      await page.evaluate(layout => {
        cgv.settings.update({format: layout});
        cgv.drawFull();
      }, layout);
      await finishedDrawing(page);
      const pixels = await page.evaluate(() => cgv.canvas.layerNames.filter(name => name !== 'ui')
        .map(name => cgv.canvas.node(name).toDataURL()).join('\n'));
      const hash = createHash('sha256').update(pixels).digest('hex');
      if (!fingerprints[layout]) { fingerprints[layout] = hash; }
      assert.equal(hash, fingerprints[layout], `${file}: ${layout} pixels match core`);

      await page.evaluate(() => new Promise(resolve =>
        cgv.zoomTo(cgv.sequence.length / 3, 3, {duration: 60, callback: resolve})));
      assert.ok(Math.abs(await page.evaluate(() => cgv.zoomFactor) - 3) < 1e-6);
      await page.evaluate(() => cgv.stopAnimate());
      await page.evaluate(() => new Promise(resolve => cgv.zoomTo(0, 1, {duration: 0, callback: resolve})));
    }
    if (variant.svg) {
      const svg = await page.evaluate(() => cgv.io.getSVG());
      assert.ok(svg.includes('<svg') && svg.includes('<path'), `${file}: bundled SVG includes paths`);
    } else {
      await page.addScriptTag({url: `${base}/scripts/svgcanvas.iife.js`});
      const svg = await page.evaluate(() => {
        cgv.externals.SVGContext = svgcanvas.Context;
        return cgv.io.getSVG();
      });
      assert.ok(svg.includes('<svg') && svg.includes('<path'), `${file}: externally supplied SVG includes paths`);
    }
    assert.equal(await page.evaluate(() => {
      const element = document.createElement('div');
      element.id = 'custom-svg';
      document.body.appendChild(element);
      class CustomSVGContext {}
      const viewer = new CGView.Viewer('#custom-svg', {SVGContext: CustomSVGContext});
      return viewer.externals.SVGContext === CustomSVGContext;
    }), true, `${file}: constructor SVG override`);
    if (variant.css && format === 'iife' && minified) {
      await page.addScriptTag({url: `${base}/dist/${file}`});
      assert.equal(await page.locator('style[data-cgview-styles]').count(), 1, `${file}: repeated styles deduplicated`);
    }
    assert.deepEqual(errors, [], `${file}: browser errors`);
    results.push(`${file}: maps, imports, notices, exports, pixels, animations, inclusion flags, SVG export/override`);
    await page.close();
  }

  const page = await browser.newPage({viewport: {width: 1000, height: 900}});
  const errors = [];
  const requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push({url: request.url(), type: request.resourceType()}));
  await page.goto(`${base}/test/standalone.html`);
  await finishedDrawing(page);
  assert.equal(await page.evaluate(() => cgv.features().length), 5);
  assert.equal(await page.evaluate(() => cgv.plots().length), 1);
  assert.equal(await page.locator('style[data-cgview-styles]').count(), 1);
  assert.deepEqual(await page.evaluate(() => [typeof window.d3, typeof window.svgcanvas]), ['undefined', 'undefined']);
  assert.deepEqual(requests.filter(request => request.type !== 'document').map(request => request.url),
    [`${base}/dist/cgview.standalone.min.js`], 'only one library request, including styles and SVG export');
  await page.screenshot({path: path.join(artifacts, 'standalone.png'), fullPage: true});

  await page.locator('#zoom-in').click();
  await page.waitForFunction(() => Math.abs(cgv.zoomFactor - 2) < 0.001);
  const canvas = page.locator('#my-viewer canvas').last();
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const beforeWheel = await page.evaluate(() => cgv.zoomFactor);
  await page.mouse.wheel(0, -100);
  await page.waitForFunction(before => cgv.zoomFactor > before, beforeWheel);
  const beforePan = await page.evaluate(() => cgv.scale.x.domain());
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 20, {steps: 6});
  await page.mouse.up();
  assert.notDeepEqual(await page.evaluate(() => cgv.scale.x.domain()), beforePan, 'mouse pan updates scale');
  await page.locator('#format').click();
  assert.equal(await page.evaluate(() => cgv.format), 'linear');

  await page.locator('#color').click();
  await page.waitForFunction(() => cgv.colorPicker.visible);
  await page.evaluate(() => cgv.colorPicker.close());
  await page.waitForFunction(() => !cgv.colorPicker.visible);
  const svg = await page.evaluate(() => cgv.io.getSVG());
  assert.ok(svg.includes('<svg') && svg.includes('<path'));
  await writeFile(path.join(artifacts, 'standalone.svg'), svg);
  const pngDownload = page.waitForEvent('download');
  await page.locator('#png').click();
  await (await pngDownload).saveAs(path.join(artifacts, 'export.png'));
  assert.ok((await stat(path.join(artifacts, 'export.png'))).size > 1000);

  // Existing callers can still supply their own SVG context.
  assert.equal(await page.evaluate(() => {
    const element = document.createElement('div');
    element.id = 'custom-svg';
    document.body.appendChild(element);
    class CustomSVGContext {}
    const viewer = new CGView.Viewer('#custom-svg', {SVGContext: CustomSVGContext});
    return viewer.externals.SVGContext === CustomSVGContext;
  }), true);

  // Extraction workers are already embedded as functions and use blob URLs.
  await page.evaluate(() => {
    const element = document.createElement('div');
    element.id = 'worker-map';
    document.body.appendChild(element);
    window.workerViewer = new CGView.Viewer('#worker-map', {
      sequence: {seq: 'ATGCGCGCTAACGTATATAGCGC'.repeat(100)}
    });
    workerViewer.addTracks({dataMethod: 'sequence', dataType: 'plot', dataKeys: 'gc-content'});
    workerViewer.addTracks({dataMethod: 'sequence', dataType: 'feature', dataKeys: 'start-stop-codons'});
  });
  await page.waitForFunction(() => workerViewer.plots().length > 0 && workerViewer.features().length > 0);
  assert.deepEqual(errors, [], 'standalone demo browser errors');
  results.push('Single-file demo: one request, features/plot, mouse zoom/pan, color picker, SVG/PNG, custom SVGContext, both extraction workers');
  await page.close();

  const home = await browser.newPage();
  const homeErrors = [];
  home.on('pageerror', error => homeErrors.push(error.message));
  await home.route('https://stats.stothardresearch.ca/**', route => route.fulfill({status: 204}));
  await home.goto(base);
  await finishedDrawing(home);
  assert.ok(await home.evaluate(() => cgv.features().length > 0));
  assert.deepEqual(homeErrors, [], 'published docs homepage browser errors');
  results.push('Published docs symlink: original homepage renders');
  await home.close();

  const testPage = await browser.newPage();
  const testPageErrors = [];
  testPage.on('pageerror', error => testPageErrors.push(error.message));
  await testPage.route('https://stats.stothardresearch.ca/**', route => route.fulfill({status: 204}));
  await testPage.goto(`${base}/test/`);
  await finishedDrawing(testPage);
  assert.ok(await testPage.evaluate(() => cgv.features().length > 0));
  assert.deepEqual(testPageErrors, [], 'test harness browser errors');
  results.push('Published test harness renders with the retained core minified bundle');
  await testPage.close();
  await writeFile(path.join(artifacts, 'smoke-results.json'), JSON.stringify({docs, results}, null, 2) + '\n');
  console.log(results.join('\n'));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
