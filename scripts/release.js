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
 * 1. Removes the npm link
 * 2. Installs tracker-core (latest or specific version) from GitHub
 * 3. Updates package-lock.json
 * 4. Commits and pushes
 * 5. Triggers GitHub Actions workflow
 * 6. Re-links tracker-core for continued development
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse arguments
const version = process.argv[2];
const trackerCoreVersion = process.argv[3]; // Optional

if (!version) {
  console.error('❌ Error: Version number required');
  console.error('Usage: npm run release -- <tracker-version> [tracker-core-version]');
  console.error('Examples:');
  console.error('  npm run release -- 2.4.0');
  console.error('  npm run release -- 2.4.0 1.0.0-beta02');
  process.exit(1);
}

// Validate semver format (basic check)
if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$/.test(version)) {
  console.error(`❌ Error: Invalid semver format: ${version}`);
  console.error('Expected format: X.Y.Z or X.Y.Z-beta01 or X.Y.Z+build123');
  process.exit(1);
}

console.log(`📦 Preparing release ${version}...\n`);

// Check if we're in linked mode
const trackerCorePath = path.join(process.cwd(), 'node_modules', '@owlcms', 'tracker-core');
let wasLinked = false;
try {
  const stats = fs.lstatSync(trackerCorePath);
  if (stats.isSymbolicLink()) {
    wasLinked = true;
    console.log('🔗 Detected linked tracker-core, unlinking...');
    execSync('npm unlink --no-save @owlcms/tracker-core', { stdio: 'inherit' });
  } else {
    console.log('✓ Already using installed tracker-core (not linked)');
  }
} catch (error) {
  console.log('✓ tracker-core not found (will be installed)');
}

// Update to latest or specific version from GitHub
if (trackerCoreVersion) {
  console.log(`\n📥 Installing tracker-core version ${trackerCoreVersion} from GitHub...`);
  // Install specific tag from GitHub
  execSync(`npm install github:owlcms/tracker-core#${trackerCoreVersion}`, { stdio: 'inherit' });
} else {
  console.log('\n📥 Updating tracker-core to latest from GitHub...');
  execSync('npm update @owlcms/tracker-core', { stdio: 'inherit' });
}

// Show what we got
console.log('\n📋 Checking installed version...');
const packageLock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const trackerCoreInfo = packageLock.packages['node_modules/@owlcms/tracker-core'];
const commitHash = trackerCoreInfo.resolved.split('#')[1];
console.log(`   Resolved: ${trackerCoreInfo.resolved}`);
console.log(`   Commit: ${commitHash}`);

// Commit and push
console.log('\n💾 Committing changes...');
try {
  execSync('git add package.json package-lock.json ReleaseNotes.md', { stdio: 'inherit' });
  execSync(`git commit -m "chore: update tracker-core for release ${version}"`, { stdio: 'inherit' });
  console.log('✓ Committed');
} catch (error) {
  console.log('⚠️  No changes to commit (already up to date)');
}

console.log('\n🚀 Pushing changes...');
execSync('git push', { stdio: 'inherit' });
console.log('✓ Pushed');

// Trigger GitHub Actions workflow using gh CLI
console.log(`\n▶️  Triggering release workflow for version ${version}...`);
try {
  execSync(`gh workflow run release.yaml -f revision=${version}`, { stdio: 'inherit' });
  console.log('✓ Workflow triggered');
} catch (error) {
  console.error('⚠️  Failed to trigger workflow via gh CLI');
  console.error('Make sure GitHub CLI is installed and authenticated:');
  console.error('  gh auth login');
  console.error('\nYou can manually trigger the workflow at:');
  console.error('  https://github.com/owlcms/owlcms-tracker/actions/workflows/release.yaml');
  process.exit(1);
}

// Re-link tracker-core (assuming sibling directories)
if (wasLinked) {
  console.log('\n🔗 Re-linking tracker-core for development...');
  const trackerCoreSiblingPath = path.resolve(process.cwd(), '..', 'tracker-core');
  if (fs.existsSync(trackerCoreSiblingPath)) {
    try {
      // First ensure tracker-core is linked globally
      execSync('npm link', { cwd: trackerCoreSiblingPath, stdio: 'inherit' });
      // Then link it here
      execSync('npm link @owlcms/tracker-core', { stdio: 'inherit' });
      console.log('✓ Re-linked tracker-core');
    } catch (error) {
      console.error('⚠️  Failed to re-link tracker-core:', error.message);
      console.log('You can manually re-link with: npm link @owlcms/tracker-core');
    }
  } else {
    console.log('⚠️  tracker-core not found at:', trackerCoreSiblingPath);
    console.log('You can manually re-link with: npm link @owlcms/tracker-core');
  }
}

console.log(`\n✅ Release ${version} initiated!`);
console.log('\nGitHub Actions will now build and create the release.');
console.log('Monitor progress at: https://github.com/owlcms/owlcms-tracker/actions');
