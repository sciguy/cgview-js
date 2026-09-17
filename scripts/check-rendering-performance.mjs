#!/usr/bin/env node

import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';

// Compare built checkouts without rebuilding either one or downloading assets.
// Usage: cgview-run node scripts/check-rendering-performance.mjs --baseline-root ../cgview-js
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const options = {output: path.join(root, '.benchmark-results/stage1-visual-check.json')};
for (let index = 2; index < process.argv.length; index++) {
  const flag = process.argv[index];
  if (flag === '--help') {
    console.log('Usage: cgview-run node scripts/check-rendering-performance.mjs --baseline-root PATH [--output PATH]\nBuild both checkouts first. Checks 12 raster cases, 4 SVG/PNG exports, and profiler equivalence.');
    process.exit(0);
  }
  if (!['--baseline-root', '--output'].includes(flag)) throw new Error(`Unknown option: ${flag}`);
  const value = process.argv[++index];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
  options[flag === '--baseline-root' ? 'baselineRoot' : 'output'] = path.resolve(value);
}
if (!options.baselineRoot) throw new Error('--baseline-root is required');
if (options.baselineRoot === root) throw new Error('Baseline and candidate roots must differ');

/** Render an isolated case; returns hashes of exact RGBA pixels and normalized SVG structure. */
async function renderCase(browser, assets, scenario, checkProfile) {
  const context = await browser.newContext({viewport: {width: 600, height: 600}, deviceScaleFactor: 1});
  const errors = [];
  let timer;
  const run = async () => {
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('crash', () => errors.push('Chromium page crashed'));
    // An intercepted secure origin enables WebCrypto with no external network request.
    await page.route('https://render-check.invalid/**', route => route.fulfill({contentType: 'text/html',
      body: '<!doctype html><meta charset="utf-8"><body style="margin:0"><div id="map"></div>'}));
    await page.goto('https://render-check.invalid/');
    await page.addStyleTag({content: assets.stylesheet.content});
    for (const script of assets.scripts) await page.addScriptTag({content: script.content});
    const result = await page.evaluate(async ({scenario, checkProfile}) => {
      const hash = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
        .map(value => value.toString(16).padStart(2, '0')).join('');
      const fail = message => { throw new Error(message); };
      const dataset = CGVRenderingBenchmark.generate({count: 1000, seed: 42, labels: 40,
        plotPoints: 101, shading: true, format: scenario.format, decoration: scenario.decoration});
      dataset.json.cgview.settings.showBorder = true;
      dataset.json.cgview.features.forEach((feature, index) => { feature.score = (index % 17) / 16; });
      dataset.json.cgview.features[370].selected = true;
      dataset.json.cgview.tracks[0].drawOrder = scenario.decoration === 'arrow' ? 'score' : 'position';
      const viewer = new CGView.Viewer('#map', {width: 600, height: 600, SVGContext: svgcanvas.Context});
      viewer.io.loadJSON(dataset.json);
      await CGVRenderingBenchmark.settle(viewer);
      await new Promise(resolve => viewer.zoomTo(scenario.zoom === 1 ? 0 : 370000, scenario.zoom,
        {duration: 0, callback: resolve}));
      if (viewer.zoomFactor !== scenario.zoom) fail('Requested zoom was clamped');
      viewer.drawFull();
      await CGVRenderingBenchmark.settle(viewer);
      const raster = async () => Object.fromEntries(await Promise.all(viewer.canvas.layerNames.map(async layer => {
        const node = viewer.canvas.node(layer);
        const pixels = viewer.canvas.context(layer).getImageData(0, 0, node.width, node.height).data;
        return [layer, {width: node.width, height: node.height, sha256: await hash(pixels)}];
      })));
      const result = {raster: await raster()};
      if (checkProfile) {
        viewer.drawExport();
        const expected = JSON.stringify(await raster());
        const contexts = viewer.canvas.layerNames.map(layer => viewer.canvas.context(layer));
        const targets = [viewer.canvas, viewer.layout, viewer.layout.delegate, viewer.annotation,
          viewer.annotation._featureLabelRenderer, viewer.layout._trackLabelRenderer, viewer.eventMonitor,
          viewer.annotation.labelPlacementFast, viewer.annotation.labelPlacementFull,
          ...contexts, ...[viewer.features()[0], viewer.slots()[0], viewer.plots()[0],
            viewer.slots()[0]._featureNCList, viewer.features()[0].color].map(Object.getPrototypeOf),
          viewer.plots()[0]._renderer];
        const descriptors = target => Object.getOwnPropertyNames(target).map(key =>
          [key, Object.getOwnPropertyDescriptor(target, key)]).filter(([, descriptor]) =>
          typeof descriptor.value === 'function' || descriptor.get || descriptor.set);
        const originals = targets.map(target => descriptors(target));
        const visibleCount = viewer.layout.visibleSlots().reduce((sum, slot) => sum +
          (slot.hasFeatures && slot.visibleRange ? slot._featureNCList.count(slot.visibleRange.start, slot.visibleRange.stop) : 0), 0);
        const profile = new CGVRenderingProfile(viewer);
        let snapshot;
        try {
          viewer.drawExport();
          snapshot = profile.snapshot();
          if (JSON.stringify(await raster()) !== expected) fail('Profiler changed raster pixels');
        } finally { profile.restore(); }
        targets.forEach((target, index) => {
          const restored = descriptors(target);
          if (restored.length !== originals[index].length || restored.some(([key, descriptor]) => {
            const original = originals[index].find(([name]) => name === key)?.[1];
            return !original || ['value', 'get', 'set', 'configurable', 'enumerable', 'writable']
              .some(property => descriptor[property] !== original[property]);
          })) fail('Profiler did not restore method/accessor descriptors');
        });
        if (CGVRenderingProfile.active || snapshot.skippedHooks.length) fail('Profiler restoration or instrumentation incomplete');
        if ((snapshot.timings['feature.draw']?.calls || 0) !== visibleCount || visibleCount === 0) {
          fail('Profiler feature count does not match visible NCList records');
        }
        viewer.drawExport();
        if (JSON.stringify(await raster()) !== expected) fail('Restored draw changed raster pixels');
        result.profile = {passed: true, featureCalls: visibleCount, skippedHooks: snapshot.skippedHooks};
      }
      if (scenario.zoom === 10) {
        const xml = new DOMParser().parseFromString(viewer.io.getSVG(), 'image/svg+xml');
        if (xml.querySelector('parsererror')) fail('SVG export is malformed');
        const elements = [xml.documentElement, ...xml.documentElement.querySelectorAll('*')];
        const elementIndexes = new Map(elements.map((element, index) => [element, index]));
        const ids = new Map(elements.filter(element => element.hasAttribute('id'))
          .map((element, index) => [element.id, `id-${index}`]));
        const normalized = elements.map(element => [element.localName,
          elementIndexes.get(element.parentElement) ?? null,
          Array.from(element.attributes).map(attribute => [attribute.name, attribute.name === 'id' ? ids.get(attribute.value) :
            attribute.value.replace(/url\(#([^)]*)\)/g, (_, id) => `url(#${ids.get(id) || id})`)
              .replace(/^#(.+)$/, (value, id) => ids.has(id) ? `#${ids.get(id)}` : value)])
            .sort(([left], [right]) => left.localeCompare(right)),
          Array.from(element.childNodes).filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join('')]);
        result.svg = {elements: elements.length, sha256: await hash(new TextEncoder().encode(JSON.stringify(normalized)))};
        const originalDownload = viewer.io.download;
        let blob;
        try {
          blob = await new Promise(resolve => {
            viewer.io.download = resolve;
            viewer.io.downloadImage(1200, 1200, 'check.png');
          });
        } finally { viewer.io.download = originalDownload; }
        if (!(blob instanceof Blob) || blob.type !== 'image/png') fail('PNG export did not return a PNG blob');
        const bitmap = await createImageBitmap(blob);
        if (bitmap.width !== 1200 || bitmap.height !== 1200) fail('PNG export dimensions are incorrect');
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width; canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0); bitmap.close();
        result.png = {width: canvas.width, height: canvas.height,
          pixelsSha256: await hash(ctx.getImageData(0, 0, canvas.width, canvas.height).data),
          bytesSha256: await hash(await blob.arrayBuffer())};
      }
      return result;
    }, {scenario, checkProfile});
    if (errors.length) throw new Error(errors.join('\n'));
    return result;
  };
  try {
    return await Promise.race([run(), new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Visual case exceeded 120 seconds')), 120000);
    })]);
  } finally { clearTimeout(timer); await context.close(); }
}

const report = {schemaVersion: 1, generatedAt: new Date().toISOString(), status: 'running',
  baselineRoot: options.baselineRoot, candidateRoot: root, cases: []};
const save = async () => {
  await mkdir(path.dirname(options.output), {recursive: true});
  await writeFile(options.output, `${JSON.stringify(report, null, 2)}\n`);
};
let browser;
try {
  const readAsset = async file => {
    const bytes = await readFile(file);
    return {path: file, sha256: createHash('sha256').update(bytes).digest('hex'), content: bytes.toString('utf8')};
  };
  const helpers = await Promise.all(['docs/test/rendering-profile.js', 'docs/test/rendering-benchmark.js']
    .map(file => readAsset(path.join(root, file))));
  const targets = await Promise.all([options.baselineRoot, root].map(async directory => {
    const [stylesheet, ...scripts] = await Promise.all(['docs/dist/cgview.css', 'docs/scripts/d3.min.js',
      'docs/scripts/svgcanvas.iife.js', 'docs/dist/cgview.min.js'].map(file => readAsset(path.join(directory, file))));
    return {root: directory, stylesheet, scripts: scripts.concat(helpers)};
  }));
  const metadata = ({path: assetPath, sha256}) => ({path: assetPath, sha256});
  report.assets = targets.map(target => ({root: target.root, stylesheet: metadata(target.stylesheet),
    scripts: target.scripts.map(metadata)}));
  report.bundles = targets.map(target => ({root: target.root, sha256: target.scripts[2].sha256}));
  browser = await chromium.launch({headless: true});
  report.chromium = browser.version();
  for (const format of ['circular', 'linear']) for (const decoration of ['arc', 'arrow']) for (const zoom of [1, 10, 1000]) {
    const item = {format, decoration, zoom, status: 'running'};
    report.cases.push(item);
    try {
      item.baseline = await renderCase(browser, targets[0], item, false);
      item.candidate = await renderCase(browser, targets[1], item, true);
      for (const key of ['raster', 'svg', 'png']) assert.deepEqual(item.candidate[key], item.baseline[key], `${format}/${decoration}/${zoom}: ${key} differs`);
      item.status = 'passed';
      console.log(`Passed ${format}/${decoration}/${zoom}`);
    } catch (error) { item.status = 'failed'; item.error = error.message; throw error; }
    finally { await save(); }
  }
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = error.message; process.exitCode = 1;
  console.error(error.message);
} finally {
  await browser?.close();
  await save();
  console.log(`Visual check report: ${options.output}`);
}
