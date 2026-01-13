import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const DIST_DIR = 'dist/package';

console.log('📦 Building universal tracker package...\n');

try {
  // 0. Ensure dist directory exists
  fs.mkdirSync('dist', { recursive: true });

  // 1. Clean dist directory
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true });
  }
  fs.mkdirSync(DIST_DIR, { recursive: true });

  // 2. Copy required files
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

  // 3. Copy build directory
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

  // 4. Install production dependencies only
  console.log('\n📥 Installing production dependencies...');
  execSync(`npm install --omit=dev --prefix ${DIST_DIR}`, { stdio: 'inherit' });

  // 5. Create README
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

  // 6. Create zip
  console.log('\n📦 Creating ZIP archive...');
  const zipName = 'owlcms-tracker.zip';
  
  // Remove old zip if exists
  if (fs.existsSync(`dist/${zipName}`)) {
    fs.unlinkSync(`dist/${zipName}`);
  }

  // Use 7zip on Windows CI, zip on Linux/macOS
  const isWindows = process.platform === 'win32';
  if (isWindows) {
    // Try 7zip first, fall back to PowerShell
    try {
      execSync(`7z a -tzip ../dist/${zipName} .`, { cwd: DIST_DIR, stdio: 'inherit' });
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
