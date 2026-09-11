#!/usr/bin/env node

import {execFileSync} from 'node:child_process';
import {mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {parseAst} from 'rollup/parseAst';
import {bundleVariants, bundleFormats, repositoryRoot} from './build/bundles.mjs';

// Measure actual Rollup outputs, without maintaining a second build config.
// Usage: cgview-run yarn gh-pages && cgview-run node scripts/analyze-dependencies.mjs
const artifacts = path.join(repositoryRoot, '.agents/dependencies');
await mkdir(artifacts, {recursive: true});

function visit(node, callback) {
  if (!node || typeof node !== 'object') { return; }
  if (node.type) { callback(node); }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) { value.forEach(child => visit(child, callback)); }
    else if (value && typeof value === 'object') { visit(value, callback); }
  }
}

const usage = {};
for (const name of (await readdir(path.join(repositoryRoot, 'src'))).sort()) {
  if (!name.endsWith('.js') || name === 'd3.js') { continue; }
  visit(parseAst(await readFile(path.join(repositoryRoot, 'src', name), 'utf8')), node => {
    if (node.type !== 'MemberExpression' || node.object.name !== 'd3') { return; }
    if (node.computed) { throw new Error(`Review computed D3 access in ${name}`); }
    const method = node.property.name;
    usage[method] ??= [];
    if (!usage[method].includes(name)) { usage[method].push(name); }
  });
}

async function measure(file) {
  const code = await readFile(path.join(repositoryRoot, file));
  return {bytes: code.length, gzipBytes: gzipSync(code, {level: 9}).length};
}

const assets = {};
for (const file of ['docs/dist/cgview.min.js', 'docs/dist/cgview.css', 'docs/scripts/d3.min.js',
  'docs/scripts/svgcanvas.iife.js', 'docs/scripts/CGParse.min.js']) {
  assets[file] = await measure(file);
}
const baseline = assets['docs/dist/cgview.min.js'];
const results = [];
for (const variant of bundleVariants) {
  const outputs = [];
  for (const {format, minified} of bundleFormats) {
    const file = `docs/dist/${variant.stem}${format === 'es' ? '.esm' : ''}${minified ? '.min' : ''}.js`;
    outputs.push({file, format, minified, ...await measure(file)});
  }
  const minified = outputs.find(output => output.format === 'iife' && output.minified);
  results.push({
    ...variant, ...minified, outputs,
    deltaBytes: minified.bytes - baseline.bytes,
    deltaPercent: (minified.bytes / baseline.bytes - 1) * 100,
    deltaGzipBytes: minified.gzipBytes - baseline.gzipBytes,
    deltaGzipPercent: (minified.gzipBytes / baseline.gzipBytes - 1) * 100
  });
  console.log(`${variant.stem}.min.js: ${minified.bytes} bytes; gzip ${minified.gzipBytes} bytes`);
}

const report = {
  baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: repositoryRoot, encoding: 'utf8'}).trim(),
  node: process.version,
  gzipLevel: 9,
  sourceMaps: 'All outputs include their sourceMappingURL comment; .map files are excluded.',
  methodCount: Object.keys(usage).length,
  usage, assets, results
};
await writeFile(path.join(artifacts, 'sizes.json'), JSON.stringify(report, null, 2) + '\n');
console.log('Measurements written to .agents/dependencies/sizes.json');
