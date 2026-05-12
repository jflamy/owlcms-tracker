import fs from 'fs';
import { valid } from 'semver';

import { buildAndPackage, runVersionChecks } from './package-shared.js';

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const DEFAULT_TRACKER_VERSION = packageJson.version;

class UsageError extends Error {}

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

function printUsage() {
  console.log(`Usage: npm run zip -- [version] [tracker-core-version] [selectors]

The first -- is required by npm. It passes the version and selector options to this script.
The version becomes the ZIP filename with timestamp metadata, for example dist/owlcms-tracker_2.18.0+2026-05-12.14h37.zip.
Use --name to add package metadata before the timestamp, for example dist/owlcms-tracker_2.18.0+documents.2026-05-12.14h37.zip.

Package name metadata:
  --name <metadata>
      Add metadata to the ZIP version name before the automatic timestamp. Metadata is
      sanitized for Windows filenames and control panel install parsing. Underscores become
      hyphens because the control panel extracts the version after the last underscore.

Selectors:
  --standard
      Include the built-in plugins from the default checkout.

  --include <name>[,<name>...]
      Add plugins or extensions by display name.

    --include-category <category>[,<category>...]
    --include-categories <category>[,<category>...]
      Add plugins or extensions by config.js category.

  --submodule <name>[,<name>...]
  --submodules <name>[,<name>...]
      Add whole submodules such as books, OBS, or France.

  --help
      Show this message.

Examples:
  npm run zip -- --standard
  npm run zip -- 2.17.2 --standard --include-category remote-control
  npm run zip -- 2.18.0 --name documents --include-category documents
  npm run zip -- 2.17.2 --include "France - Équipes"
  npm run zip -- 2.17.2 --submodule books --submodule OBS`);
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function formatPackageTimestamp(date = new Date()) {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());

  return `${year}-${month}-${day}.${hours}h${minutes}`;
}

function sanitizeMetadataPart(value) {
  const sanitized = String(value || '')
    .normalize('NFC')
    .trim()
    .replace(/\+/g, '.')
    .replace(/\s+/g, '-')
    .replace(/[<>:"/\\|?*\u0000-\u001F_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/\.+/g, '.')
    .replace(/^[.-]+|[.-]+$/g, '');

  if (!sanitized) {
    throw new UsageError(`Package name metadata cannot be empty after sanitizing: ${value}`);
  }

  return sanitized;
}

function addPackageMetadata(version, metadataValues) {
  const plusIndex = version.indexOf('+');
  const baseVersion = plusIndex === -1 ? version : version.slice(0, plusIndex);
  const existingMetadata = plusIndex === -1 ? '' : version.slice(plusIndex + 1);

  if (!valid(baseVersion)) {
    throw new UsageError(`Version '${baseVersion}' is not valid semver.`);
  }

  const metadataParts = [];
  if (existingMetadata) {
    metadataParts.push(sanitizeMetadataPart(existingMetadata));
  }
  metadataParts.push(...metadataValues.map(sanitizeMetadataPart));
  metadataParts.push(formatPackageTimestamp());

  return `${baseVersion}+${metadataParts.join('.')}`;
}

function validateSelectorArgs(parsed) {
  const allowedFlags = new Set(['--standard', '--help']);
  const allowedOptions = new Set([
    '--include',
    '--include-category',
    '--include-categories',
    '--name',
    '--submodule',
    '--submodules'
  ]);

  const unsupportedFlags = Array.from(parsed.flags).filter((flag) => !allowedFlags.has(flag));
  const unsupportedOptions = Array.from(parsed.options.keys()).filter((option) => !allowedOptions.has(option));

  if (unsupportedFlags.length === 0 && unsupportedOptions.length === 0) {
    return;
  }

  const unsupported = [...unsupportedFlags, ...unsupportedOptions].join(', ');
  throw new UsageError(`Unsupported zip option(s): ${unsupported}.`);
}

async function main() {
  // Parse arguments
  const args = process.argv.slice(2);
  const parsed = parseArgs(args);
  validateSelectorArgs(parsed);

  if (parsed.flags.has('--help')) {
    printUsage();
    return;
  }

  const includeStandard = parsed.flags.has('--standard');
  const selectedSubmodules = parseCsvOption([
    ...(parsed.options.get('--submodule') || []),
    ...(parsed.options.get('--submodules') || [])
  ]);
  const selectedPlugins = parseCsvOption([
    ...(parsed.options.get('--include') || [])
  ]);
  const selectedPluginCategories = parseCsvOption([
    ...(parsed.options.get('--include-category') || []),
    ...(parsed.options.get('--include-categories') || [])
  ]);
  const hasExplicitSelections = selectedSubmodules.length > 0 || selectedPlugins.length > 0 || selectedPluginCategories.length > 0;
  const includeStandardPlugins = includeStandard || !hasExplicitSelections;
  const positional = parsed.positional;
  const baseVersion = positional[0] || DEFAULT_TRACKER_VERSION;
  const packageNameMetadata = parseCsvOption(parsed.options.get('--name') || []);
  const VERSION = addPackageMetadata(baseVersion, packageNameMetadata);
  const trackerCoreRequested = positional[1]; // Optional

  if (!positional[0]) {
    console.log(`✓ Using package version ${DEFAULT_TRACKER_VERSION}`);
  }
  if (VERSION !== baseVersion) {
    console.log(`✓ Using package filename version ${VERSION}`);
  }

  console.log('📦 Building universal tracker package...\n');

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
    selectedSubmodules,
    selectedPlugins,
    selectedPluginCategories,
    includeStandard: includeStandardPlugins
  });
}

try {
  await main();
} catch (error) {
  if (error instanceof UsageError) {
    console.error(`❌ ${error.message}`);
    console.error('');
    printUsage();
    process.exit(1);
  }

  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
