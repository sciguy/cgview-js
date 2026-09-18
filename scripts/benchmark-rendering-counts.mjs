#!/usr/bin/env node

import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';

// Isolate Slot.draw's visible-count change on identical objects, camera, and heap.
// This paired experiment complements separate end-to-end checkout benchmarks.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const options = {iterations: 20, warmups: 4,
  output: path.join(root, '.benchmark-results/stage1-count-paired.json')};
for (let i = 2; i < process.argv.length; i++) {
  const flag = process.argv[i];
  if (flag === '--help') {
    console.log('Usage: cgview-run node scripts/benchmark-rendering-counts.mjs --baseline-root PATH [--iterations 20] [--warmups 4] [--output PATH]\nBuild both checkouts first. Alternates original/current Slot.draw on one current viewer per 1M-feature layout/decoration case.');
    process.exit(0);
  }
  if (!['--baseline-root', '--iterations', '--warmups', '--output'].includes(flag)) throw new Error(`Unknown option: ${flag}`);
  const value = process.argv[++i];
  if (!value?.trim() || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
  if (flag === '--baseline-root' || flag === '--output') {
    options[flag === '--baseline-root' ? 'baselineRoot' : 'output'] = path.resolve(value);
  } else {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < (flag === '--iterations' ? 1 : 0)) throw new Error(`Invalid ${flag}`);
    options[flag.slice(2)] = number;
  }
}
if (!options.baselineRoot || options.baselineRoot === root) throw new Error('--baseline-root must identify a different built checkout');
const sha256 = data => createHash('sha256').update(data).digest('hex');
const report = {schemaVersion: 1, generatedAt: new Date().toISOString(), status: 'running', options,
  description: 'Paired Slot.draw substitution on one current Viewer and heap per case. Synchronous Canvas export drawing, not file encoding, GPU completion, or end-to-end checkout comparison.',
  environment: {node: process.version, platform: process.platform, architecture: process.arch,
    os: os.release(), cpu: os.cpus()[0]?.model}, scenarios: []};
const save = async () => {
  await mkdir(path.dirname(options.output), {recursive: true});
  await writeFile(options.output, `${JSON.stringify(report, null, 2)}\n`);
};

/** Alternate two real bundled methods on shared feature slots, then restore descriptors. */
async function runScenario(browser, scenario, assets) {
  const context = await browser.newContext({viewport: {width: 600, height: 600}, deviceScaleFactor: 1});
  let timer;
  const errors = [];
  const run = async () => {
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route('https://paired-count.invalid/**', route => route.fulfill({contentType: 'text/html',
      body: '<!doctype html><meta charset="utf-8"><body style="margin:0"><div id="map"></div>'}));
    await page.goto('https://paired-count.invalid/');
    await page.addStyleTag({content: assets.css});
    for (const content of [assets.d3, assets.svg, assets.baseline]) await page.addScriptTag({content});
    await page.evaluate(() => { globalThis.countVariants = {baseline: CGView.Slot.prototype.draw}; });
    await page.addScriptTag({content: assets.candidate});
    await page.evaluate(() => { countVariants.candidate = CGView.Slot.prototype.draw; });
    await page.addScriptTag({content: assets.helper});
    const result = await page.evaluate(async ({scenario, options}) => {
      const {generate, settle, statistics} = CGVRenderingBenchmark;
      const hash = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
        .map(value => value.toString(16).padStart(2, '0')).join('');
      let dataset = generate({...scenario, count: 1_000_000, labels: 0, seed: 42});
      const identity = dataset.identity;
      const viewer = new CGView.Viewer('#map', {width: 600, height: 600, SVGContext: svgcanvas.Context});
      viewer.io.loadJSON(dataset.json); dataset = null;
      await settle(viewer);
      await new Promise(resolve => viewer.zoomTo(Math.floor(viewer.sequence.length * 0.37), 10,
        {duration: 0, callback: resolve}));
      if (viewer.zoomFactor !== 10) throw new Error('Requested zoom was clamped');
      viewer.drawFull(); await settle(viewer);
      const slots = viewer.layout.visibleSlots().filter(slot => slot.hasFeatures);
      const descriptors = slots.map(slot => Object.getOwnPropertyDescriptor(slot, 'draw'));
      const select = variant => { for (const slot of slots) slot.draw = countVariants[variant]; };
      const pixels = () => {
        const node = viewer.canvas.node('map');
        return viewer.canvas.context('map').getImageData(0, 0, node.width, node.height).data;
      };
      try {
        const paired = [], samples = {baseline: [], candidate: []};
        for (let round = 0; round < options.warmups + options.iterations; round++) {
          const order = round % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate'];
          const pair = {round: round - options.warmups, order};
          for (const variant of order) {
            select(variant);
            await new Promise(resolve => requestAnimationFrame(resolve));
            const start = performance.now();
            viewer.drawExport();
            pair[variant] = performance.now() - start;
            if (round >= options.warmups) samples[variant].push(pair[variant]);
          }
          if (round >= options.warmups) paired.push({...pair, differenceMs: pair.baseline - pair.candidate});
        }
        const counts = [], countSamples = [];
        for (let iteration = 0; iteration < options.iterations; iteration++) {
          const start = performance.now();
          const values = slots.map(slot => slot._featureNCList.count(slot.visibleRange.start, slot.visibleRange.stop));
          countSamples.push(performance.now() - start);
          if (iteration === 0) counts.push(...values);
        }
        select('baseline'); viewer.drawExport(); const baselinePixels = pixels();
        select('candidate'); viewer.drawExport(); const candidatePixels = pixels();
        const equal = baselinePixels.length === candidatePixels.length && baselinePixels.every((value, i) => value === candidatePixels[i]);
        if (!equal) throw new Error('Baseline and candidate map pixels differ');
        return {dataset: identity, zoom: viewer.zoomFactor, width: viewer.width, height: viewer.height,
          pixelRatio: viewer.canvas.pixelRatio, featureCount: viewer.features().length,
          visibleFeatures: counts.reduce((sum, count) => sum + count, 0), visiblePerSlot: counts,
          paired, baseline: statistics(samples.baseline), candidate: statistics(samples.candidate),
          pairedDifference: statistics(paired.map(pair => pair.differenceMs)), countProbe: statistics(countSamples),
          pixels: {equal, baselineSha256: await hash(baselinePixels), candidateSha256: await hash(candidatePixels)},
          methods: Object.fromEntries(await Promise.all(Object.entries(countVariants).map(async ([name, method]) =>
            [name, await hash(new TextEncoder().encode(method.toString()))])))};
      } finally {
        slots.forEach((slot, i) => { if (descriptors[i]) Object.defineProperty(slot, 'draw', descriptors[i]); else delete slot.draw; });
      }
    }, {scenario, options});
    if (errors.length) throw new Error(errors.join('\n'));
    return result;
  };
  try {
    return await Promise.race([run(), new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Paired case exceeded 180 seconds')), 180_000);
    })]);
  } finally { clearTimeout(timer); await context.close(); }
}

let browser;
try {
  const paths = {css: 'docs/dist/cgview.css', d3: 'docs/scripts/d3.min.js', svg: 'docs/scripts/svgcanvas.iife.js',
    candidate: 'docs/dist/cgview.min.js', helper: 'docs/test/rendering-benchmark.js'};
  const assets = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, file]) => [key, await readFile(path.join(root, file), 'utf8')])));
  assets.baseline = await readFile(path.join(options.baselineRoot, 'docs/dist/cgview.min.js'), 'utf8');
  report.assetSha256 = Object.fromEntries(Object.entries(assets).map(([key, content]) => [key, sha256(content)]));
  browser = await chromium.launch({headless: true}); report.environment.chromium = browser.version();
  for (const format of ['circular', 'linear']) for (const decoration of ['arc', 'arrow']) {
    console.log(`Paired count experiment: ${format}/${decoration}`);
    const scenario = {format, decoration, status: 'running'}; report.scenarios.push(scenario);
    try { Object.assign(scenario, await runScenario(browser, scenario, assets), {status: 'complete'}); }
    catch (error) { scenario.status = 'failed'; scenario.error = error.message; throw error; }
    finally { await save(); }
  }
  report.status = 'complete';
} catch (error) { report.status = 'failed'; report.error = error.message; process.exitCode = 1; }
finally { await browser?.close(); await save(); }
