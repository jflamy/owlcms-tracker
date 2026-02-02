#!/usr/bin/env node

/**
 * Shared packaging helpers for build-zip.js and release.js
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import readline from 'readline';
import { execSync } from 'child_process';
import { gt, valid } from 'semver';

export function promptConfirmation(message) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

export function fetchLatestGitHubTag(owner, repo) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}/tags`,
      method: 'GET',
      headers: {
        'User-Agent': 'owlcms-version-checker',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    https.get(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`GitHub API returned ${res.statusCode}: ${data.substring(0, 200)}`));
          return;
        }

        try {
          const tags = JSON.parse(data);

          if (!Array.isArray(tags) || tags.length === 0) {
            reject(new Error('No tags found in repository'));
            return;
          }

          const validTags = tags
            .map(tag => tag.name)
            .map(name => name.replace(/^v/, ''))
            .filter(version => valid(version))
            .sort((a, b) => (gt(a, b) ? -1 : gt(b, a) ? 1 : 0));

          if (validTags.length === 0) {
            reject(new Error('No valid semver tags found'));
            return;
          }

          resolve(validTags[0]);
        } catch (error) {
          reject(new Error(`Failed to parse GitHub API response: ${error.message}`));
        }
      });
    }).on('error', (error) => {
      reject(new Error(`Failed to fetch tags from GitHub: ${error.message}`));
    });
  });
}

export function checkTagExists(owner, repo, tag) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}/git/refs/tags/${tag}`,
      method: 'GET',
      headers: {
        'User-Agent': 'owlcms-version-checker',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    https.get(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(true);
        } else if (res.statusCode === 404) {
          resolve(false);
        } else {
          reject(new Error(`GitHub API returned ${res.statusCode}: ${data}`));
        }
      });
    }).on('error', (error) => {
      reject(new Error(`Failed to check tag: ${error.message}`));
    });
  });
}

export async function resolveTrackerCoreVersion({
  requestedVersion,
  promptOnAuto = false,
  allowRelease = false
} = {}) {
  let trackerCoreVersion = requestedVersion;

  if (!trackerCoreVersion) {
    trackerCoreVersion = await fetchLatestGitHubTag('owlcms', 'tracker-core');
    if (promptOnAuto) {
      const confirmed = await promptConfirmation(`Use tracker-core@${trackerCoreVersion}?`);
      if (!confirmed) {
        throw new Error('User cancelled version selection');
      }
    }
  }

  const exists = await checkTagExists('owlcms', 'tracker-core', trackerCoreVersion);
  if (!exists) {
    if (!allowRelease) {
      throw new Error(`tracker-core version '${trackerCoreVersion}' does not exist`);
    }
    const runRelease = await promptConfirmation(`tracker-core@${trackerCoreVersion} not found. Run tracker-core release now?`);
    if (!runRelease) {
      throw new Error(`tracker-core version '${trackerCoreVersion}' not found`);
    }

    execSync(`cd ../tracker-core && npm run release -- ${trackerCoreVersion}`, { stdio: 'inherit' });
  }

  return trackerCoreVersion;
}

export function updateTrackerCoreDependency({ packageJsonPath, trackerCoreVersion }) {
  if (!packageJsonPath) {
    throw new Error('packageJsonPath is required to update tracker-core dependency');
  }
  updatePackageJsonDependency(packageJsonPath, trackerCoreVersion);
}

export function refreshPackageLock({ packageLockPath = 'package-lock.json' } = {}) {
  try {
    const packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));
    delete packageLock.packages?.['node_modules/@owlcms/tracker-core'];
    if (packageLock.dependencies) {
      delete packageLock.dependencies['@owlcms/tracker-core'];
    }
    fs.writeFileSync(packageLockPath, JSON.stringify(packageLock, null, 2) + '\n');
    console.log('✓ Removed stale tracker-core entry from package-lock.json');
  } catch (error) {
    console.log('⚠️  Could not modify package-lock.json (will try fresh install)');
  }

  console.log('\n📥 Updating package-lock.json...');
  execSync('npm install --package-lock-only', { stdio: 'inherit' });
  console.log('✓ package-lock.json updated (node_modules unchanged)');
}

export async function runVersionChecks({
  requestedVersion,
  promptOnAuto = false,
  allowRelease = false,
  updatePackageJson = false,
  updatePackageLockFile = false,
  packageJsonPath = 'package.json',
  packageLockPath = 'package-lock.json'
} = {}) {
  const trackerCoreVersion = await resolveTrackerCoreVersion({
    requestedVersion,
    promptOnAuto,
    allowRelease
  });

  if (updatePackageJson) {
    updateTrackerCoreDependency({ packageJsonPath, trackerCoreVersion });
    console.log(`✓ Updated ${packageJsonPath} to tracker-core@${trackerCoreVersion}`);
  }

  if (updatePackageLockFile) {
    refreshPackageLock({ packageLockPath });
  }

  return trackerCoreVersion;
}

export function updatePackageJsonDependency(filePath, trackerCoreVersion) {
  const pkg = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  pkg.dependencies = pkg.dependencies || {};
  pkg.dependencies['@owlcms/tracker-core'] = `github:owlcms/tracker-core#${trackerCoreVersion}`;
  fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2) + '\n');
}

/**
 * Scan plugins for additional dependencies declared in config.js
 * Looks in src/plugins/ (source) and extensions/ (runtime)
 * @returns {string[]} Array of npm package specifiers to install
 */
function scanPluginDependencies() {
  const deps = new Set();
  
  // Scan source plugins (nested: src/plugins/category/plugin-name/)
  const srcPlugins = 'src/plugins';
  if (fs.existsSync(srcPlugins)) {
    const categories = fs.readdirSync(srcPlugins);
    for (const category of categories) {
      const categoryPath = path.join(srcPlugins, category);
      if (fs.statSync(categoryPath).isDirectory()) {
        scanPluginDir(categoryPath, deps);
      }
    }
  }
  
  // Scan extensions (nested structure: extensions/RepoName/plugin-name/)
  const extensionsDir = 'extensions';
  if (fs.existsSync(extensionsDir)) {
    const repos = fs.readdirSync(extensionsDir);
    for (const repo of repos) {
      const repoPath = path.join(extensionsDir, repo);
      if (fs.statSync(repoPath).isDirectory()) {
        scanPluginDir(repoPath, deps);
      }
    }
  }
  
  return Array.from(deps);
}

/**
 * Scan a directory for plugins with config.js containing additionalDependencies
 */
function scanPluginDir(dir, deps) {
  if (!fs.existsSync(dir)) return;
  
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const entryPath = path.join(dir, entry);
    if (!fs.statSync(entryPath).isDirectory()) continue;
    
    const configPath = path.join(entryPath, 'config.js');
    if (!fs.existsSync(configPath)) continue;
    
    try {
      const configContent = fs.readFileSync(configPath, 'utf8');
      
      // Look for additionalDependencies array in the config
      const match = configContent.match(/additionalDependencies\s*:\s*\[([^\]]*)\]/);
      if (match) {
        const depsArray = match[1]
          .split(',')
          .map(s => s.trim().replace(/['"]/g, ''))
          .filter(s => s.length > 0);
        
        for (const dep of depsArray) {
          deps.add(dep);
          console.log(`  📎 ${entry} requires: ${dep}`);
        }
      }
    } catch (err) {
      console.log(`  ⚠️ Could not parse ${entry}/config.js: ${err.message}`);
    }
  }
}

export function buildAndPackage({
  distDir,
  version,
  trackerCoreVersion,
  updateDistDependency = true
}) {
  const DIST_DIR = distDir || 'dist/package';

  // Ensure dist directory exists
  fs.mkdirSync('dist', { recursive: true });

  // Clean dist directory
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true });
  }
  fs.mkdirSync(DIST_DIR, { recursive: true });

  // Remove experimental plugins (manual runs)
  if (fs.existsSync('src/plugins/experiments')) {
    fs.rmSync('src/plugins/experiments', { recursive: true });
    console.log('✓ Removed src/plugins/experiments');
  }

  // Build application (extensions/ is not processed by Vite, no need to move it)
  console.log('\n🏗️  Building application...');
  execSync('npm run build', {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=4096'
    }
  });

  // Remove pre-compressed files (server-side only)
  execSync("find build/client -name '*.gz' -delete", { stdio: 'inherit' });
  execSync("find build/client -name '*.br' -delete", { stdio: 'inherit' });
  console.log('✓ Removed .gz and .br files from build');

  // Copy required files
  const filesToCopy = [
    'start-with-ws.js',
    'package.json'
  ];

  filesToCopy.forEach(file => {
    if (fs.existsSync(file)) {
      fs.copyFileSync(file, path.join(DIST_DIR, file));
      console.log(`✓ Copied ${file}`);
    }
  });

  // Update tracker-core dependency inside the packaged copy
  if (updateDistDependency && trackerCoreVersion) {
    updatePackageJsonDependency(path.join(DIST_DIR, 'package.json'), trackerCoreVersion);
    console.log(`✓ Set tracker-core@${trackerCoreVersion} in packaged package.json`);
  }

  // Copy build directory
  function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    const files = fs.readdirSync(src);
    files.forEach(file => {
      const srcPath = path.join(src, file);
      const destPath = path.join(dest, file);
      if (fs.statSync(srcPath).isDirectory()) {
        copyDir(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    });
  }

  copyDir('build', path.join(DIST_DIR, 'build'));
  console.log('✓ Copied build/');

  // Copy extensions directory (runtime plugins) if it exists
  if (fs.existsSync('extensions')) {
    copyDir('extensions', path.join(DIST_DIR, 'extensions'));
    console.log('✓ Copied extensions/ to package');
  } else {
    console.log('⚠ No runtime extensions to include');
  }

  // Install production dependencies only
  console.log('\n📥 Installing production dependencies...');
  execSync(`npm install --omit=dev --prefix ${DIST_DIR} --no-package-lock --no-save`, { stdio: 'inherit' });

  // Scan source plugins for additional dependencies and install them
  const additionalDeps = scanPluginDependencies();
  if (additionalDeps.length > 0) {
    console.log(`\n📦 Installing plugin additional dependencies: ${additionalDeps.join(', ')}`);
    execSync(`npm install --omit=dev --prefix ${DIST_DIR} --no-package-lock --no-save ${additionalDeps.join(' ')}`, { stdio: 'inherit' });
  }

  // Remove any accidental self-dependency (prevents recursive packaging)
  const selfDepPath = path.join(DIST_DIR, 'node_modules', 'owlcms-tracker');
  if (fs.existsSync(selfDepPath)) {
    fs.rmSync(selfDepPath, { recursive: true });
    console.log('✓ Removed nested node_modules/owlcms-tracker');
  }
  const lockPath = path.join(DIST_DIR, 'package-lock.json');
  if (fs.existsSync(lockPath)) {
    fs.rmSync(lockPath);
    console.log('✓ Removed package-lock.json from package');
  }

  // Create README
  const readme = `OWLCMS Competition Tracker
==========================

This package contains the tracker application files.
It is intended to be launched by the OWLCMS control panel.

REQUIREMENTS:
=============
- Node.js 22+ installed (https://nodejs.org/)

MANUAL LAUNCH (if needed):
==========================
  node start-with-ws.js

OWLCMS CONFIGURATION:
====================
In OWLCMS, go to:
  Prepare Competition → Language and System Settings → Connections
  
Set "URL for Video Data" to:
  ws://localhost:8096/ws

The tracker will receive competition data automatically.
`;

  fs.writeFileSync(path.join(DIST_DIR, 'README.txt'), readme);
  console.log('✓ Created README.txt');

  // Create zip
  console.log('\n📦 Creating ZIP archive...');
  const zipName = version ? `owlcms-tracker_${version}.zip` : 'owlcms-tracker.zip';

  if (fs.existsSync(`dist/${zipName}`)) {
    fs.unlinkSync(`dist/${zipName}`);
  }

  const isWindows = process.platform === 'win32';
  if (isWindows) {
    const sevenZipPath = fs.existsSync('C:/Program Files/7-Zip/7z.exe')
      ? '"C:/Program Files/7-Zip/7z.exe"'
      : '7z';
    try {
      execSync(`${sevenZipPath} a -tzip ../${zipName} .`, { cwd: DIST_DIR, stdio: 'inherit' });
    } catch {
      execSync(`powershell -Command "Compress-Archive -Path '${DIST_DIR}/*' -DestinationPath 'dist/${zipName}' -Force"`, { stdio: 'inherit' });
    }
  } else {
    execSync(`cd ${DIST_DIR} && zip -r ../${zipName} .`, { stdio: 'inherit' });
  }

  console.log(`\n✅ Package created: dist/${zipName}`);

  const stats = fs.statSync(`dist/${zipName}`);
  console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
}
