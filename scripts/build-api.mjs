#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { access, lstat, mkdtemp, readdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docsDirectory = path.join(repositoryRoot, 'docs');
const destination = path.join(docsDirectory, 'api');

// Generate in a sibling directory so failed builds preserve the current API and
// successful builds remove stale generated pages and assets. Run with yarn api.
async function buildApi() {
  const existing = await lstat(destination).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });
  if (existing && (!existing.isDirectory() || existing.isSymbolicLink())) {
    throw new Error('docs/api must be a real generated directory.');
  }

  const staging = await mkdtemp(path.join(docsDirectory, '.api-build-'));
  const output = path.join(staging, 'api');
  const backup = path.join(staging, 'previous-api');
  let canRemoveStaging = true;

  try {
    execFileSync(process.execPath, [
      path.join(repositoryRoot, 'node_modules/jsdoc/jsdoc.js'),
      '--configure', 'template/jsdoc_conf.json',
      '--template', 'template/jaguarjs-jsdoc',
      '--destination', output,
      '--readme', 'README.md'
    ], { cwd: repositoryRoot, stdio: 'inherit' });

    for (const filename of ['index.html', 'Viewer.html', 'Feature.html', 'Plot.html', 'navigation.html', 'scripts/main.js']) {
      await access(path.join(output, filename));
    }
    const pages = (await readdir(output)).filter((filename) => filename.endsWith('.html') && filename !== 'navigation.html');

    if (existing) {
      await rename(destination, backup);
      canRemoveStaging = false;
    }
    try {
      await rename(output, destination);
      canRemoveStaging = true;
    } catch (error) {
      if (existing) {
        await rename(backup, destination);
        canRemoveStaging = true;
      }
      throw error;
    }
    console.log(`Generated ${pages.length} API pages and shared navigation in docs/api.`);
  } finally {
    if (canRemoveStaging) {
      await rm(staging, { recursive: true, force: true });
    } else {
      console.error(`Previous API preserved for recovery at ${backup}`);
    }
  }
}

buildApi().catch((error) => {
  console.error(`API generation failed: ${error.message}`);
  process.exitCode = 1;
});
