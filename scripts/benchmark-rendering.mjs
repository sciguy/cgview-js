#!/usr/bin/env node

import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';

// Run scenarios serially in fresh browser contexts, retaining raw measurements.
// Usage: cgview-run yarn benchmark:rendering --counts 10000 --output results.json
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const launchArguments = ['--enable-precise-memory-info'];

function help() {
  console.log(`Usage: cgview-run yarn benchmark:rendering [options]

Build first with cgview-run yarn gh-pages. Each scenario gets a fresh browser
context. Results and a sibling Markdown summary are saved after every scenario.

  --counts LIST          Feature counts (default: 10000,50000,100000,500000,1000000)
  --formats LIST         circular,linear (default: both)
  --decorations LIST     arc,arrow (default: both)
  --zooms LIST           Positive zoom factors (default: 1,10,1000)
  --iterations NUMBER    Measured rounds per zoom (default: 5)
  --warmups NUMBER       Unmeasured rounds per zoom (default: 2)
  --frames NUMBER        Interaction frames per zoom, at least 2 (default: 12)
  --seed NUMBER          Unsigned 32-bit dataset seed (default: 42)
  --labels NUMBER        Target label count (default: 0)
  --plot-points NUMBER   Plot sample count (default: 0)
  --shading              Enable feature shading (default: disabled)
  --profile              Include separate instrumented profiling runs
  --timeout SECONDS      Maximum time per scenario (default: 180)
  --baseline-root PATH   Use a different checkout's built library and assets;
                        benchmark helpers always come from this checkout
  --output PATH          JSON path (default: .benchmark-results/rendering.json)
  --help                Show this help

Canvas size is 600 x 600 CSS pixels at DPR 1. A failed scenario is saved before
the process exits unsuccessfully. Timings measure browser CPU and wall time,
not GPU completion; animation frame intervals are reported separately.`);
}

function numeric(value, argument, minimum, integer = true, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!value.trim() || !Number.isFinite(parsed) || parsed < minimum || parsed > maximum ||
      (integer && !Number.isSafeInteger(parsed))) {
    throw new Error(`${argument} must be ${integer ? 'an integer' : 'a number'} from ${minimum} to ${maximum}`);
  }
  return parsed;
}

function list(value, argument, parse) {
  const items = value.split(',').map(item => item.trim());
  if (items.some(item => !item)) throw new Error(`${argument} needs a nonempty comma-separated list`);
  return [...new Set(items.map(item => parse(item, argument)))];
}

function choice(value, argument, choices) {
  if (!choices.includes(value)) throw new Error(`${argument} accepts only ${choices.join(',')}`);
  return value;
}

function parseArguments(argv) {
  const options = {
    counts: [10_000, 50_000, 100_000, 500_000, 1_000_000],
    formats: ['circular', 'linear'], decorations: ['arc', 'arrow'], zooms: [1, 10, 1000],
    iterations: 5, warmups: 2, frames: 12, seed: 42, labels: 0, plotPoints: 0,
    shading: false, profile: false, width: 600, height: 600, timeout: 180,
    output: path.join(root, '.benchmark-results/rendering.json'), baselineRoot: undefined,
  };
  const parsers = {
    '--counts': value => { options.counts = list(value, '--counts', item => numeric(item, '--counts', 1)); },
    '--formats': value => {
      options.formats = list(value, '--formats', item => choice(item, '--formats', ['circular', 'linear']));
    },
    '--decorations': value => {
      options.decorations = list(value, '--decorations', item => choice(item, '--decorations', ['arc', 'arrow']));
    },
    '--zooms': value => {
      options.zooms = list(value, '--zooms', item => numeric(item, '--zooms', Number.MIN_VALUE, false));
    },
    '--iterations': value => { options.iterations = numeric(value, '--iterations', 1); },
    '--warmups': value => { options.warmups = numeric(value, '--warmups', 0); },
    '--frames': value => { options.frames = numeric(value, '--frames', 2); },
    '--seed': value => { options.seed = numeric(value, '--seed', 0, true, 0xffffffff); },
    '--labels': value => { options.labels = numeric(value, '--labels', 0); },
    '--plot-points': value => { options.plotPoints = numeric(value, '--plot-points', 0); },
    '--timeout': value => { options.timeout = numeric(value, '--timeout', Number.MIN_VALUE, false, 2147483); },
    '--output': value => { options.output = path.resolve(value); },
    '--baseline-root': value => { options.baselineRoot = path.resolve(value); },
  };
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === '--help') { help(); return undefined; }
    if (argument === '--shading' || argument === '--profile') {
      options[argument.slice(2)] = true;
      continue;
    }
    if (!Object.hasOwn(parsers, argument)) throw new Error(`Unknown argument: ${argument}. Use --help for options.`);
    const value = argv[++index];
    if (value === undefined || !value.trim() || value.startsWith('--')) {
      throw new Error(`Missing value for ${argument}`);
    }
    parsers[argument](value);
  }
  return options;
}

function gitMetadata(directory) {
  try {
    const git = args => execFileSync('git', args, {cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
    return {root: directory, revision: git(['rev-parse', 'HEAD']).trim(),
      worktreeStatus: git(['status', '--short'])};
  } catch (error) {
    return {root: directory, revision: null, worktreeStatus: null, error: error.message};
  }
}

/** Read Chromium's GPU status without making missing diagnostics fail a run. */
async function gpuMetadata(browser) {
  let session;
  let timeout;
  try {
    return await Promise.race([(async () => {
      session = await browser.newBrowserCDPSession();
      const {gpu} = await session.send('SystemInfo.getInfo');
      return {available: true, devices: gpu.devices, featureStatus: gpu.featureStatus,
        auxAttributes: gpu.auxAttributes, driverBugWorkarounds: gpu.driverBugWorkarounds};
    })(), new Promise((resolve, reject) => {
      timeout = setTimeout(() => reject(new Error('GPU information request exceeded 5 seconds')), 5000);
    })]);
  } catch (error) {
    return {available: false, error: error.message};
  } finally {
    clearTimeout(timeout);
    await session?.detach().catch(() => {});
  }
}

function formatted(value) {
  return Number.isFinite(value) ? value.toFixed(2) : 'n/a';
}

function escapeCell(value) {
  return String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function markdownReport(report) {
  const lines = ['# CGView rendering benchmark', '',
    `Status: ${report.status}. ${report.scenarios.filter(item => item.status === 'complete').length}/${report.plannedScenarios} scenarios completed.`, '',
    `Chromium ${report.environment.chromium || 'not launched'}; Node ${report.environment.node}; ${report.environment.os.type} ${report.environment.os.release} (${report.environment.architecture}).`, '',
    `${report.options.iterations} measured rounds after ${report.options.warmups} warm-ups; ${report.options.frames} interaction frames; ${report.options.width} x ${report.options.height} CSS pixels at DPR 1.`, '',
    `Bundle SHA-256: \`${report.bundleSha256}\`. Revision: \`${report.target.revision || 'unavailable'}\`.`, '',
    'Times are milliseconds. Fast and export draw measure synchronous Canvas rendering; export draw excludes SVG serialization and file encoding. Full draw includes progressive scheduling. Frame intervals include browser presentation opportunities and host scheduling. These are not GPU-completion measurements. Instrumented profiles run separately from primary timings.', '',
    '| Scenario | Zoom | Visible features | Fast median | Fast p90 | Full median | Full p90 | Export median | Frame median | Frame p90 | Interaction CPU median |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |'];
  for (const scenario of report.scenarios) {
    for (const record of scenario.records || []) {
      lines.push(`| ${scenario.id} | ${record.zoom} | ${record.visibleFeatures ?? 'n/a'} | ${formatted(record.drawFast?.median)} | ${formatted(record.drawFast?.p90)} | ${formatted(record.drawFull?.median)} | ${formatted(record.drawFull?.p90)} | ${formatted(record.drawExport?.median)} | ${formatted(record.interaction?.frameIntervals?.median)} | ${formatted(record.interaction?.frameIntervals?.p90)} | ${formatted(record.interaction?.cpu?.median)} |`);
    }
  }
  const setups = report.scenarios.filter(scenario => scenario.setup);
  if (setups.length) {
    lines.push('', '## Setup', '', 'Times are milliseconds. Load plus active draws waits only for already-started progressive work; it does not establish first-render completion because loading schedules an asynchronous transition. Heap observations are MiB of JavaScript heap without forced collection; they exclude Canvas and GPU memory.', '',
      '| Scenario | Generate | Create viewer | Load synchronous | Load + active draws | Heap after load |',
      '| --- | ---: | ---: | ---: | ---: | ---: |');
    for (const scenario of setups) {
      const setup = scenario.setup;
      const heap = scenario.memory?.afterLoad?.usedJSHeapSize;
      lines.push(`| ${scenario.id} | ${formatted(setup.generationMs)} | ${formatted(setup.viewerCreationMs)} | ${formatted(setup.loadJSONSyncMs)} | ${formatted(setup.loadJSONSettledMs)} | ${formatted(heap === undefined ? undefined : heap / 1048576)} |`);
    }
  }
  const failures = report.scenarios.filter(scenario => scenario.status === 'failed');
  if (failures.length || report.error) {
    lines.push('', '## Failure', '');
    for (const scenario of failures) lines.push(`- ${scenario.id}: ${escapeCell(scenario.error.message)}`);
    if (!failures.length && report.error) lines.push(escapeCell(report.error.message));
  }
  return `${lines.join('\n')}\n`;
}

async function saveReport(report, output) {
  report.updatedAt = new Date().toISOString();
  await mkdir(path.dirname(output), {recursive: true});
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  const markdownPath = /\.json$/i.test(output) ? output.replace(/\.json$/i, '.md') : `${output}.md`;
  await writeFile(markdownPath, markdownReport(report));
}

/**
 * Measure a scenario in a fresh context, closing it on success, errors, or timeout.
 * @param {import('@playwright/test').Browser} browser - Running Chromium instance.
 * @param {Object} scenario - Feature count, layout, and decoration.
 * @param {Object} options - Validated CLI settings passed to the browser harness.
 * @param {Object[]} scripts - Ordered frozen script content, source paths, and hashes.
 * @param {Object} stylesheet - Frozen CSS content, source path, and hash.
 * @returns {Promise<Object>} Raw browser measurements; rejects on browser errors.
 */
async function runScenario(browser, scenario, options, scripts, stylesheet) {
  let context;
  let timeout;
  let finished = false;
  const browserErrors = [];
  let rejectBrowserError;
  const errors = new Promise((resolve, reject) => { rejectBrowserError = reject; });
  const reportError = error => {
    const message = error instanceof Error ? error.message : String(error);
    browserErrors.push(message);
    rejectBrowserError(new Error(message));
  };
  const work = async () => {
    context = await browser.newContext({viewport: {width: options.width, height: options.height}, deviceScaleFactor: 1});
    if (finished) {
      await context.close();
      throw new Error('Scenario ended before its browser context was created');
    }
    const page = await context.newPage();
    page.on('pageerror', reportError);
    page.on('crash', () => reportError('Chromium page crashed'));
    page.on('console', message => { if (message.type() === 'error') reportError(message.text()); });
    await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0"><div id="map"></div></body></html>');
    await page.addStyleTag({content: stylesheet.content});
    for (const script of scripts) await page.addScriptTag({content: script.content});
    const {iterations, warmups, frames, seed, labels, plotPoints, shading, profile, zooms, width, height} = options;
    return page.evaluate(runOptions => globalThis.CGVRenderingBenchmark.run(runOptions), {
      ...scenario, iterations, warmups, frames, seed, labels, plotPoints, shading, profile, zooms, width, height,
    });
  };
  try {
    return await Promise.race([work(), errors, new Promise((resolve, reject) => {
      timeout = setTimeout(() => reject(new Error(`Scenario exceeded ${options.timeout} seconds`)), options.timeout * 1000);
    })]);
  } catch (error) {
    error.browserErrors = browserErrors;
    throw error;
  } finally {
    finished = true;
    clearTimeout(timeout);
    await context?.close();
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (!options) return;
  const libraryRoot = options.baselineRoot || root;
  const scriptPaths = ['docs/scripts/d3.min.js', 'docs/scripts/svgcanvas.iife.js', 'docs/dist/cgview.min.js']
    .map(file => path.join(libraryRoot, file))
    .concat(['docs/test/rendering-profile.js', 'docs/test/rendering-benchmark.js'].map(file => path.join(root, file)));
  const readAsset = async file => {
    const buffer = await readFile(file);
    return {path: file, sha256: createHash('sha256').update(buffer).digest('hex'), content: buffer.toString('utf8')};
  };
  const scripts = await Promise.all(scriptPaths.map(readAsset));
  const stylesheet = await readAsset(path.join(libraryRoot, 'docs/dist/cgview.css'));
  const assetMetadata = ({path: assetPath, sha256}) => ({path: assetPath, sha256});
  const scenarios = options.counts.flatMap(count => options.formats.flatMap(format =>
    options.decorations.map(decoration => ({id: `${count}-${format}-${decoration}`, count, format, decoration}))));
  const cpus = os.cpus();
  const report = {
    schemaVersion: 1, generatedAt: new Date().toISOString(), status: 'running', options,
    environment: {node: process.version, chromium: null, platform: process.platform,
      architecture: process.arch, os: {type: os.type(), release: os.release(), version: os.version()},
      cpu: {model: cpus[0]?.model || 'unknown', logicalCores: cpus.length, speedMHz: cpus[0]?.speed},
      memory: {totalBytes: os.totalmem(), freeBytesAtStart: os.freemem()},
      headless: true, deviceScaleFactor: 1, launchArguments},
    target: gitMetadata(libraryRoot), harness: gitMetadata(root),
    bundleSha256: scripts[2].sha256, scripts: scripts.map(assetMetadata),
    stylesheet: assetMetadata(stylesheet), plannedScenarios: scenarios.length, scenarios: [],
  };
  await saveReport(report, options.output);
  let browser;
  try {
    browser = await chromium.launch({headless: true, args: launchArguments});
    report.environment.chromium = browser.version();
    report.environment.gpu = await gpuMetadata(browser);
    for (let index = 0; index < scenarios.length; index++) {
      const scenario = scenarios[index];
      const startedAt = new Date().toISOString();
      const start = performance.now();
      console.log(`Benchmarking ${index + 1}/${scenarios.length}: ${scenario.id}`);
      try {
        const result = await runScenario(browser, scenario, options, scripts, stylesheet);
        report.scenarios.push({...scenario, ...result, status: 'complete', startedAt, elapsedMs: performance.now() - start});
      } catch (error) {
        report.scenarios.push({...scenario, status: 'failed', startedAt, elapsedMs: performance.now() - start,
          error: {message: error.message, stack: error.stack, browserErrors: error.browserErrors || []}});
        throw error;
      } finally {
        await saveReport(report, options.output);
      }
    }
    report.status = 'complete';
    report.completedAt = new Date().toISOString();
    await saveReport(report, options.output);
    console.log(`Raw results: ${options.output}`);
    console.log(`Summary: ${/\.json$/i.test(options.output) ? options.output.replace(/\.json$/i, '.md') : `${options.output}.md`}`);
  } catch (error) {
    report.status = 'failed';
    report.error = {message: error.message, stack: error.stack};
    await saveReport(report, options.output);
    throw error;
  } finally {
    await browser?.close();
  }
}

main().catch(error => {
  console.error(`Rendering benchmark failed: ${error.message}`);
  process.exitCode = 1;
});
