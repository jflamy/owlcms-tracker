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

function listDirectoryNames(rootDir) {
  if (!fs.existsSync(rootDir)) return [];

  return fs.readdirSync(rootDir)
    .filter((entry) => fs.statSync(path.join(rootDir, entry)).isDirectory())
    .sort((a, b) => a.localeCompare(b));
}

function readGitSubmodules(gitmodulesPath = '.gitmodules') {
  if (!fs.existsSync(gitmodulesPath)) return [];

  const gitmodules = fs.readFileSync(gitmodulesPath, 'utf8');
  const matches = [...gitmodules.matchAll(/\[submodule "([^"]+)"\][\s\S]*?path = ([^\r\n]+)/g)];

  return matches.map(([, name, submodulePathRaw]) => {
    const submodulePath = submodulePathRaw.trim();
    let type = 'other';
    let topLevel = null;

    if (submodulePath.startsWith('src/plugins/')) {
      type = 'plugin';
      topLevel = submodulePath.split(/[\\/]/)[2] || null;
    } else if (submodulePath.startsWith('extensions/')) {
      type = 'extension';
      topLevel = submodulePath.split(/[\\/]/)[1] || null;
    }

    return {
      name,
      path: submodulePath,
      type,
      topLevel,
      baseName: path.basename(submodulePath)
    };
  });
}

function normalizeRequestedSubmodules(selectedSubmodules = []) {
  return selectedSubmodules
    .map((item) => item.replace(/^[.][\\/]/, '').replace(/^src\/plugins[\\/]/, '').replace(/^extensions[\\/]/, '').trim())
    .filter(Boolean);
}

function resolveSelectedSubmodules(selectedSubmodules = []) {
  const allSubmodules = readGitSubmodules();
  const requested = normalizeRequestedSubmodules(selectedSubmodules);
  const aliasMap = new Map();

  for (const submodule of allSubmodules) {
    const aliases = new Set([
      submodule.name,
      submodule.path,
      submodule.baseName
    ]);

    if (submodule.topLevel) {
      aliases.add(submodule.topLevel);
    }

    for (const alias of aliases) {
      aliasMap.set(alias.toLowerCase(), submodule);
    }
  }

  const resolved = [];
  const missing = [];

  for (const item of requested) {
    const match = aliasMap.get(item.toLowerCase());
    if (match) {
      resolved.push(match);
    } else {
      missing.push(item);
    }
  }

  if (missing.length > 0) {
    const available = allSubmodules.map((submodule) => submodule.path).join(', ') || '(none)';
    throw new Error(`Requested submodule(s) not found: ${missing.join(', ')}. Available: ${available}`);
  }

  const uniqueResolved = requested.length === 0
    ? allSubmodules
    : Array.from(new Map(resolved.map((submodule) => [submodule.path, submodule])).values());

  const missingPaths = uniqueResolved
    .filter((submodule) => !fs.existsSync(submodule.path))
    .map((submodule) => submodule.path);

  if (missingPaths.length > 0) {
    throw new Error(`Selected submodule path(s) are not available in this workspace: ${missingPaths.join(', ')}`);
  }

  return {
    all: allSubmodules,
    selected: uniqueResolved,
    hasSelection: requested.length > 0
  };
}

function computeAllowedTopLevelDirs({ rootDir, type, selectedSubmodules = [], noStandard = false }) {
  const currentDirs = listDirectoryNames(rootDir);
  const submodules = resolveSelectedSubmodules(selectedSubmodules);
  const allTopLevels = new Set(submodules.all.filter((submodule) => submodule.type === type && submodule.topLevel).map((submodule) => submodule.topLevel));
  const selectedTopLevels = new Set(submodules.selected.filter((submodule) => submodule.type === type && submodule.topLevel).map((submodule) => submodule.topLevel));

  if (!noStandard && !submodules.hasSelection) {
    return currentDirs;
  }

  const allowed = new Set();

  if (!noStandard) {
    for (const dir of currentDirs) {
      if (!allTopLevels.has(dir)) {
        allowed.add(dir);
      }
    }
  }

  for (const dir of selectedTopLevels) {
    allowed.add(dir);
  }

  return currentDirs.filter((dir) => allowed.has(dir));
}

function extractDelegateTarget(configContent) {
  const match = configContent.match(/delegateTo\s*:\s*['\"]([^'\"]+)['\"]/);
  return match ? match[1].trim() : null;
}

function findDelegatedPluginIds(extensionRepoNames = []) {
  const delegated = new Set();

  for (const repoName of extensionRepoNames) {
    const repoPath = path.join('extensions', repoName);
    if (!fs.existsSync(repoPath)) continue;

    for (const entry of fs.readdirSync(repoPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;

      const configPath = path.join(repoPath, entry.name, 'config.js');
      if (!fs.existsSync(configPath)) continue;

      const delegateTarget = extractDelegateTarget(fs.readFileSync(configPath, 'utf8'));
      if (delegateTarget) {
        delegated.add(delegateTarget);
      }
    }
  }

  return delegated;
}

function computeBuildSelection({ selectedSubmodules = [], noStandard = false, includeExtensions = false, allowedExtensionDirs = [] }) {
  const submodules = resolveSelectedSubmodules(selectedSubmodules);
  const pluginSubmoduleTopLevels = new Set(
    submodules.all
      .filter((submodule) => submodule.type === 'plugin' && submodule.topLevel)
      .map((submodule) => submodule.topLevel)
  );
  const selectedPluginSubmoduleTopLevels = new Set(
    submodules.selected
      .filter((submodule) => submodule.type === 'plugin' && submodule.topLevel)
      .map((submodule) => submodule.topLevel)
  );
  const delegatedPluginIds = includeExtensions && noStandard
    ? findDelegatedPluginIds(allowedExtensionDirs)
    : new Set();

  return {
    noStandard,
    pluginSubmoduleTopLevels,
    selectedPluginSubmoduleTopLevels,
    delegatedPluginIds,
    allowedExtensionDirs: new Set(allowedExtensionDirs),
    includeStandardExtensionFiles: !noStandard
  };
}

function hasAllowedStandardPluginInCategory(category, delegatedPluginIds) {
  return Array.from(delegatedPluginIds).some((pluginId) => pluginId.startsWith(`${category}/`));
}

function shouldCopyWorkspaceEntry(relativePath, isDirectory, selection) {
  const normalized = relativePath.split(path.sep).join('/');
  const parts = normalized.split('/').filter(Boolean);

  if (parts.length === 0) {
    return true;
  }

  const topLevel = parts[0];
  if (['.git', 'node_modules', 'build', 'dist', '.svelte-kit', '.vite', '.idea', '.vscode'].includes(topLevel)) {
    return false;
  }

  if (topLevel === 'extensions') {
    if (parts.length === 1) return true;
    if (parts[1] === 'README.md') {
      return selection.includeStandardExtensionFiles;
    }
    return selection.allowedExtensionDirs.has(parts[1]);
  }

  if (topLevel === 'src' && parts[1] === 'plugins') {
    if (parts.length <= 2) return true;

    const category = parts[2];
    if (selection.pluginSubmoduleTopLevels.has(category)) {
      return selection.selectedPluginSubmoduleTopLevels.has(category);
    }

    if (!selection.noStandard) {
      return true;
    }

    if (parts.length === 3) {
      return hasAllowedStandardPluginInCategory(category, selection.delegatedPluginIds);
    }

    const pluginId = `${category}/${parts[3]}`;
    return selection.delegatedPluginIds.has(pluginId);
  }

  return true;
}

function copyWorkspaceForBuild(sourceRoot, workspaceRoot, selection) {
  const copyRecursive = (currentSourceDir, currentDestDir, relativeDir = '') => {
    fs.mkdirSync(currentDestDir, { recursive: true });

    for (const entry of fs.readdirSync(currentSourceDir, { withFileTypes: true })) {
      const entrySourcePath = path.join(currentSourceDir, entry.name);
      const entryRelativePath = relativeDir ? path.join(relativeDir, entry.name) : entry.name;

      if (!shouldCopyWorkspaceEntry(entryRelativePath, entry.isDirectory(), selection)) {
        continue;
      }

      const entryDestPath = path.join(currentDestDir, entry.name);
      if (entry.isDirectory()) {
        copyRecursive(entrySourcePath, entryDestPath, entryRelativePath);
      } else {
        fs.mkdirSync(path.dirname(entryDestPath), { recursive: true });
        fs.copyFileSync(entrySourcePath, entryDestPath);
      }
    }
  };

  copyRecursive(sourceRoot, workspaceRoot);
}

function linkBuildWorkspaceNodeModules(repoRoot, workspaceRoot) {
  const sourceNodeModules = path.join(repoRoot, 'node_modules');
  const workspaceNodeModules = path.join(workspaceRoot, 'node_modules');

  if (!fs.existsSync(sourceNodeModules)) {
    throw new Error(`Required dependency directory not found: ${sourceNodeModules}`);
  }

  if (fs.existsSync(workspaceNodeModules)) {
    fs.rmSync(workspaceNodeModules, { recursive: true, force: true });
  }

  fs.symlinkSync(sourceNodeModules, workspaceNodeModules, process.platform === 'win32' ? 'junction' : 'dir');
}

/**
 * Scan plugins for additional dependencies declared in config.js
 * Looks in src/plugins/ (source) and selected extensions/ (runtime)
 * @returns {string[]} Array of npm package specifiers to install
 */
function scanPluginDependencies({ srcPluginsDir = 'src/plugins', includeExtensions = true, extensionsDir = 'extensions', allowedExtensionDirs = null } = {}) {
  const deps = new Set();
  
  // Scan source plugins (nested: src/plugins/category/plugin-name/)
  if (fs.existsSync(srcPluginsDir)) {
    const categories = fs.readdirSync(srcPluginsDir);
    for (const category of categories) {
      const categoryPath = path.join(srcPluginsDir, category);
      if (fs.statSync(categoryPath).isDirectory()) {
        scanPluginDir(categoryPath, deps);
      }
    }
  }
  
  // Scan extensions (nested structure: extensions/RepoName/plugin-name/)
  if (includeExtensions && fs.existsSync(extensionsDir)) {
    const repos = allowedExtensionDirs ?? listDirectoryNames(extensionsDir);
    for (const repo of repos) {
      const repoPath = path.join(extensionsDir, repo);
      scanPluginDir(repoPath, deps);
    }
  }

  return Array.from(deps);
}

function copySelectedExtensions({ distDir, sourceDir = 'extensions', includeStandardFiles = true, allowedExtensionDirs = [] }) {
  const destDir = path.join(distDir, 'extensions');

  fs.mkdirSync(destDir, { recursive: true });

  if (includeStandardFiles && fs.existsSync(path.join(sourceDir, 'README.md'))) {
    fs.copyFileSync(path.join(sourceDir, 'README.md'), path.join(destDir, 'README.md'));
    console.log('✓ Copied extensions/README.md');
  }

  if (!fs.existsSync(sourceDir)) {
    return 0;
  }

  for (const repo of allowedExtensionDirs) {
    copyDir(path.join(sourceDir, repo), path.join(destDir, repo));
    console.log(`✓ Copied extensions/${repo}`);
  }

  return allowedExtensionDirs.length;
}

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
  updateDistDependency = true,
  includeExtensions = false,
  selectedSubmodules = [],
  noStandard = false
}) {
  const DIST_DIR = distDir || 'dist/package';
  const BUILD_WORKSPACE_DIR = path.join('dist', 'build-workspace');
  const repoRoot = process.cwd();
  const allowedExtensionDirs = computeAllowedTopLevelDirs({
    rootDir: 'extensions',
    type: 'extension',
    selectedSubmodules,
    noStandard
  });
  const buildSelection = computeBuildSelection({
    selectedSubmodules,
    noStandard,
    includeExtensions,
    allowedExtensionDirs
  });

  // Ensure dist directory exists
  fs.mkdirSync('dist', { recursive: true });

  if (fs.existsSync(BUILD_WORKSPACE_DIR)) {
    fs.rmSync(BUILD_WORKSPACE_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(BUILD_WORKSPACE_DIR, { recursive: true });
  copyWorkspaceForBuild(repoRoot, BUILD_WORKSPACE_DIR, buildSelection);
  linkBuildWorkspaceNodeModules(repoRoot, BUILD_WORKSPACE_DIR);

  try {
    // Clean dist directory
    if (fs.existsSync(DIST_DIR)) {
      fs.rmSync(DIST_DIR, { recursive: true });
    }
    fs.mkdirSync(DIST_DIR, { recursive: true });

    // Remove experimental plugins (manual runs)
    if (fs.existsSync(path.join(BUILD_WORKSPACE_DIR, 'src/plugins/experiments'))) {
      fs.rmSync(path.join(BUILD_WORKSPACE_DIR, 'src/plugins/experiments'), { recursive: true });
      console.log('✓ Removed src/plugins/experiments');
    }

    // Build application in isolated workspace to avoid mutating the live repo
    console.log('\n🏗️  Building application...');
    execSync('npm run build', {
      cwd: BUILD_WORKSPACE_DIR,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=4096',
        PATH: `${path.join(repoRoot, 'node_modules', '.bin')}${path.delimiter}${process.env.PATH || ''}`
      }
    });

    // Remove pre-compressed files (server-side only)
    execSync("find build/client -name '*.gz' -delete", { cwd: BUILD_WORKSPACE_DIR, stdio: 'inherit' });
    execSync("find build/client -name '*.br' -delete", { cwd: BUILD_WORKSPACE_DIR, stdio: 'inherit' });
    console.log('✓ Removed .gz and .br files from build');

    // Copy required files
    const filesToCopy = [
      'start-with-ws.js',
      'package.json'
    ];

    filesToCopy.forEach(file => {
      const sourcePath = path.join(BUILD_WORKSPACE_DIR, file);
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, path.join(DIST_DIR, file));
        console.log(`✓ Copied ${file}`);
      }
    });

    // Update tracker-core dependency inside the packaged copy
    if (updateDistDependency && trackerCoreVersion) {
      updatePackageJsonDependency(path.join(DIST_DIR, 'package.json'), trackerCoreVersion);
      console.log(`✓ Set tracker-core@${trackerCoreVersion} in packaged package.json`);
    }

    // Copy build directory
    copyDir(path.join(BUILD_WORKSPACE_DIR, 'build'), path.join(DIST_DIR, 'build'));
    console.log('✓ Copied build/');

    // Copy templates/ directories from any plugin (at any nesting depth) that has one.
    // These are static JSON assets needed at runtime (e.g., OBS scene collection templates).
    // JS code in plugins is NOT copied — it is either bundled by Vite or loaded at runtime.
    const pluginsDir = path.join(BUILD_WORKSPACE_DIR, 'src/plugins');
    if (fs.existsSync(pluginsDir)) {
      const findTemplates = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          const child = path.join(dir, entry.name);
          if (entry.name === 'templates') {
            const relativeChild = path.relative(BUILD_WORKSPACE_DIR, child);
            copyDir(child, path.join(DIST_DIR, relativeChild));
            console.log(`✓ Copied ${relativeChild}`);
          } else {
            findTemplates(child);
          }
        }
      };
      findTemplates(pluginsDir);
    }

    // Copy extensions directory (runtime plugins) if requested and exists
    const workspaceExtensionsDir = path.join(BUILD_WORKSPACE_DIR, 'extensions');
    if (includeExtensions && fs.existsSync(workspaceExtensionsDir)) {
      const copied = copySelectedExtensions({
        distDir: DIST_DIR,
        sourceDir: workspaceExtensionsDir,
        includeStandardFiles: !noStandard,
        allowedExtensionDirs
      });
      if (copied === 0) {
        console.log('⚠ No runtime extensions selected to include');
      }
    } else if (includeExtensions) {
      console.log('⚠ No runtime extensions to include');
    } else {
      // Create empty extensions folder with just the README
      fs.mkdirSync(path.join(DIST_DIR, 'extensions'), { recursive: true });
      if (!noStandard && fs.existsSync('extensions/README.md')) {
        fs.copyFileSync('extensions/README.md', path.join(DIST_DIR, 'extensions/README.md'));
        console.log('✓ Created extensions/ with README.md (plugins excluded for release)');
      } else {
        console.log('✓ Created empty extensions/ folder (plugins excluded for release)');
      }
    }

    // Install production dependencies only
    console.log('\n📥 Installing production dependencies...');
    execSync(`npm install --omit=dev --prefix ${DIST_DIR} --no-package-lock --no-save`, { stdio: 'inherit' });

    // Scan source plugins for additional dependencies and install them
    const workspaceAdditionalDeps = scanPluginDependencies({
      srcPluginsDir: path.join(BUILD_WORKSPACE_DIR, 'src/plugins'),
      includeExtensions,
      extensionsDir: workspaceExtensionsDir,
      allowedExtensionDirs
    });
    if (workspaceAdditionalDeps.length > 0) {
      console.log(`\n📦 Installing plugin additional dependencies: ${workspaceAdditionalDeps.join(', ')}`);
      execSync(`npm install --omit=dev --prefix ${DIST_DIR} --no-package-lock --no-save ${workspaceAdditionalDeps.join(' ')}`, { stdio: 'inherit' });
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
  } finally {
    if (fs.existsSync(BUILD_WORKSPACE_DIR)) {
      fs.rmSync(BUILD_WORKSPACE_DIR, { recursive: true, force: true });
    }
  }
}
