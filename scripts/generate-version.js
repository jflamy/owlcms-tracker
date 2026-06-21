#!/usr/bin/env node

/**
 * Generate build-time version information for the tracker.
 *
 * Writes src/lib/server/version.json with:
 *   - trackerVersion       : version from this package.json
 *   - trackerCommit        : short git HEAD of the tracker repo
 *   - trackerCoreVersion   : resolved @owlcms/tracker-core version
 *   - trackerCoreCommit    : resolved @owlcms/tracker-core commit (if known)
 *   - builtAt              : ISO timestamp of generation
 *
 * Why a generated file: deployed containers (Fly) build with .git excluded
 * (see .dockerignore), so git is not available inside the Docker build. The
 * file is generated on the host (during `npm run build` and `deploy:fly`) and
 * copied into the image via `COPY . .`. When this script runs again inside the
 * container, git is unavailable, so it preserves the commit already written on
 * the host instead of overwriting it with "unknown".
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const outFile = path.join(root, 'src', 'lib', 'server', 'version.json');

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function readExistingVersion() {
  return readJson(outFile) || {};
}

function gitShortHead() {
  const result = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: root,
    encoding: 'utf8'
  });
  if (result.status === 0 && result.stdout) {
    return result.stdout.trim();
  }
  return null;
}

function resolveTrackerCommit(existing) {
  // Prefer live git on the host. Fall back to an env override, then to a
  // previously generated value (host-baked commit copied into the container),
  // then to 'unknown'.
  return (
    gitShortHead() ||
    (process.env.TRACKER_COMMIT && process.env.TRACKER_COMMIT.trim()) ||
    existing.trackerCommit ||
    'unknown'
  );
}

function resolveTrackerVersion(pkg, existing) {
  return (
    (process.env.TRACKER_VERSION_OVERRIDE && process.env.TRACKER_VERSION_OVERRIDE.trim()) ||
    pkg.version ||
    existing.trackerVersion ||
    'unknown'
  );
}

function resolveTrackerCore() {
  // package-lock.json is copied into the Docker image, so it is the most
  // reliable source inside the container. Fall back to the installed module
  // (used for local npm-linked development).
  const lock = readJson(path.join(root, 'package-lock.json'));
  const lockEntry = lock?.packages?.['node_modules/@owlcms/tracker-core'];

  let version = lockEntry?.version || null;
  let commit = 'unknown';
  const resolved = lockEntry?.resolved || '';
  if (resolved.includes('#')) {
    commit = resolved.split('#').pop();
  }

  if (!version) {
    const installed = readJson(
      path.join(root, 'node_modules', '@owlcms', 'tracker-core', 'package.json')
    );
    version = installed?.version || 'unknown';
  }

  return { version, commit };
}

function main() {
  const pkg = readJson(path.join(root, 'package.json')) || {};
  const existing = readExistingVersion();
  const core = resolveTrackerCore();

  const info = {
    trackerVersion: resolveTrackerVersion(pkg, existing),
    trackerCommit: resolveTrackerCommit(existing),
    trackerCoreVersion: core.version,
    trackerCoreCommit: core.commit,
    builtAt: new Date().toISOString()
  };

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(info, null, 2)}\n`);

  console.log(
    `🔖 version.json: tracker ${info.trackerVersion} (${info.trackerCommit}), ` +
      `tracker-core ${info.trackerCoreVersion}`
  );
}

main();
