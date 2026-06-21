#!/usr/bin/env node

/**
 * Update @owlcms/tracker-core to a released tag, then run fly deploy.
 * If the requested tracker-core tag does not exist yet, offer to run the
 * tracker-core release flow first.
 *
 * Usage:
 *   npm run deploy:fly
 *   npm run deploy:fly -- 2.19.3
 *   npm run deploy:fly -- 2.19.3 1.15.15
 *   npm run deploy:fly -- --version 2.19.3 --core 1.15.15
 *   npm run deploy:fly -- 2.19.3 1.15.15 -- --ha=false
 *   npm run deploy:fly -- 2.19.3 1.15.15 --dry-run
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
  console.log(`Usage: npm run deploy:fly -- [tracker-version] [tracker-core-version] [options] [-- fly-deploy-args]

Updates package.json and package-lock.json so Docker npm ci resolves the requested
@owlcms/tracker-core tag, then runs fly deploy. If the requested tracker-core
tag does not exist yet, the script offers to run the tracker-core release flow
first. The deploy defaults to --ha=false and runs 'fly scale count 1' afterward
to keep the app on a single machine.

Arguments:
  tracker-version        Optional tracker version to show on the landing page.
                         If omitted, package.json version is used.
  tracker-core-version   Optional tracker-core tag, for example 1.15.15.
                         If omitted, the latest semver tag is fetched from GitHub.

Options:
  --core <version>       Same as the positional tracker-core-version.
  --core=<version>       Same as the positional tracker-core-version.
  --version <version>    Override the tracker version shown on the landing page
                         for this deploy only.
  --version=<version>    Same as --version <version>.
  --tracker-version <version>
                         Same as --version <version>.
  --tracker-version=<version>
                         Same as --version <version>.
  --dry-run, -n          Show the tracker-core tag that would be deployed without
                         changing package files, running fly deploy, or relinking.
  --no-relink            Do not restore the local npm link to ../tracker-core
                         after deploying.
  --help                 Show this help.

Examples:
  npm run deploy:fly
  npm run deploy:fly -- 2.19.3
  npm run deploy:fly -- 2.19.3 1.15.15
  npm run deploy:fly -- --version 2.19.3 --core 1.15.15 --dry-run
  npm run deploy:fly -- 2.19.3 1.15.15 -- --ha=false
`);
}

function parseArgs(argv) {
  const delimiterIndex = argv.indexOf('--');
  const ownArgs = delimiterIndex === -1 ? argv : argv.slice(0, delimiterIndex);
  const flyArgs = delimiterIndex === -1 ? [] : argv.slice(delimiterIndex + 1);

  let trackerCoreVersion = null;
  let trackerVersionOverride = null;
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

    if (arg === '--version' || arg === '--tracker-version') {
      const value = ownArgs[i + 1];
      if (!value || value.startsWith('--')) {
        throw new UsageError(`${arg} requires a tracker version`);
      }
      trackerVersionOverride = setOptionalVersion(
        trackerVersionOverride,
        value,
        'tracker version override'
      );
      i += 1;
      continue;
    }

    if (arg.startsWith('--version=')) {
      trackerVersionOverride = setOptionalVersion(
        trackerVersionOverride,
        arg.slice('--version='.length),
        'tracker version override'
      );
      continue;
    }

    if (arg.startsWith('--tracker-version=')) {
      trackerVersionOverride = setOptionalVersion(
        trackerVersionOverride,
        arg.slice('--tracker-version='.length),
        'tracker version override'
      );
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

    if (!trackerVersionOverride) {
      trackerVersionOverride = setOptionalVersion(arg, arg, 'tracker version override');
      continue;
    }

    trackerCoreVersion = setTrackerCoreVersion(trackerCoreVersion, arg);
  }

  return { trackerCoreVersion, trackerVersionOverride, dryRun, restoreLinkAfter, flyArgs };
}

function setTrackerCoreVersion(currentValue, nextValue) {
  return setOptionalVersion(currentValue, nextValue, 'tracker-core version');
}

function setOptionalVersion(currentValue, nextValue, label) {
  if (!nextValue) {
    throw new UsageError(`${label} cannot be empty`);
  }
  if (currentValue && currentValue !== nextValue) {
    throw new UsageError(`${label} specified more than once: ${currentValue}, ${nextValue}`);
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

function generateVersionFile(trackerVersionOverride) {
  // Bake the version file on the host so the tracker git commit is captured.
  // The Docker build excludes .git (see .dockerignore), so the commit cannot be
  // resolved inside the container; the file is copied into the image instead.
  console.log('\n🔖 Generating build-time version info ...');
  const env = {
    ...process.env,
    ...(trackerVersionOverride ? { TRACKER_VERSION_OVERRIDE: trackerVersionOverride } : {})
  };
  const result = spawnSync('node', ['scripts/generate-version.js'], { stdio: 'inherit', env });
  if (result.error || result.status !== 0) {
    throw new Error('Failed to generate version file (scripts/generate-version.js)');
  }
}

function runFlyDeploy(flyArgs, trackerVersionOverride) {
  // This app MUST run as a single machine (in-memory competition hub). Default to
  // --ha=false so a fresh launch never gets a standby HA machine. If the caller
  // passes their own --ha flag, respect it instead.
  const hasHaFlag = flyArgs.some((arg) => arg === '--ha' || arg.startsWith('--ha='));
  const versionArgs = trackerVersionOverride
    ? ['--build-arg', `TRACKER_VERSION_OVERRIDE=${trackerVersionOverride}`]
    : [];
  const deployArgs = [
    ...(hasHaFlag ? [] : ['--ha=false']),
    ...versionArgs,
    ...flyArgs
  ];

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
  const {
    trackerCoreVersion,
    trackerVersionOverride,
    dryRun,
    restoreLinkAfter,
    flyArgs
  } = parseArgs(process.argv.slice(2));

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
    console.log(`   landing page version:        ${trackerVersionOverride || 'package.json version'}`);
    return;
  }

  try {
    const selectedVersion = await runVersionChecks({
      requestedVersion: trackerCoreVersion,
      promptOnAuto: false,
      allowRelease: true,
      updatePackageJson: true,
      updatePackageLockFile: true
    });

    const resolved = readResolvedTrackerCore();
    console.log('\n📋 Fly deploy will use:');
    console.log(`   tracker-core tag:     ${selectedVersion}`);
    console.log(`   package version:      ${resolved.version}`);
    console.log(`   resolved dependency:  ${resolved.resolved}`);
    console.log(`   resolved commit:      ${resolved.commit}`);
    console.log(`   landing page version: ${trackerVersionOverride || 'package.json version'}`);

    generateVersionFile(trackerVersionOverride);
    runFlyDeploy(flyArgs, trackerVersionOverride);
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