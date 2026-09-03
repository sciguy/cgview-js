#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { access, appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const execFileAsync = promisify(execFile);
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const regressionThreshold = {percent: 15, milliseconds: 2};

const scenarios = [
  {
    id: 'small',
    name: 'Mitochondria, no plots',
    fixture: 'docs/test/maps/basic_mito_no_plots.json',
    mapOverrides: {
      annotation: {labelPosition: 'outside'},
      settings: {format: 'circular'}
    }
  },
  {
    id: 'small-inline-labels',
    name: 'Mitochondria, automatic labels',
    fixture: 'docs/test/maps/basic_mito_no_plots.json',
    mapOverrides: {
      annotation: {labelPosition: 'auto'},
      settings: {format: 'circular'}
    }
  },
  {
    id: 'medium-contigs-circular',
    name: 'E. coli PA2 contigs (circular)',
    fixture: 'docs/test/maps/contigs_ecoli_pa2.json',
    mapOverrides: {
      annotation: {labelPosition: 'outside'},
      settings: {format: 'circular'}
    }
  },
  {
    id: 'medium-contigs-linear',
    name: 'E. coli PA2 contigs (linear)',
    fixture: 'docs/test/maps/contigs_ecoli_pa2.json',
    mapOverrides: {
      annotation: {labelPosition: 'outside'},
      settings: {format: 'linear'}
    }
  },
  {
    id: 'large',
    name: 'L. guizhouensis, no plots',
    fixture: 'docs/test/maps/large_lentzea_no_plots.json',
    mapOverrides: {
      annotation: {labelPosition: 'outside'},
      settings: {format: 'circular'}
    }
  },
  {
    id: 'large-inline-labels',
    name: 'L. guizhouensis, automatic labels',
    fixture: 'docs/test/maps/large_lentzea_no_plots.json',
    mapOverrides: {
      annotation: {labelPosition: 'auto'},
      settings: {format: 'circular'}
    },
    zoomLevels: [1, 5, 10, 750, 1000]
  }
];

/**
 * Recursively apply scenario-specific CGView JSON values. Nested objects are
 * merged so a scenario can enable a new setting without copying a map fixture;
 * arrays and scalar values replace the fixture value.
 *
 * @param {Object} target - CGView JSON object receiving the overrides.
 * @param {Object} overrides - Nested values to apply.
 * @return {Object} The mutated target object.
 */
function applyMapOverrides(target, overrides) {
  for (const [key, value] of Object.entries(overrides)) {
    const nestedObject = value !== null && typeof value === 'object' && !Array.isArray(value);
    if (nestedObject) {
      const current = target[key];
      const currentObject = current !== null && typeof current === 'object' && !Array.isArray(current);
      target[key] = applyMapOverrides(currentObject ? current : {}, value);
    } else {
      target[key] = structuredClone(value);
    }
  }

  return target;
}

/**
 * Parse supported command-line arguments.
 *
 * @param {String[]} argv - Arguments after the Node executable and script.
 * @return {Object} Normalized benchmark options.
 */
function parseArguments(argv) {
  const options = {
    baselineRoot: undefined,
    iterations: 20,
    output: path.join(repositoryRoot, '.benchmark-results', 'benchmark-results.json'),
    warmupIterations: 5
  };

  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    const value = argv[index + 1];

    if (argument === '--baseline-root') {
      options.baselineRoot = path.resolve(process.cwd(), value);
      index++;
    } else if (argument === '--iterations') {
      options.iterations = positiveInteger(value, argument);
      index++;
    } else if (argument === '--output') {
      options.output = path.resolve(process.cwd(), value);
      index++;
    } else if (argument === '--warmups') {
      options.warmupIterations = nonNegativeInteger(value, argument);
      index++;
    } else if (argument === '--help') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return options;
}

function positiveInteger(value, argument) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`${argument} must be a positive integer`);
  }
  return number;
}

function nonNegativeInteger(value, argument) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`${argument} must be a non-negative integer`);
  }
  return number;
}

function printHelp() {
  console.log(`Usage: yarn benchmark:ci [options]

Options:
  --baseline-root PATH  Compare against a built checkout at PATH
  --iterations NUMBER   Recorded iterations per zoom level (default: 20)
  --warmups NUMBER      Unrecorded warm-up iterations (default: 5)
  --output PATH         JSON result path
  --help                Show this help`);
}

/**
 * Verify that a target checkout contains the browser assets needed by the
 * benchmark. The production bundle must be built before this script runs.
 *
 * @param {String} targetRoot - Checkout containing built CGView assets.
 * @return {Promise<void>}
 */
async function verifyTarget(targetRoot) {
  const requiredFiles = [
    'docs/dist/cgview.js',
    'docs/dist/cgview.css',
    'docs/scripts/d3.min.js',
    'docs/scripts/svgcanvas.iife.js'
  ];

  for (const file of requiredFiles) {
    const filePath = path.join(targetRoot, file);
    try {
      await access(filePath);
    } catch {
      throw new Error(`Missing benchmark asset: ${filePath}. Build the checkout first.`);
    }
  }
}

/**
 * Return the Git revision for a checkout when available.
 *
 * @param {String} targetRoot - Git checkout path.
 * @return {Promise<String|undefined>} Full Git revision.
 */
async function gitRevision(targetRoot) {
  try {
    const {stdout} = await execFileAsync('git', ['-C', targetRoot, 'rev-parse', 'HEAD']);
    return stdout.trim();
  } catch {
    return undefined;
  }
}

/**
 * Run one fixture against one built checkout in an isolated browser context.
 *
 * @param {Browser} browser - Playwright browser instance.
 * @param {Object} target - Target label and checkout root.
 * @param {Object} scenario - Fixture metadata and parsed JSON.
 * @param {Object} options - Iteration configuration.
 * @return {Promise<Object>} Browser benchmark result.
 */
async function runScenario(browser, target, scenario, options) {
  const context = await browser.newContext({
    colorScheme: 'light',
    deviceScaleFactor: 1,
    locale: 'en-US',
    reducedMotion: 'reduce',
    viewport: {width: 800, height: 800}
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  try {
    await page.setContent(`
      <!doctype html>
      <html>
        <head><meta charset="utf-8"></head>
        <body><div id="my-viewer"></div></body>
      </html>
    `);
    await page.addStyleTag({path: path.join(target.root, 'docs/dist/cgview.css')});
    await page.addScriptTag({path: path.join(target.root, 'docs/scripts/d3.min.js')});
    await page.addScriptTag({path: path.join(target.root, 'docs/scripts/svgcanvas.iife.js')});
    await page.addScriptTag({path: path.join(target.root, 'docs/dist/cgview.js')});
    await page.addScriptTag({path: path.join(repositoryRoot, 'docs/test/performance.js')});

    const result = await page.evaluate(async ({fixture, iterations, name, warmupIterations, zoomLevels}) => {
      const viewer = new CGView.Viewer('#my-viewer', {
        height: 600,
        width: 600,
        SVGContext: svgcanvas.Context
      });
      viewer.io.loadJSON(fixture);
      viewer.name = name;

      const benchmark = new CGVPerformance(viewer, name, iterations, {warmupIterations, zoomLevels});
      await benchmark.ready;
      return benchmark.toJSON();
    }, {
      fixture: scenario.data,
      iterations: options.iterations,
      name: scenario.name,
      warmupIterations: options.warmupIterations,
      zoomLevels: scenario.zoomLevels
    });

    if (pageErrors.length > 0) {
      throw new Error(`Browser errors: ${pageErrors.join('; ')}`);
    }

    return {
      ...result,
      fixture: scenario.fixture,
      mapOverrides: scenario.mapOverrides
    };
  } finally {
    await context.close();
  }
}

/**
 * Flatten base-versus-head medians into comparison rows.
 *
 * @param {Object[]} targets - Completed target results.
 * @return {Object[]} One row per scenario, zoom level, and metric.
 */
function comparisonsFor(targets) {
  const baseline = targets.find((target) => target.label === 'base');
  const candidate = targets.find((target) => target.label === 'head');
  if (!baseline || !candidate) return [];

  const rows = [];
  for (const scenario of scenarios) {
    const baseResult = baseline.scenarios[scenario.id];
    const headResult = candidate.scenarios[scenario.id];

    for (let index = 0; index < headResult.summary.length; index++) {
      const baseSummary = baseResult.summary[index];
      const headSummary = headResult.summary[index];

      for (const metric of ['drawFast', 'drawFull']) {
        const baseMedian = baseSummary[metric].median;
        const headMedian = headSummary[metric].median;
        const deltaMilliseconds = headMedian - baseMedian;
        const deltaPercent = (deltaMilliseconds / baseMedian) * 100;
        const regression = (
          deltaMilliseconds > regressionThreshold.milliseconds &&
          deltaPercent > regressionThreshold.percent
        );

        rows.push({
          scenario: scenario.id,
          zoomLevel: headSummary.zoomLevel,
          metric,
          baseMedian,
          headMedian,
          deltaMilliseconds,
          deltaPercent,
          regression
        });
      }
    }
  }

  return rows;
}

function formatMilliseconds(value) {
  return `${value.toFixed(2)} ms`;
}

function formatPercent(value) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

/**
 * Produce the same Markdown table for terminal output and GitHub summaries.
 *
 * @param {Object} report - Complete benchmark report.
 * @return {String} Markdown report.
 */
function markdownReport(report) {
  const lines = [
    '## CGView performance benchmark',
    '',
    `Chromium ${report.environment.chromium}, ${report.options.iterations} measured iterations after ${report.options.warmupIterations} warm-ups.`,
    ''
  ];

  if (report.comparisons.length > 0) {
    lines.push('| Map | Zoom | Metric | Base median | Head median | Change | Status |');
    lines.push('| --- | ---: | --- | ---: | ---: | ---: | --- |');
    for (const row of report.comparisons) {
      const status = row.regression ? '⚠ review' : 'ok';
      lines.push(`| ${row.scenario} | ${row.zoomLevel}× | ${row.metric} | ${formatMilliseconds(row.baseMedian)} | ${formatMilliseconds(row.headMedian)} | ${formatPercent(row.deltaPercent)} | ${status} |`);
    }
    lines.push('');
    lines.push(`Regression flags are informational and use both >${regressionThreshold.percent}% and >${regressionThreshold.milliseconds} ms thresholds.`);
  } else {
    lines.push('| Map | Zoom | Fast median | Fast p90 | Full median | Full p90 |');
    lines.push('| --- | ---: | ---: | ---: | ---: | ---: |');
    const current = report.targets[0];
    for (const scenario of scenarios) {
      for (const summary of current.scenarios[scenario.id].summary) {
        lines.push(`| ${scenario.id} | ${summary.zoomLevel}× | ${formatMilliseconds(summary.drawFast.median)} | ${formatMilliseconds(summary.drawFast.p90)} | ${formatMilliseconds(summary.drawFull.median)} | ${formatMilliseconds(summary.drawFull.p90)} |`);
      }
    }
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const targetDefinitions = options.baselineRoot ? [
    {label: 'base', root: options.baselineRoot},
    {label: 'head', root: repositoryRoot}
  ] : [
    {label: 'current', root: repositoryRoot}
  ];

  for (const target of targetDefinitions) {
    await verifyTarget(target.root);
  }

  const loadedScenarios = await Promise.all(scenarios.map(async (scenario) => {
    const fixturePath = path.join(repositoryRoot, scenario.fixture);
    const data = JSON.parse(await readFile(fixturePath, 'utf8'));
    applyMapOverrides(data.cgview, scenario.mapOverrides);
    return {...scenario, data};
  }));

  const browser = await chromium.launch({headless: true});
  const targets = await Promise.all(targetDefinitions.map(async (target) => ({
    ...target,
    revision: await gitRevision(target.root),
    scenarios: {}
  })));

  try {
    for (let index = 0; index < loadedScenarios.length; index++) {
      const scenario = loadedScenarios[index];
      const orderedTargets = (index % 2 === 0) ? targets : [...targets].reverse();
      for (const target of orderedTargets) {
        console.log(`Benchmarking ${target.label}: ${scenario.name}`);
        target.scenarios[scenario.id] = await runScenario(browser, target, scenario, options);
      }
    }

    const report = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      environment: {
        architecture: process.arch,
        chromium: browser.version(),
        node: process.version,
        platform: process.platform
      },
      options: {
        iterations: options.iterations,
        warmupIterations: options.warmupIterations
      },
      targets: targets.map(({label, revision, root, scenarios: targetScenarios}) => ({
        label,
        revision,
        root,
        scenarios: targetScenarios
      })),
      comparisons: comparisonsFor(targets)
    };

    await mkdir(path.dirname(options.output), {recursive: true});
    await writeFile(options.output, `${JSON.stringify(report, null, 2)}\n`);

    const markdown = markdownReport(report);
    console.log(`\n${markdown}`);
    console.log(`Raw results: ${options.output}`);

    if (process.env.GITHUB_STEP_SUMMARY) {
      await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`Benchmark failed: ${error.message}`);
  process.exitCode = 1;
});
