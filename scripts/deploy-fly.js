#!/usr/bin/env node

/**
 * Update @owlcms/tracker-core to a released tag, then run fly deploy.
 *
 * Usage:
 *   npm run deploy:fly
 *   npm run deploy:fly -- 1.5.7
 *   npm run deploy:fly -- --core 1.5.7
 *   npm run deploy:fly -- 1.5.7 -- --ha=false
 *   npm run deploy:fly -- 1.5.7 --dry-run
 *
 * After updating package files and deploying, the local npm link to
 * ../tracker-core is restored so local development keeps using the linked core.
 *
 * The app must run as a single machine (in-memory competition hub), so the
 * deploy defaults to --ha=false and runs `fly scale count 1` afterward.
 */

import fs from 'fs';
import { spawnSync } from 'child_process';
import { runVersionChecks } from './package-shared.js';

class UsageError extends Error {}

function printUsage() {
  console.log(`Usage: npm run deploy:fly -- [tracker-core-version] [options] [-- fly-deploy-args]

Updates package.json and package-lock.json so Docker npm ci resolves the requested
@owlcms/tracker-core tag, then runs fly deploy. The deploy defaults to --ha=false
and runs 'fly scale count 1' afterward to keep the app on a single machine.

Arguments:
  tracker-core-version   Optional tracker-core tag, for example 1.5.7.
                         If omitted, the latest semver tag is fetched from GitHub.

Options:
  --core <version>       Same as the positional tracker-core-version.
  --core=<version>       Same as the positional tracker-core-version.
  --dry-run, -n          Show the tracker-core tag that would be deployed without
                         changing package files, running fly deploy, or relinking.
  --no-relink            Do not restore the local npm link to ../tracker-core
                         after deploying.
  --help                 Show this help.

Examples:
  npm run deploy:fly
  npm run deploy:fly -- 1.5.7
  npm run deploy:fly -- --core 1.5.7 --dry-run
  npm run deploy:fly -- 1.5.7 -- --ha=false
`);
}

function parseArgs(argv) {
  const delimiterIndex = argv.indexOf('--');
  const ownArgs = delimiterIndex === -1 ? argv : argv.slice(0, delimiterIndex);
  const flyArgs = delimiterIndex === -1 ? [] : argv.slice(delimiterIndex + 1);

  let trackerCoreVersion = null;
  let dryRun = false;
  let restoreLinkAfter = true;

  for (let i = 0; i < ownArgs.length; i += 1) {
    const arg = ownArgs[i];

    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }

    if (arg === '--dry-run' || arg === '-n') {
      dryRun = true;
      continue;
    }

    if (arg === '--no-relink') {
      restoreLinkAfter = false;
      continue;
    }

    if (arg === '--core') {
      const value = ownArgs[i + 1];
      if (!value || value.startsWith('--')) {
        throw new UsageError('--core requires a tracker-core version');
      }
      trackerCoreVersion = setTrackerCoreVersion(trackerCoreVersion, value);
      i += 1;
      continue;
    }

    if (arg.startsWith('--core=')) {
      trackerCoreVersion = setTrackerCoreVersion(trackerCoreVersion, arg.slice('--core='.length));
      continue;
    }

    if (arg.startsWith('--')) {
      throw new UsageError(`Unknown option: ${arg}`);
    }

    trackerCoreVersion = setTrackerCoreVersion(trackerCoreVersion, arg);
  }

  return { trackerCoreVersion, dryRun, restoreLinkAfter, flyArgs };
}

function setTrackerCoreVersion(currentValue, nextValue) {
  if (!nextValue) {
    throw new UsageError('tracker-core version cannot be empty');
  }
  if (currentValue && currentValue !== nextValue) {
    throw new UsageError(`tracker-core version specified more than once: ${currentValue}, ${nextValue}`);
  }
  return nextValue;
}

function readResolvedTrackerCore() {
  const packageLock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
  const trackerCoreInfo = packageLock.packages?.['node_modules/@owlcms/tracker-core'];

  if (!trackerCoreInfo) {
    throw new Error('package-lock.json has no node_modules/@owlcms/tracker-core entry');
  }

  const resolved = trackerCoreInfo.resolved || '';
  const commit = resolved.includes('#') ? resolved.split('#').pop() : 'unknown';

  return {
    version: trackerCoreInfo.version || 'unknown',
    resolved,
    commit
  };
}

function runFlyDeploy(flyArgs) {
  // This app MUST run as a single machine (in-memory competition hub). Default to
  // --ha=false so a fresh launch never gets a standby HA machine. If the caller
  // passes their own --ha flag, respect it instead.
  const hasHaFlag = flyArgs.some((arg) => arg === '--ha' || arg.startsWith('--ha='));
  const deployArgs = hasHaFlag ? flyArgs : ['--ha=false', ...flyArgs];

  console.log(`\n🚀 Running: fly deploy${deployArgs.length ? ` ${deployArgs.join(' ')}` : ''}`);
  const result = spawnSync('fly', ['deploy', ...deployArgs], { stdio: 'inherit' });

  if (result.error) {
    if (result.error.code === 'ENOENT') {
      throw new Error('fly CLI not found in PATH');
    }
    throw new Error(`Failed to run fly deploy: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`fly deploy exited with code ${result.status}`);
  }
}

function enforceSingleMachine(appArgs = []) {
  // The in-memory competition hub requires exactly one machine. Forward the same
  // -a/--app override (if any) that was passed to fly deploy so both commands
  // target the same app rather than falling back to fly.toml.
  const scaleArgs = ['scale', 'count', '1', '--yes', ...appArgs];
  console.log(`\n🔢 Enforcing single machine: fly ${scaleArgs.join(' ')}`);
  const result = spawnSync('fly', scaleArgs, { stdio: 'inherit' });

  if (result.error) {
    if (result.error.code === 'ENOENT') {
      throw new Error('fly CLI not found in PATH');
    }
    throw new Error(`Failed to run fly scale count 1: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`fly scale count 1 exited with code ${result.status}`);
  }
}

function extractAppArgs(flyArgs) {
  // Pull a -a/--app override out of the passthrough fly args so the scale step
  // can target the same app as the deploy. Supports: -a NAME, --app NAME,
  // --app=NAME, -a=NAME.
  for (let i = 0; i < flyArgs.length; i += 1) {
    const arg = flyArgs[i];

    if (arg === '-a' || arg === '--app') {
      const value = flyArgs[i + 1];
      if (value && !value.startsWith('-')) {
        return ['--app', value];
      }
      return [];
    }

    if (arg.startsWith('--app=')) {
      return ['--app', arg.slice('--app='.length)];
    }

    if (arg.startsWith('-a=')) {
      return ['--app', arg.slice('-a='.length)];
    }
  }

  return [];
}

function restoreLocalLink() {
  console.log('\n🔗 Restoring local npm link to ../tracker-core ...');

  const registerCore = spawnSync('npm', ['--prefix', '../tracker-core', 'link'], { stdio: 'inherit' });
  if (registerCore.error || registerCore.status !== 0) {
    console.error('⚠️  Failed to register ../tracker-core for linking; restore it manually with: npm run relink');
    return;
  }

  const linkHere = spawnSync('npm', ['link', '@owlcms/tracker-core'], { stdio: 'inherit' });
  if (linkHere.error || linkHere.status !== 0) {
    console.error('⚠️  Failed to link @owlcms/tracker-core; restore it manually with: npm run relink');
    return;
  }

  console.log('✓ Local tracker-core link restored');
}

async function main() {
  const { trackerCoreVersion, dryRun, restoreLinkAfter, flyArgs } = parseArgs(process.argv.slice(2));

  if (dryRun) {
    const selectedVersion = await runVersionChecks({
      requestedVersion: trackerCoreVersion,
      promptOnAuto: false,
      allowRelease: false,
      updatePackageJson: false,
      updatePackageLockFile: false
    });

    const current = readResolvedTrackerCore();
    console.log('\n🧪 Dry run — no files changed, no deploy, no relink.');
    console.log(`   tracker-core tag to deploy:  ${selectedVersion}`);
    console.log(`   currently pinned version:    ${current.version}`);
    console.log(`   currently pinned commit:     ${current.commit}`);
    return;
  }

  try {
    const selectedVersion = await runVersionChecks({
      requestedVersion: trackerCoreVersion,
      promptOnAuto: false,
      allowRelease: false,
      updatePackageJson: true,
      updatePackageLockFile: true
    });

    const resolved = readResolvedTrackerCore();
    console.log('\n📋 Fly deploy will use:');
    console.log(`   tracker-core tag:     ${selectedVersion}`);
    console.log(`   package version:      ${resolved.version}`);
    console.log(`   resolved dependency:  ${resolved.resolved}`);
    console.log(`   resolved commit:      ${resolved.commit}`);

    runFlyDeploy(flyArgs);
    enforceSingleMachine(extractAppArgs(flyArgs));
  } finally {
    if (restoreLinkAfter) {
      restoreLocalLink();
    }
  }
}

main().catch((error) => {
  if (error instanceof UsageError) {
    console.error(`❌ ${error.message}\n`);
    printUsage();
  } else {
    console.error(`❌ ${error.message}`);
  }
  process.exit(1);
});