#!/usr/bin/env node

import {execFile, spawn} from 'node:child_process';
import {access, mkdtemp, rm, symlink} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';

const execFileAsync = promisify(execFile);
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const zeroExitCode = 0;

function printHelp() {
  console.log(`Usage: yarn benchmark:compare [BASE_REF] [benchmark options]

Build and compare the working tree with BASE_REF (default: HEAD).
Benchmark options such as --iterations, --warmups, and --output are forwarded.

Examples:
  yarn benchmark:compare HEAD
  yarn benchmark:compare HEAD^
  yarn benchmark:compare main --iterations 10`);
}

/**
 * Parse the optional baseline ref and preserve benchmark runner arguments.
 *
 * @param {String[]} argv - Arguments after the Node executable and script.
 * @return {Object} Baseline ref and arguments forwarded to benchmark.mjs.
 */
function parseArguments(argv) {
  if (argv.includes('--help')) {
    printHelp();
    process.exit(zeroExitCode);
  }

  const benchmarkArguments = [...argv];
  const baseRef = benchmarkArguments[0]?.startsWith('--') ? 'HEAD' : (benchmarkArguments.shift() || 'HEAD');
  return {baseRef, benchmarkArguments};
}

/**
 * Run a command with visible output and reject when it fails.
 *
 * @param {String} command - Executable name or path.
 * @param {String[]} args - Command arguments.
 * @param {String} cwd - Command working directory.
 * @return {Promise<void>} Resolves when the command exits successfully.
 */
function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {cwd, stdio: 'inherit'});
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === zeroExitCode) {
        resolve();
      } else {
        const status = signal ? `signal ${signal}` : `exit code ${code}`;
        reject(new Error(`${command} failed with ${status}`));
      }
    });
  });
}

async function gitOutput(args) {
  const {stdout} = await execFileAsync('git', ['-C', repositoryRoot, ...args]);
  return stdout.trim();
}

async function main() {
  const {baseRef, benchmarkArguments} = parseArguments(process.argv.slice(2));
  const nodeModules = path.join(repositoryRoot, 'node_modules');
  try {
    await access(nodeModules);
  } catch {
    throw new Error('Missing node_modules. Run yarn install before comparing benchmarks.');
  }

  let baseCommit;
  try {
    baseCommit = await gitOutput(['rev-parse', '--verify', `${baseRef}^{commit}`]);
  } catch {
    throw new Error(`Unknown baseline ref: ${baseRef}`);
  }

  const headCommit = await gitOutput(['rev-parse', 'HEAD']);
  const worktreeStatus = await gitOutput(['status', '--porcelain']);
  if (!worktreeStatus && baseCommit === headCommit) {
    console.warn('The working tree matches the baseline. Use HEAD^ to compare the current commit with its parent.');
  }

  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'cgview-benchmark-'));
  const baselineRoot = path.join(temporaryRoot, 'base');
  let worktreeAdded = false;

  console.log(`Comparing the working tree with ${baseRef} (${baseCommit.slice(0, 12)})`);

  try {
    await runCommand('git', ['worktree', 'add', '--detach', baselineRoot, baseCommit], repositoryRoot);
    worktreeAdded = true;
    await symlink(nodeModules, path.join(baselineRoot, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');

    const yarn = process.platform === 'win32' ? 'yarn.cmd' : 'yarn';
    console.log('\nBuilding the working tree...');
    await runCommand(yarn, ['gh-pages'], repositoryRoot);
    console.log('\nBuilding the baseline...');
    await runCommand(yarn, ['gh-pages'], baselineRoot);
    console.log('\nRunning the comparison...');
    await runCommand(process.execPath, [
      path.join(scriptDirectory, 'benchmark.mjs'),
      '--baseline-root', baselineRoot,
      ...benchmarkArguments
    ], repositoryRoot);
  } finally {
    try {
      if (worktreeAdded) {
        await runCommand('git', ['worktree', 'remove', '--force', baselineRoot], repositoryRoot);
      }
    } finally {
      await rm(temporaryRoot, {recursive: true, force: true});
    }
  }
}

main().catch((error) => {
  console.error(`Benchmark comparison failed: ${error.message}`);
  process.exitCode = 1;
});
