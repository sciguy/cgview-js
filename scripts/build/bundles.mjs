import {createHash} from 'node:crypto';
import {existsSync, readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Inclusion flags and filename stems shared by Rollup, measurements, and smoke checks. */
export const bundleVariants = [
  {id: 'core', stem: 'cgview', d3: false, svg: false, css: false},
  {id: 'standalone', stem: 'cgview.standalone', d3: true, svg: true, css: true}
];

/** Browser scripts are minified; application bundlers can minify the readable ESM. */
export const bundleFormats = [
  {format: 'iife', minified: true},
  {format: 'es', minified: false}
];

const require = createRequire(import.meta.url);
const packageCache = new Map();
const entry = '\0cgview-entry';
const styles = '\0cgview-styles';
const sourceEntry = path.join(repositoryRoot, 'src/index.js');
const viewer = path.join(repositoryRoot, 'src/Viewer.js');
const stylesheet = path.join(repositoryRoot, 'docs/dist/cgview.css');

// Locate actual package boundaries, including scoped and nested dependencies.
function packageFor(id) {
  if (!id.includes(`${path.sep}node_modules${path.sep}`)) { return undefined; }
  let directory = path.dirname(id);
  const visited = [];
  while (directory !== path.dirname(directory)) {
    if (packageCache.has(directory)) { break; }
    visited.push(directory);
    const filename = path.join(directory, 'package.json');
    if (existsSync(filename)) {
      packageCache.set(directory, {directory, ...JSON.parse(readFileSync(filename, 'utf8'))});
      break;
    }
    directory = path.dirname(directory);
  }
  const info = packageCache.get(directory);
  for (const parent of visited) { packageCache.set(parent, info); }
  return info;
}

/**
 * Honor package sideEffects metadata while retaining unknown side effects.
 * D3 transition lists the exact files that extend selection.prototype.
 * Reads and caches package metadata from disk.
 * @param {string} id - Resolved module path.
 * @returns {boolean} Whether Rollup must retain unused top-level effects.
 * @example treeshake: {moduleSideEffects: dependencySideEffects}
 */
export function dependencySideEffects(id) {
  const info = packageFor(id);
  if (info?.sideEffects === false) { return false; }
  if (Array.isArray(info?.sideEffects)) {
    // Keep unfamiliar glob patterns conservatively instead of dropping code.
    return info.sideEffects.some(file => /[?*{[]/.test(file) || path.resolve(info.directory, file) === id);
  }
  return true;
}

/**
 * Include complete license notices for packages with rendered code in a chunk.
 * Reads package metadata and license files from disk.
 * @param {object} chunk - Rollup rendered chunk, including its modules.
 * @returns {string} Deduplicated license comments, or an empty string.
 * @example banner: chunk => licenseBanner + bundledNotices(chunk)
 */
export function bundledNotices(chunk) {
  const packages = new Map();
  for (const [id, module] of Object.entries(chunk.modules)) {
    const info = module.renderedLength > 0 && packageFor(id);
    if (info) { packages.set(info.directory, info); }
  }
  const notices = new Map();
  for (const info of [...packages.values()].sort((a, b) => a.name.localeCompare(b.name))) {
    const file = ['LICENSE', 'LICENSE.md', 'LICENSE.txt'].map(name => path.join(info.directory, name))
      .find(filename => existsSync(filename));
    if (!file) { throw new Error(`Missing bundled license for ${info.name}`); }
    const license = readFileSync(file, 'utf8').trim();
    if (!notices.has(license)) { notices.set(license, []); }
    notices.get(license).push(`${info.name} ${info.version}`);
  }
  return [...notices].map(([license, packages]) =>
    `\n/*!\n * Bundled: ${packages.join(', ')}\n${license.replace(/\*\//g, '* /')}\n */`
  ).join('\n');
}

/**
 * Resolve the project's ESM dependencies and select optional SVG/CSS modules.
 * Uses Node's native package resolver; no packages are installed or changed.
 * @param {object} variant - One of bundleVariants.
 * @returns {object} Rollup plugin, with file reads and CSS watch registration.
 * @example plugins: [bundleDependencies(bundleVariants[1])]
 */
export function bundleDependencies(variant) {
  return {
    name: 'cgview-bundle-dependencies',
    buildStart() {
      packageCache.clear();
    },
    resolveId(id, importer) {
      if (id === entry || id === styles) { return id; }
      if (variant.svg && importer === viewer && id === './SVGContext') {
        // SVGCanvas 2.x ships ESM source; its package main is CommonJS.
        return path.join(path.dirname(require.resolve('svgcanvas/package.json')), 'context.js');
      }
      if (!id.startsWith('.') && !path.isAbsolute(id)) {
        const resolver = importer && !importer.startsWith('\0') ? createRequire(importer) : require;
        const resolved = resolver.resolve(id);
        // The current D3 graph uses ESM default exports. Fail clearly if a
        // future dependency needs CommonJS conversion or browser conditions.
        if (packageFor(resolved)?.type !== 'module') {
          this.error(`Cannot bundle non-ESM dependency ${id}; review its browser entry point.`);
        }
        return resolved;
      }
      return null;
    },
    load(id) {
      if (id === entry) {
        return `import ${JSON.stringify(styles)};\nexport * from ${JSON.stringify(sourceEntry)};`;
      }
      if (id !== styles) { return null; }
      this.addWatchFile(stylesheet);
      const css = readFileSync(stylesheet, 'utf8');
      if (/url\(|@import|@font-face/.test(css)) {
        this.error('Embedded CSS references additional assets; include those before bundling it.');
      }
      const compact = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
      const hash = createHash('sha256').update(compact).digest('hex').slice(0, 16);
      return `
        if (typeof document !== 'undefined' && !document.getElementById('cgview-styles-${hash}')) {
          const style = document.createElement('style');
          style.id = 'cgview-styles-${hash}';
          style.setAttribute('data-cgview-styles', '${hash}');
          if (document.currentScript?.nonce) style.nonce = document.currentScript.nonce;
          style.textContent = ${JSON.stringify(compact)};
          (document.head || document.documentElement).appendChild(style);
        }
      `;
    }
  };
}

/**
 * Select the normal source entry or the entry that installs embedded styles.
 * @param {object} variant - One of bundleVariants.
 * @returns {string} Rollup input path or virtual module ID. No side effects.
 */
export function bundleInput(variant) {
  return variant.css ? entry : sourceEntry;
}
