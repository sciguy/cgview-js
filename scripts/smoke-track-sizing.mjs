import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, realpath, stat, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';

// Serve the exact docs tree (including a published docs symlink) on loopback.
// Usage: node scripts/smoke-track-sizing.mjs [published-docs-directory]
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docs = await realpath(process.argv[2] || path.join(root, 'docs'));
const artifacts = path.join(root, '.agents', 'track-sizing-smoke');
await mkdir(artifacts, {recursive: true});
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml'};
const server = createServer(async (request, response) => {
  try {
    let file = path.resolve(docs, `.${decodeURIComponent(new URL(request.url, 'http://localhost').pathname)}`);
    if (path.relative(docs, file).startsWith('..')) {
      response.writeHead(403).end();
      return;
    }
    if ((await stat(file)).isDirectory()) { file = path.join(file, 'index.html'); }
    response.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    response.end(await readFile(file));
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
const errors = [];
page.on('pageerror', error => errors.push(error.message));
// Analytics is unrelated to the local browser check.
await page.route('https://stats.stothardresearch.ca/**', route => route.fulfill({status: 204}));
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-6,
  `${message}: expected ${expected}, got ${actual}`);

async function syncReadout() {
  await page.waitForFunction(() => {
    const track = cgv.tracks().find(item => item.cgvID === document.getElementById('track-sizing-track').value);
    return track && Math.abs(Number(document.getElementById('track-sizing-overview').value) - track.computedInitialSlotThickness) < 0.005;
  });
}

async function changeNumber(value, checkPendingSync = false) {
  await page.locator('#track-sizing-value').fill(String(value));
  if (checkPendingSync) {
    await page.evaluate(() => {
      cgv.settings.update({maxSlotThickness: cgv.settings.maxSlotThickness});
      return new Promise(resolve => requestAnimationFrame(resolve));
    });
    assert.equal(await page.locator('#track-sizing-value').inputValue(), String(value),
      'a queued readout refresh must preserve the unsubmitted numeric edit');
  }
  await page.locator('#track-sizing-value').dispatchEvent('change');
  await syncReadout();
}

try {
  await page.goto(`http://127.0.0.1:${server.address().port}/test/`);
  await page.waitForFunction(() => window.cgv?.tracks().length > 0 && !cgv.loading);
  await page.locator('#option-show-track-sizing').check();
  await syncReadout();
  const original = await page.evaluate(() => cgv.io.toJSON());
  const choices = await page.locator('#track-sizing-track option').allTextContents();
  assert.ok(choices.some(text => text.includes('Feature')));
  assert.ok(choices.some(text => text.includes('Plot')));

  for (const format of ['circular', 'linear']) {
    await page.evaluate(({original, format}) => {
      cgv.io.loadJSON(original);
      cgv.settings.update({format});
      cgv.draw();
    }, {original, format});
    await syncReadout();
    const trackID = await page.evaluate(() => cgv.tracks().find(track => track.type === 'feature' && track.slots().length === 2).cgvID);
    await page.locator('#track-sizing-track').selectOption(trackID);
    await page.locator('#track-sizing-mode').selectOption('pixels');
    const before = await page.evaluate(() => cgv.tracks().map(track => ({id: track.cgvID, overview: track.computedInitialSlotThickness, ratio: track.thicknessRatio})));
    await changeNumber(20, true);
    const after = await page.evaluate(() => cgv.tracks().map(track => ({id: track.cgvID, overview: track.computedInitialSlotThickness, ratio: track.thicknessRatio, slots: track.slots().map(slot => slot.thickness)})));
    after.forEach((track, i) => {
      near(track.overview, track.id === trackID ? 20 : before[i].overview, `${format} overview target/neighbour`);
      if (track.id === trackID) {
        track.slots.forEach(width => near(width, 20, 'each of two rendered slots'));
      } else {
        assert.equal(track.ratio, before[i].ratio);
      }
    });
    assert.equal(await page.locator('#track-sizing-count').textContent(), '2');

    const settingsBefore = await page.evaluate(() => cgv.settings.toJSON());
    await page.locator('#track-sizing-mode').selectOption('ratio');
    await changeNumber(2);
    assert.deepEqual(await page.evaluate(() => cgv.settings.toJSON()), settingsBefore);
    near(await page.evaluate(id => cgv.tracks().find(track => track.cgvID === id).thicknessRatio, trackID), 2, 'ratio control');

    await page.locator('#track-sizing-mode').selectOption('pixels');
    await page.evaluate(() => cgv.zoomTo(4321, 5, {duration: 0, bbOffset: 12}));
    await page.waitForFunction(() => cgv.zoomFactor === 5 && !cgv.canvas.node('ui').__transition);
    const focal = await page.evaluate(() => ({bp: cgv.bpFloat, offset: cgv.bbOffset}));
    await page.locator('#track-sizing-slider').evaluate(slider => {
      for (const value of [25, 30, 18, 24]) {
        slider.value = value;
        slider.dispatchEvent(new Event('input', {bubbles: true}));
      }
      slider.dispatchEvent(new Event('change', {bubbles: true}));
    });
    await syncReadout();
    const zoomed = await page.evaluate(id => ({
      bp: cgv.bpFloat, offset: cgv.bbOffset, zoom: cgv.zoomFactor,
      overview: cgv.tracks().find(track => track.cgvID === id).computedInitialSlotThickness,
      transition: Boolean(cgv.canvas.node('ui').__transition),
      rendered: cgv.tracks().find(track => track.cgvID === id).slots(1).thickness,
      cap: cgv.settings.maxSlotThickness,
    }), trackID);
    near(zoomed.bp, focal.bp, 'slider focal base');
    near(zoomed.offset, focal.offset, 'slider focal radial offset');
    near(zoomed.overview, 24, 'zoomed slider overview target');
    assert.equal(zoomed.zoom, 5);
    assert.equal(zoomed.transition, false);
    assert.ok(zoomed.rendered <= zoomed.cap + 1e-6);
    near(Number(await page.locator('#track-sizing-rendered').textContent()), zoomed.rendered, 'rendered readout');
    await page.screenshot({path: path.join(artifacts, `${format}-zoomed.png`)});

    const plotID = await page.evaluate(() => cgv.tracks().find(track => track.type === 'plot').cgvID);
    await page.locator('#track-sizing-track').selectOption(plotID);
    await changeNumber(25);
    near(await page.evaluate(id => cgv.tracks().find(track => track.cgvID === id).computedInitialSlotThickness, plotID), 25, 'plot sizing');

    await page.evaluate(id => cgv.tracks().find(track => track.cgvID === id).update({visible: false}), plotID);
    await page.waitForFunction(() => document.getElementById('track-sizing-value').disabled);
    assert.match(await page.locator('#track-sizing-status').textContent(), /Show this track/);
    await page.evaluate(id => cgv.tracks().find(track => track.cgvID === id).update({visible: true}), plotID);
    await syncReadout();
    await page.waitForFunction(() => !document.getElementById('track-sizing-value').disabled);

    await page.evaluate(() => cgv.zoomTo(4321, 1, {duration: 0}));
    await page.waitForFunction(() => cgv.zoomFactor === 1 && !cgv.canvas.node('ui').__transition);
    await page.evaluate(() => cgv.resize(650, 550));
    await syncReadout();
    near(Number(await page.locator('#track-sizing-value').inputValue()),
      await page.evaluate(id => cgv.tracks().find(track => track.cgvID === id).computedInitialSlotThickness, plotID), 'canvas resize control sync');
    await page.evaluate(() => cgv.settings.update({initialMapThicknessProportion: cgv.settings.initialMapThicknessProportion * 0.8}));
    await syncReadout();
    near(Number(await page.locator('#track-sizing-value').inputValue()),
      await page.evaluate(id => cgv.tracks().find(track => track.cgvID === id).computedInitialSlotThickness, plotID), 'settings control sync');

    await changeNumber(0);
    assert.match(await page.locator('#track-sizing-status').textContent(), /finite positive/);
    console.log(`PASS ${format}: feature/plot controls, per-slot targets, neighbours, ratio, zoom/focus, slider, visibility, resize, settings, validation`);
  }

  await page.evaluate(() => cgv.io.loadJSON({cgview: {version: '1.9.0', sequence: {length: 1000}}}));
  await page.waitForFunction(() => document.getElementById('track-sizing-track').options.length === 0);
  assert.equal(await page.locator('#track-sizing-slider').isDisabled(), true);
  assert.match(await page.locator('#track-sizing-status').textContent(), /no tracks/);
  await page.evaluate(original => cgv.io.loadJSON(original), original);
  await syncReadout();
  assert.equal(await page.locator('#track-sizing-value').isDisabled(), false);
  assert.equal(await page.locator('#track-sizing-track option').count(), choices.length);
  assert.deepEqual(errors, []);
  await page.screenshot({path: path.join(artifacts, 'overview.png')});
  console.log(`PASS loading/empty-map recovery; no page errors; Chromium ${browser.version()}`);
  console.log(`Verified docs: ${docs}`);
  console.log(`Screenshots: ${artifacts}`);
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
