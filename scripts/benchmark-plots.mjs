#!/usr/bin/env node

import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const options = {iterations: 20, warmups: 5, reverse: false,
  output: path.join(root, '.benchmark-results/plots.json')};
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === '--reverse') options.reverse = true;
  else if (arg === '--output') options.output = path.resolve(process.argv[++i]);
  else if (arg === '--iterations' || arg === '--warmups') {
    const value = Number(process.argv[++i]);
    if (!Number.isInteger(value) || value < (arg === '--iterations' ? 1 : 0)) {
      throw new Error(`Invalid ${arg}`);
    }
    options[arg.slice(2)] = value;
  } else if (arg === '--help') {
    console.log('Usage: yarn benchmark:plots [--iterations 20] [--warmups 5] [--reverse] [--output PATH]\nBuild first with yarn gh-pages. Compares original, contour, and contour without outline in the same bundle.');
    process.exit(0);
  } else throw new Error(`Unknown argument: ${arg}`);
}

const variants = [
  {id: 'legacy', settings: {plotRenderer: 'legacy', showPlotOutline: true}},
  {id: 'contour', settings: {plotRenderer: 'contour', showPlotOutline: true}},
  {id: 'contour-no-outline', settings: {plotRenderer: 'contour', showPlotOutline: false}},
];
const scenarios = [
  ...[128, 10_000, 100_000, 1_000_000].flatMap(count =>
    ['circular', 'linear'].map(format => ({id: `synthetic-${count}-${format}`, count, format}))),
  ...['circular', 'linear'].map(format => ({id: `lentzea-${format}`, format,
    fixture: 'docs/test/maps/large_lentzea.json'})),
];

/** Summarize timings without discarding the raw samples saved in the report. */
function statistics(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  return {median: sorted[Math.ceil(sorted.length * 0.5) - 1],
    p90: sorted[Math.ceil(sorted.length * 0.9) - 1]};
}

/**
 * Measure one map in an isolated context. Variants share a viewer and alternate
 * order each round; setup, extraction, and setting changes are outside timings.
 * @param {import('@playwright/test').Browser} browser - Running Chromium.
 * @param {Object} scenario - Synthetic dimensions or real fixture path.
 * @param {Number} scenarioIndex - Rotates the initial variant order.
 * @returns {Promise<Object>} Raw timings and map metadata. Creates/closes a context.
 */
async function runScenario(browser, scenario, scenarioIndex) {
  const context = await browser.newContext({viewport: {width: 800, height: 800}, deviceScaleFactor: 1});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.setContent('<!doctype html><html><body><div id="map"></div></body></html>');
    await page.addStyleTag({path: path.join(root, 'docs/dist/cgview.css')});
    for (const file of ['docs/scripts/d3.min.js', 'docs/scripts/svgcanvas.iife.js',
      'docs/dist/cgview.js', 'docs/test/performance.js']) {
      await page.addScriptTag({path: path.join(root, file)});
    }
    const fixture = scenario.fixture ? JSON.parse(await readFile(path.join(root, scenario.fixture), 'utf8')) : undefined;
    const result = await page.evaluate(async ({scenario, scenarioIndex, fixture, variants, options}) => {
      const viewer = new CGView.Viewer('#map', {width: 600, height: 600, SVGContext: svgcanvas.Context});
      if (fixture) {
        viewer.io.loadJSON(fixture);
        viewer.settings.update({format: scenario.format});
      } else {
        const length = 1_000_000;
        const positions = Array.from({length: scenario.count}, (_, i) => 1 + Math.floor(i * length / scenario.count));
        // Deterministic broad waves plus narrow spikes, independent of sampling density.
        const scores = positions.map(bp => 0.6 * Math.sin(bp / 7500) +
          0.25 * Math.sin(bp / 137) + (bp % 20000 < 100 ? 0.15 : 0));
        viewer.io.loadJSON({cgview: {
          version: CGView.version,
          sequence: {length}, settings: {format: scenario.format},
          annotation: {visible: false},
          legend: {items: [{name: 'Positive', swatchColor: '#36844b'}, {name: 'Negative', swatchColor: '#864ca6'}]},
          plots: [{name: 'Signal', source: 'benchmark', positions, scores, baseline: 0,
            axisMin: -1, axisMax: 1, legendPositive: 'Positive', legendNegative: 'Negative'}],
          tracks: [{name: 'Signal', position: 'inside', dataType: 'plot', dataMethod: 'source', dataKeys: ['benchmark']}],
        }});
      }
      // Reuse the established harness's extraction, zoom, and full-draw readiness checks.
      const helper = new CGVPerformance(viewer, scenario.id, 1, {warmupIterations: 0, zoomLevels: [1]});
      await helper.ready;
      const records = [];
      for (const zoom of [1, 10, 1000]) {
        await helper.zoomTo(zoom);
        await helper.waitUntil(() => !viewer.layout.fullDrawInProgress, 'zoom full draw');
        const slots = viewer.layout.visibleSlots().filter(slot => slot._plot);
        if (!slots.length) throw new Error('Scenario contains no visible plot slots');
        const byVariant = Object.fromEntries(variants.map(variant => [variant.id,
          {drawFast: [], drawFull: [], plotsFast: [], plotsFull: []}]));
        for (let round = 0; round < options.warmups + options.iterations; round++) {
          const ordered = options.reverse ? [...variants].reverse() : [...variants];
          const offset = (round + scenarioIndex) % ordered.length;
          ordered.push(...ordered.splice(0, offset));
          for (const variant of ordered) {
            viewer.settings.update(variant.settings);
            await helper.waitUntil(() => !viewer.layout.fullDrawInProgress, 'setting redraw');
            const samples = byVariant[variant.id];
            const record = (metric, value) => {
              if (round >= options.warmups) samples[metric].push(value);
            };
            let start = performance.now();
            viewer.drawFast();
            record('drawFast', performance.now() - start);
            start = performance.now();
            viewer.drawFull();
            await helper.waitUntil(() => !viewer.layout.fullDrawInProgress, 'full draw');
            record('drawFull', performance.now() - start);
            for (const fast of [true, false]) {
              viewer.clear('map');
              start = performance.now();
              for (const slot of slots) slot.draw(viewer.canvas, fast);
              record(fast ? 'plotsFast' : 'plotsFull', performance.now() - start);
            }
            // Give the browser a presentation opportunity outside measured work.
            await new Promise(resolve => requestAnimationFrame(resolve));
          }
        }
        records.push({zoom, visibleRange: viewer.backbone.visibleRange.length, byVariant});
      }
      return {records, width: viewer.width, height: viewer.height,
        featureCount: viewer.features().length,
        plots: viewer.plots().map(plot => ({name: plot.name, count: plot.positions.length})),
        pixelRatio: viewer.canvas.pixelRatio};
    }, {scenario, scenarioIndex, fixture, variants, options});
    if (errors.length) throw new Error(errors.join('; '));
    return {...scenario, ...result};
  } finally {
    await context.close();
  }
}

async function main() {
  const bundle = await readFile(path.join(root, 'docs/dist/cgview.js'));
  const browser = await chromium.launch({headless: true});
  const report = {schemaVersion: 1, generatedAt: new Date().toISOString(), options, variants,
    environment: {node: process.version, chromium: browser.version(), platform: process.platform,
      architecture: process.arch},
    revision: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(),
    worktreeStatus: execFileSync('git', ['status', '--short'], {cwd: root, encoding: 'utf8'}),
    bundleSha256: createHash('sha256').update(bundle).digest('hex'), scenarios: [], comparisons: []};
  try {
    for (let index = 0; index < scenarios.length; index++) {
      console.log(`Benchmarking ${index + 1}/${scenarios.length}: ${scenarios[index].id}`);
      report.scenarios.push(await runScenario(browser, scenarios[index], index));
    }
    for (const scenario of report.scenarios) {
      for (const record of scenario.records) {
        for (const metric of ['drawFast', 'drawFull', 'plotsFast', 'plotsFull']) {
          const summaries = Object.fromEntries(variants.map(variant =>
            [variant.id, statistics(record.byVariant[variant.id][metric])]));
          report.comparisons.push({scenario: scenario.id, zoom: record.zoom, metric, summaries});
        }
      }
    }
    await mkdir(path.dirname(options.output), {recursive: true});
    await writeFile(options.output, `${JSON.stringify(report, null, 2)}\n`);
    const lines = ['# Plot renderer comparison', '',
      `${options.iterations} measured rounds after ${options.warmups} warm-ups; rotating variant order; 600 x 600 CSS pixels, DPR 1.`, '',
      'Times are milliseconds. Full viewer timings include progressive drawing and timer delays; plot-only timings measure synchronous plot-slot drawing. Neither is a GPU completion or interaction FPS measurement.', '',
      '| Scenario | Zoom | Metric | Original median | Contour median | No-outline median | Contour / original |',
      '| --- | ---: | --- | ---: | ---: | ---: | ---: |'];
    for (const row of report.comparisons) {
      const old = row.summaries.legacy.median;
      const current = row.summaries.contour.median;
      lines.push(`| ${row.scenario} | ${row.zoom} | ${row.metric} | ${old.toFixed(2)} | ${current.toFixed(2)} | ${row.summaries['contour-no-outline'].median.toFixed(2)} | ${old > 0 ? (current / old).toFixed(2) + 'x' : 'n/a'} |`);
    }
    const markdownPath = options.output.replace(/\.json$/, '') + '.md';
    await writeFile(markdownPath, `${lines.join('\n')}\n`);
    console.log(`Raw results: ${options.output}\nSummary: ${markdownPath}`);
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
