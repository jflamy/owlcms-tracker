#!/usr/bin/env node

/**
 * Prepare and trigger release - Complete automation
 * 
 * Usage: npm run prepare-release -- 2.4.0
 * 
 * This script:
 * 1. Removes the npm link
 * 2. Installs latest tracker-core from GitHub
 * 3. Updates package-lock.json
 * 4. Updates release.yaml with version number
 * 5. Commits and pushes (triggers GitHub Actions)
 * 6. Re-links tracker-core for continued development
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse arguments
const version = process.argv[2];
if (!version) {
  console.error('❌ Error: Version number required');
  console.error('Usage: npm run prepare-release -- 2.4.0');
  process.exit(1);
}

// Validate semver format (basic check)
if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(version)) {
  console.error(`❌ Error: Invalid semver format: ${version}`);
  console.error('Expected format: X.Y.Z or X.Y.Z-beta01');
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

// Update to latest from GitHub
console.log('\n📥 Updating tracker-core from GitHub...');
execSync('npm update @owlcms/tracker-core', { stdio: 'inherit' });

// Show what we got
console.log('\n📋 Checking installed version...');
const packageLock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const trackerCoreInfo = packageLock.packages['node_modules/@owlcms/tracker-core'];
const commitHash = trackerCoreInfo.resolved.split('#')[1];
console.log(`   Resolved: ${trackerCoreInfo.resolved}`);
console.log(`   Commit: ${commitHash}`);

// Update release.yaml with version number
console.log(`\n📝 Updating release.yaml with version ${version}...`);
const releaseYamlPath = path.join(process.cwd(), '.github', 'workflows', 'release.yaml');
let releaseYaml = fs.readFileSync(releaseYamlPath, 'utf8');
releaseYaml = releaseYaml.replace(
  /default: ['"][\d.]+(-[a-zA-Z0-9.]+)?['"]/,
  `default: '${version}'`
);
fs.writeFileSync(releaseYamlPath, releaseYaml, 'utf8');
console.log('✓ Updated release.yaml');

// Commit and push
console.log('\n💾 Committing changes...');
try {
  execSync('git add package-lock.json .github/workflows/release.yaml', { stdio: 'inherit' });
  execSync(`git commit -m "chore: prepare release ${version}"`, { stdio: 'inherit' });
  console.log('✓ Committed');
} catch (error) {
  console.log('⚠️  No changes to commit (already up to date)');
}

console.log('\n🚀 Pushing to trigger release workflow...');
execSync('git push', { stdio: 'inherit' });
console.log('✓ Pushed');

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
