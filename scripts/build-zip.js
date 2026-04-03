import fs from 'fs';

import { buildAndPackage, runVersionChecks } from './package-shared.js';

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const DEFAULT_TRACKER_VERSION = packageJson.version;

function parseArgs(argv) {
  const flags = new Set();
  const options = new Map();
  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }

    const eqIndex = arg.indexOf('=');
    if (eqIndex !== -1) {
      const key = arg.slice(0, eqIndex);
      const value = arg.slice(eqIndex + 1);
      const existing = options.get(key) || [];
      existing.push(value);
      options.set(key, existing);
      continue;
    }

    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      const existing = options.get(arg) || [];
      existing.push(next);
      options.set(arg, existing);
      i += 1;
      continue;
    }

    flags.add(arg);
  }

  return { flags, options, positional };
}

function parseCsvOption(values) {
  return (values || [])
    .flatMap((value) => value.split(','))
    .map((item) => item.trim())
    .filter(Boolean);
}

// Parse arguments
const args = process.argv.slice(2);
const parsed = parseArgs(args);
const noExtensions = parsed.flags.has('--no-extensions');
const noStandard = parsed.flags.has('--no-standard') || parsed.flags.has('--exclude-standard-extensions');
const selectedSubmodules = parseCsvOption([
  ...(parsed.options.get('--submodule') || []),
  ...(parsed.options.get('--submodules') || [])
]);
const positional = parsed.positional;
const VERSION = positional[0] || DEFAULT_TRACKER_VERSION;
let trackerCoreRequested = positional[1]; // Optional

if (!positional[0]) {
  console.log(`✓ Using package version ${DEFAULT_TRACKER_VERSION}`);
}

console.log('📦 Building universal tracker package...\n');

try {
  const trackerCoreVersion = await runVersionChecks({
    requestedVersion: trackerCoreRequested,
    promptOnAuto: false,
    allowRelease: true,
    updatePackageJson: false,
    updatePackageLockFile: false
  });

  console.log(`✓ Using tracker-core@${trackerCoreVersion}`);

  buildAndPackage({
    distDir: 'dist/package',
    version: VERSION,
    trackerCoreVersion,
    includeExtensions: !noExtensions,
    selectedSubmodules,
    noStandard
  });
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
