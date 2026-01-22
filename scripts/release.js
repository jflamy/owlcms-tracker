#!/usr/bin/env node

/**
 * Prepare and trigger release - Complete automation
 * 
 * Usage: npm run release -- <tracker-version> [tracker-core-version]
 * 
 * Examples:
 *   npm run release -- 2.4.0
 *   npm run release -- 2.4.0 1.0.0-beta02
 * 
 * This script:
 * 1. Fetches latest tracker-core version from GitHub if not specified
 * 2. Uses npm pkg set to update the dependency
 * 3. Runs npm install to update package-lock.json
 * 4. Commits and pushes
 * 5. Triggers GitHub Actions workflow
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkTagExists, fetchLatestGitHubTag, promptConfirmation, runVersionChecks } from './package-shared.js';

function getDirtyPaths() {
  try {
    const out = execSync('git status --porcelain', { encoding: 'utf8' });
    if (!out.trim()) return [];

    return out
      .split(/\r?\n/)
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return null;
        
        // Porcelain format: 'XY path' where X and Y are status codes (2 chars)
        // Example: ' M package.json' or 'M  package.json' or 'MM package.json'
        const arrowIndex = trimmed.indexOf('->');
        if (arrowIndex !== -1) {
          // Rename: 'R  old -> new'
          return trimmed.slice(arrowIndex + 2).trim();
        }
        
        // Skip first 2 characters (status codes) and any following spaces
        // Status codes are always exactly 2 characters followed by space(s)
        let path = trimmed.substring(2).trim();
        return path;
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function assertCleanWorkingTree({ allowedDirty = [] }) {
  const dirty = getDirtyPaths();
  if (dirty.length === 0) return;

  const allowedSet = new Set(allowedDirty);
  const notAllowed = dirty.filter((p) => !allowedSet.has(p));

  if (notAllowed.length > 0) {
    console.error('❌ Working tree has uncommitted changes.');
    console.error('Please commit or stash these files before running release:');
    for (const p of notAllowed) console.error(`  - ${p}`);
    console.error('');
    console.error('Allowed (can be dirty at start):');
    for (const p of allowedDirty) console.error(`  - ${p}`);
    process.exit(1);
  }
}

function remoteReleaseExists(tag) {
  try {
    execSync(`gh release view "${tag}"`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function remoteTagExists(tag) {
  try {
    // Uses the current repo context; returns non-zero if the ref doesn't exist.
    execSync(`gh api repos/owlcms/owlcms-tracker/git/ref/tags/${tag}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function getCurrentBranch() {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    if (!branch || branch === 'HEAD') return null;
    return branch;
  } catch {
    return null;
  }
}

/**
 * Prompt user for confirmation
 * @param {string} message - The confirmation message
 * @returns {Promise<boolean>} true if user confirms, false otherwise
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse arguments
const args = process.argv.slice(2);
const includeSubmodules = args.includes('--submodules');
const positional = args.filter((arg) => arg !== '--submodules');
const version = positional[0];
let trackerCoreVersion = positional[1]; // Optional

if (!version) {
  console.error('❌ Error: Version number required');
  console.error('Usage: npm run release -- <tracker-version> [tracker-core-version] [--submodules]');
  console.error('Examples:');
  console.error('  npm run release -- 2.4.0');
  console.error('  npm run release -- 2.4.0 1.0.0-beta02');
  console.error('  npm run release -- 2.4.0 --submodules');
  console.error('  npm run release -- 2.4.0 1.0.0-beta02 --submodules');
  process.exit(1);
}

// Validate semver format (basic check)
if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$/.test(version)) {
  console.error(`❌ Error: Invalid semver format: ${version}`);
  console.error('Expected format: X.Y.Z or X.Y.Z-beta01 or X.Y.Z+build123');
  process.exit(1);
}

console.log(`📦 Preparing release ${version}...\n`);

// Safety: release must start from a clean working tree, except for files that the script will modify/commit.
assertCleanWorkingTree({ allowedDirty: ['ReleaseNotes.md', 'package.json', 'package-lock.json'] });

// Check for existing tag/release BEFORE modifying any files
if (remoteTagExists(version) || remoteReleaseExists(version)) {
  console.error(`❌ Refusing to start: tag or release already exists for ${version}`);
  console.error('Pick a new version number, or manually handle the existing release/tag.');
  console.error('If you need to delete the tag: git push --delete origin ${version} && git tag -d ${version}');
  process.exit(1);
}

// Resolve tracker-core version (fetch latest if not provided) and update deps
try {
  trackerCoreVersion = await runVersionChecks({
    requestedVersion: trackerCoreVersion,
    promptOnAuto: true,
    allowRelease: true,
    updatePackageJson: true,
    updatePackageLockFile: true
  });
  console.log(`✓ Using tracker-core@${trackerCoreVersion}\n`);
} catch (error) {
  console.error(`❌ Failed to resolve tracker-core version: ${error.message}`);
  process.exit(1);
}

// Update version and dependency using npm pkg set
console.log(`📝 Updating package.json version to ${version}...`);
try {
  execSync(`npm pkg set version=${version}`, { stdio: 'inherit' });
  console.log('✓ Version updated');
} catch (error) {
  console.error('❌ Failed to update version:', error.message);
  process.exit(1);
}

// Dependency + lock updates handled by runVersionChecks

// Show what we got
console.log('\n📋 Checking installed version...');
try {
  const packageLock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
  const trackerCoreInfo = packageLock.packages['node_modules/@owlcms/tracker-core'];
  if (trackerCoreInfo) {
    const commitHash = trackerCoreInfo.resolved?.split('#')[1] || 'unknown';
    console.log(`   Resolved: ${trackerCoreInfo.resolved}`);
    console.log(`   Commit: ${commitHash}`);
  }
} catch (error) {
  console.log('⚠️  Could not read package-lock.json details');
}

// Commit and push
console.log('\n💾 Committing changes...');
try {
  execSync('git add package.json package-lock.json ReleaseNotes.md', { stdio: 'inherit' });
  execSync(`git commit -m "chore: update tracker-core to ${trackerCoreVersion} for release ${version}"`, { stdio: 'inherit' });
  console.log('✓ Committed');
} catch (error) {
  console.log('⚠️  No changes to commit (already up to date)');
}

console.log('\n🚀 Pushing changes...');
try {
  execSync('git push', { stdio: 'inherit' });
  console.log('✓ Pushed');
} catch (error) {
  console.error('❌ Failed to push:', error.message);
  process.exit(1);
}

// Trigger GitHub Actions workflow using gh CLI
console.log(`\n▶️  Triggering release workflow for version ${version}...`);
try {
  // Ensure we don't trigger a workflow from a dirty working tree.
  assertCleanWorkingTree({ allowedDirty: [] });

  const branch = getCurrentBranch();
  if (!branch) {
    console.error('❌ Cannot determine current branch (detached HEAD?).');
    console.error('Please checkout a branch (e.g. main) and re-run.');
    process.exit(1);
  }

  // Final check before triggering workflow (redundant safety - already checked at start)
  if (remoteTagExists(version) || remoteReleaseExists(version)) {
    console.error(`❌ Refusing to run: tag or release already exists for ${version}`);
    console.error('This should have been caught earlier - possible race condition.');
    process.exit(1);
  }

  // Trigger the workflow on the pushed branch ref
  const submodulesArg = includeSubmodules ? ' -f includeSubmodules=true' : ' -f includeSubmodules=false';
  execSync(`gh workflow run release.yaml --ref ${branch} -f revision=${version}${submodulesArg}`, { stdio: 'inherit' });
  console.log('✓ Workflow triggered');
  console.log('⏳ Waiting 15 seconds for GitHub to queue the run...');
  sleepSync(15000);
} catch (error) {
  console.error('⚠️  Failed to trigger workflow via gh CLI');
  console.error(`Error: ${error.message}`);
  console.error('\nMake sure GitHub CLI is installed and authenticated:');
  console.error('  gh auth status');
  console.error('\nYou can manually trigger the workflow at:');
  console.error('  https://github.com/owlcms/owlcms-tracker/actions/workflows/release.yaml');
  process.exit(1);
}

function sleepSync(ms) {
  const sab = new SharedArrayBuffer(4);
  const int32 = new Int32Array(sab);
  Atomics.wait(int32, 0, 0, ms);
}

// Get the most recent run ID for release.yaml workflow
console.log('\n👀 Watching GitHub Actions run (via gh)...');
let runId;
try {
  const runsJson = execSync('gh run list --workflow=release.yaml --limit=1 --json databaseId', { encoding: 'utf8' });
  const runs = JSON.parse(runsJson);
  if (runs.length > 0) {
    runId = runs[0].databaseId;
  }
} catch (e) {
  console.error('⚠️  Could not get run ID - view manually at:');
  console.error('    https://github.com/owlcms/owlcms-tracker/actions');
  process.exit(1);
}

if (!runId) {
  console.error('⚠️  No workflow runs found - view manually at:');
  console.error('    https://github.com/owlcms/owlcms-tracker/actions');
  process.exit(1);
}

try {
  execSync(`gh run watch ${runId} --exit-status`, { stdio: 'inherit' });
} catch (watchError) {
  console.error('\n❌ Workflow failed or was cancelled.');
  console.log('\n📋 Fetching failed job logs...');
  try {
    execSync(`gh run view ${runId} --log-failed`, { stdio: 'inherit' });
  } catch (logError) {
    console.error('⚠️  Could not fetch logs - view manually at:');
    console.error('    https://github.com/owlcms/owlcms-tracker/actions');
  }
  process.exit(1);
}

console.log(`\n✅ Release ${version} complete!`);
console.log(`   Tracker version: ${version}`);
console.log(`   Tracker-core version: ${trackerCoreVersion}`);
