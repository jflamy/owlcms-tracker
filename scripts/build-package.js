import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const DIST_DIR = 'dist/package';
const VERSION = process.argv[2];

console.log('📦 Building universal tracker package...\n');

try {
  // 0. Ensure dist directory exists
  fs.mkdirSync('dist', { recursive: true });

  // 1. Clean dist directory
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true });
  }
  fs.mkdirSync(DIST_DIR, { recursive: true });

  // 2. Remove experimental plugins (manual runs)
  if (fs.existsSync('src/plugins/experiments')) {
    fs.rmSync('src/plugins/experiments', { recursive: true });
    console.log('✓ Removed src/plugins/experiments');
  }

  // 3. Build application
  console.log('\n🏗️  Building application...');
  execSync('npm run build', {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=4096'
    }
  });

  // 4. Remove pre-compressed files (server-side only)
  execSync("find build/client -name '*.gz' -delete", { stdio: 'inherit' });
  execSync("find build/client -name '*.br' -delete", { stdio: 'inherit' });
  console.log('✓ Removed .gz and .br files from build');

  // 5. Copy required files
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

  // 6. Copy build directory
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

  // 7. Install production dependencies only
  console.log('\n📥 Installing production dependencies...');
  execSync(`npm install --omit=dev --prefix ${DIST_DIR} --no-package-lock --no-save`, { stdio: 'inherit' });

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

  // 8. Create README
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

  // 9. Create zip
  console.log('\n📦 Creating ZIP archive...');
  const zipName = VERSION ? `owlcms-tracker_${VERSION}.zip` : 'owlcms-tracker.zip';
  
  // Remove old zip if exists
  if (fs.existsSync(`dist/${zipName}`)) {
    fs.unlinkSync(`dist/${zipName}`);
  }

  // Use 7zip on Windows, zip on Linux/macOS
  const isWindows = process.platform === 'win32';
  if (isWindows) {
    // Try 7zip on PATH, then Program Files, fall back to PowerShell
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
  
  // Show package contents summary
  const stats = fs.statSync(`dist/${zipName}`);
  console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
