import { buildAndPackage, runVersionChecks } from './package-shared.js';

// Parse arguments
const args = process.argv.slice(2);
const noExtensions = args.includes('--no-extensions');
const positional = args.filter((arg) => !arg.startsWith('--'));
const VERSION = positional[0];
let trackerCoreRequested = positional[1]; // Optional

if (!VERSION) {
  console.error('❌ Error: Version number required');
  console.error('Usage: npm run zip -- <tracker-version> [tracker-core-version] [--no-extensions]');
  console.error('Examples:');
  console.error('  npm run zip -- 2.4.0');
  console.error('  npm run zip -- 2.4.0 1.0.0-beta02');
  console.error('  npm run zip -- 2.4.0 --no-extensions');
  process.exit(1);
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
    includeExtensions: !noExtensions
  });
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
