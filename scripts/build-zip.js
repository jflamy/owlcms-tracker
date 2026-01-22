import { buildAndPackage, runVersionChecks } from './package-shared.js';

const args = process.argv.slice(2);
const VERSION = args.find(arg => !arg.startsWith('--'));
const trackerCoreArg = args.find(arg => arg.startsWith('--tracker-core='));
const trackerCoreRequested = trackerCoreArg ? trackerCoreArg.split('=')[1] : null;

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
    trackerCoreVersion
  });
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
