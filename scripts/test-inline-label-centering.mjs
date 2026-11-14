// Build first; compare against a bundle built from the target branch.
// node scripts/test-inline-label-centering.mjs --baseline /path/to/baseline.js
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium, webkit} from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baselineFlag = process.argv.indexOf('--baseline');
assert.ok(baselineFlag >= 0, 'Provide --baseline pointing to an unmodified target-branch bundle');
const baseline = path.resolve(process.argv[baselineFlag + 1]);
const screenshotsOnly = process.argv.includes('--screenshots-only');
const output = path.join(root, '.agents/area-weighted-labels/browser');
await mkdir(output, {recursive: true});
const html = `<!doctype html><meta charset="utf-8"><title>CGView inline-label comparison</title>
<style>body{margin:0;background:white;font:18px Arial;color:#243b48}header{padding:20px 28px;font-size:24px;font-weight:bold}main{display:flex;gap:16px;padding:0 16px}h2{margin:10px 12px;font-size:20px}p{margin:16px 28px;color:#536873}</style>
<header id="title"></header><main><section><h2>Before · full-span center</h2><div id="before"></div></section><section><h2>After · area-weighted center</h2><div id="after"></div></section></main>
<p>Actual CGView rendering; identical data, geometry, fonts, and settings.</p>
<script src="/baseline.js"></script><script>window.Before=CGView;</script><script src="/current.js"></script>`;
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost').pathname;
  if (url === '/') { response.setHeader('Content-Type', 'text/html'); response.end(html); return; }
  const file = url === '/baseline.js' ? baseline : url === '/current.js' ?
    path.join(root, 'docs/dist/cgview.standalone.min.js') : undefined;
  if (!file) { response.writeHead(404).end(); return; }
  response.setHeader('Content-Type', 'text/javascript'); response.end(await readFile(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const results = [], errors = [], timings = [], pans = [];
try {
  for (const [engineName, engine] of (screenshotsOnly ? [['chromium', chromium]] : [['chromium', chromium], ['webkit', webkit]])) {
    const browser = await engine.launch({headless: true});
    try {
      const page = await browser.newPage({viewport: {width: 1472, height: 850}, deviceScaleFactor: 1});
      page.on('pageerror', error => errors.push({engine: engineName, error: error.message}));
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      await page.evaluate(() => {
        window.setup = (format, head, variant = 'ordinary') => {
          for (const v of window.viewers || []) {
            v.stopAnimate(); clearTimeout(v.layout._slotTimeoutID); v.annotation._externalLabels.destroy();
          }
          document.querySelector('#before').replaceChildren(); document.querySelector('#after').replaceChildren();
          const features = [];
          for (const [j, source] of ['outside', 'inside'].entries()) {
            for (let i = 0; i < 4; i++) {
              const strand = (i + j) % 2 ? -1 : 1;
              features.push({name: `gene${String.fromCharCode(65 + i)}`, start: 300 + i * 2500,
                stop: 1700 + i * 2500, strand, source, legend: strand === 1 ? 'Forward' : 'Reverse'});
            }
          }
          if (variant === 'wrapped') {
            features[0].start = 9600; features[0].stop = 900;
            features[4].start = 9600; features[4].stop = 900;
            features[1].locations = [[2800, 3100], [3400, 4200]];
            features[5].locations = [[2800, 3100], [3400, 4200]];
          }
          if (variant === 'long') features.forEach(f => { f.name = 'A long protein description'; });
          if (variant === 'dense') {
            features.length = 0;
            for (let i = 0; i < 10000; i++) features.push({name: `f${i}`, start: i + 1,
              stop: Math.min(10000, i + 4), strand: i % 2 ? -1 : 1, source: i % 2 ? 'outside' : 'inside', legend: 'Forward'});
          }
          if (variant === 'overlap') {
            features.length = 0;
            for (let i = 0; i < 1000; i++) features.push({name: `gene${i % 4}`,
              start: 300 + (i % 4) * 2500, stop: 1700 + (i % 4) * 2500,
              strand: i % 2 ? -1 : 1, source: i % 2 ? 'outside' : 'inside', legend: 'Forward'});
          }
          const options = {width: 720, height: format === 'linear' ? 320 : 700, sequence: {length: 10000},
            features, annotation: {font: 'sans-serif, plain, 18', labelPosition: 'inline',
              inlineLabelAllowTruncation: variant === 'long'},
            legend: {visible: false, items: [{name: 'Forward', decoration: 'auto', swatchColor: '#236b83'},
              {name: 'Reverse', decoration: 'auto', swatchColor: '#996137'}]},
            settings: {arrowHeadLength: head, showShading: false, showBorder: false,
              showTrackLabels: false, initialMapThicknessProportion: 0.14, maxMapThicknessProportion: 0.25, maxSlotThickness: 40},
            tracks: ['outside', 'inside'].map(position => ({name: position, position,
              dataType: 'feature', dataMethod: 'source', dataKeys: position, separateFeaturesBy: 'none'}))};
          window.viewers = [new Before.Viewer('#before', structuredClone(options)),
            new CGView.Viewer('#after', structuredClone(options))];
          for (const v of viewers) {
            v.addTracks(structuredClone(options.tracks));
            v.format = format;
            const r = v.annotation._featureLabelRenderer;
            r.originalMetricsFor = r.metricsFor;
            r.metricsFor = function(feature, ...args) {
              const metrics = this.originalMetricsFor(feature, ...args);
              if (metrics) v.captured.set(feature.cgvID, {feature, metrics, args});
              return metrics;
            };
            v.captured = new Map();
          }
        };
        window.setView = async (bp, zoom) => {
          await Promise.all(viewers.map(v => new Promise(resolve => v.zoomTo(bp, zoom, {duration: 0, callback: resolve}))));
          viewers.forEach(v => {v.captured.clear();v.drawExport();});
        };
        window.validate = (pixels = false) => viewers.map(v => {
          const renderer = v.annotation._featureLabelRenderer, rows = [], ctx = v.canvas.context('ui');
          for (const {feature, metrics: m, args} of v.captured.values()) {
            const [center, thickness, range] = args;
            if (![m.bp, m.fontSize, m.textWidth, m.availableWidth].every(Number.isFinite)) throw Error('Non-finite label metrics');
            if (m.textWidth > m.availableWidth + 0.02) throw Error('Text exceeds its available width');
            let outside = 0, ink = 0;
            if (pixels) {
              ctx.clearRect(0, 0, v.width, v.height);
              feature.draw('ui', center, thickness, range, {color: 'black', showShading: false});
              const shape = ctx.getImageData(0, 0, v.width, v.height).data;
              ctx.clearRect(0, 0, v.width, v.height);
              const black = {...m, color: {rgbaString: 'black'}};
              if (v.format === 'circular') renderer._drawCurvedLabel(feature, black, 'ui');
              else renderer._drawStraightLabel(ctx, feature, black);
              const text = ctx.getImageData(0, 0, v.width, v.height).data;
              for (let i = 3; i < text.length; i += 4) if (text[i] > 128) {
                ink++; if (shape[i] < 32) outside++;
              }
              ctx.clearRect(0, 0, v.width, v.height);
            }
            rows.push({name: feature.name, id: feature.cgvID, strand: feature.strand, bp: m.bp,
              text: m.text, fontSize: m.fontSize, textWidth: m.textWidth, outside, ink,
              pixelsPerBp: m.pixelsPerBp, thickness: feature.adjustedWidth(thickness),
              angle: v.format === 'circular' ? v.canvas.tangentialTextOrientationForBp(m.bp).angle : 0});
          }
          return rows;
        });
      });
      for (const format of ['linear', 'circular']) {
        for (const variant of screenshotsOnly ? ['ordinary'] : ['ordinary', 'wrapped', 'long']) {
          for (const head of screenshotsOnly ? [1] : [0, 0.3, 1]) {
            await page.evaluate(({format, head, variant}) => setup(format, head, variant), {format, head, variant});
            for (const [bp, zoom] of [[0, 1], [1000, 3], [9600, 6], [3450, 12]]) {
              await page.evaluate(({bp, zoom}) => setView(bp, zoom), {bp, zoom});
              const rows = await page.evaluate(() => validate(true));
              const [before, after] = rows;
              if (variant === 'ordinary' && zoom === 1) assert.equal(after.length, 8, 'All eight overview labels must be exercised');
              assert.equal(after.length, before.length, 'Changed the number of fitted labels');
              for (let i = 0; i < after.length; i++) {
                assert.equal(after[i].text, before[i].text, 'Changed truncation');
                assert.equal(after[i].fontSize, before[i].fontSize, 'Changed font size');
                assert.ok(after[i].outside <= before[i].outside, `Introduced escaped text pixels: ${JSON.stringify({engineName, format, variant, head, bp, zoom, before: before[i], after: after[i]})}`);
                if (head === 0) assert.equal(after[i].bp, before[i].bp, 'Moved a rectangle label');
                let shift = before[i].bp - after[i].bp;
                if (shift > 5000) shift -= 10000;
                if (shift < -5000) shift += 10000;
                assert.ok(shift * after[i].strand >= -1e-6, 'Moved label toward the arrow tip');
                assert.ok(Math.abs(shift * after[i].pixelsPerBp) <= after[i].thickness * head / 2 + 1e-6, 'Anchor displacement exceeds half the head');
                assert.ok(Math.abs(after[i].angle) <= Math.PI / 2 + 1e-6, 'Upside-down text');
              }
              results.push({engine: engineName, format, variant, head, bp, zoom, rows});
              if (variant === 'ordinary' && head === 1 && [1, 3].includes(zoom)) {
                const svg = await page.evaluate(() => viewers[1].io.getSVG());
                assert.ok(svg.includes('<svg') && !svg.includes('NaN'), 'Invalid SVG export');
                await writeFile(path.join(output, `${engineName}-${format}-${zoom}x.svg`), svg);
                if (engineName === 'chromium') {
                  await page.evaluate(({format, zoom}) => {document.querySelector('#title').textContent = `CGView ${format} map · ${zoom}× zoom · both strands, inside and outside tracks`;}, {format, zoom});
                  await page.setViewportSize({width: 1488, height: format === 'linear' ? 480 : 860});
                  await page.screenshot({path: path.join(output, `${format}${zoom === 3 ? '-detail' : ''}-before-after.png`), fullPage: true});
                }
              }
            }
          }
        }
      }
      if (!screenshotsOnly) for (const format of ['linear', 'circular']) {
        await page.evaluate(format => setup(format, 1), format);
        for (const index of [0, 4]) {
          const pan = await page.evaluate(async index => {
            const v = viewers[1], feature = v.features()[index], strand = feature.strand;
            const tip = strand === 1 ? feature.stop : feature.start;
            const slot = v.slots().find(s => s.features().includes(feature));
            // Locate tip entry for the actual slot geometry, then pan through
            // the whole head in half-pixel steps at high zoom.
            let lo = 0, hi = 1500;
            for (let i = 0; i < 14; i++) {
              const t = (lo + hi) / 2;
              await setView(tip - strand * t, 12);
              const range = v.canvas.visibleRangeForCenterOffset(slot.centerOffset, {margin: slot.thickness, float: true});
              let outside = strand === 1 ? tip - range.stop : range.start - tip;
              if (outside > 5000) outside -= 10000;
              if (outside < -5000) outside += 10000;
              if (outside > 0) hi = t; else lo = t;
            }
            const boundary = tip - strand * (lo + hi) / 2;
            const scale = v.canvas.pixelsPerBp(slot.centerOffset);
            const samples = [];
            for (let offset = -45; offset <= 5; offset += 0.5) {
              await setView(boundary + strand * offset / scale, 12);
              const rows = validate(offset % 5 === 0);
              const pair = rows.map(r => r.find(row => row.name === feature.name && row.strand === strand));
              if (pair.some(row => !row)) throw Error('Pan did not exercise the target label');
              if (pair[1].outside > pair[0].outside) throw Error('Text escaped feature during pan');
              const previous = samples.at(-1);
              if (previous) {
                const beforeStep = Math.abs(pair[0].bp - previous.before) * scale;
                const afterStep = Math.abs(pair[1].bp - previous.after) * scale;
                if (afterStep > beforeStep + 0.6) throw Error(`Introduced pan jump: ${JSON.stringify({offset, beforeStep, afterStep})}`);
              }
              samples.push({offset, before: pair[0].bp, after: pair[1].bp});
            }
            return {strand, position: slot.position, samples};
          }, index);
          pans.push({engine: engineName, format, ...pan});
        }
      }
      // Warm-cache timing, alternating execution order to reduce order bias.
      // Report actual complete redraws as well as the placement calculation.
      for (const format of screenshotsOnly ? [] : ['linear', 'circular']) for (const variant of ['ordinary', 'dense', 'overlap']) {
        await page.evaluate(({format, variant}) => setup(format, 1, variant), {format, variant});
        await page.evaluate(() => setView(0, 1));
        const timing = await page.evaluate(() => {
          const median = a => [...a].sort((x,y)=>x-y)[Math.floor(a.length/2)];
          for (const v of viewers) v.annotation._featureLabelRenderer.metricsFor = v.annotation._featureLabelRenderer.originalMetricsFor;
          const jobs = viewers.map(v => {
            const r = v.annotation._featureLabelRenderer;
            const entries = [...v.captured.values()];
            return {v, r, entries, draw: [], placement: []};
          });
          for (let round = 0; round < 13; round++) for (const j of round % 2 ? [...jobs].reverse() : jobs) {
            let start = performance.now();
            for (let n = 0; n < 10; n++) j.v.drawExport();
            const draw = (performance.now() - start) / 10;
            start = performance.now();
            const repeats = Math.max(1, Math.ceil(8000 / Math.max(1, j.entries.length)));
            for (let n = 0; n < repeats; n++) for (const {feature, args} of j.entries) j.r.metricsFor(feature, ...args);
            const placement = j.entries.length ? (performance.now() - start) * 1000 / (repeats * j.entries.length) : null;
            if (round >= 4) {j.draw.push(draw); if (placement !== null) j.placement.push(placement);}
          }
          return jobs.map(j=>({features:j.v.features().length, fittedLabels:j.entries.length,
            medianRedrawMs:median(j.draw), medianPer1000PlacementsMs:j.placement.length?median(j.placement):null,
            redrawSamplesMs:j.draw, placementSamplesMs:j.placement}));
        });
        timings.push({engine: engineName, format, variant, before: timing[0], after: timing[1]});
      }
      console.log(`${engineName}: visual/geometry matrix and timing complete`);
    } finally {await browser.close();}
  }
  assert.deepEqual(errors, []);
} finally {
  await writeFile(path.join(output, screenshotsOnly ? 'screenshots.json' : 'results.json'), JSON.stringify({results, pans, timings, errors}, null, 2));
  server.close();
}
console.log(JSON.stringify({cases: results.length, timings, errors}));
