import fs from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';
import https from 'https';
import AdmZip from 'adm-zip';

const NODE_VERSION = '22.12.0';
const DIST_DIR = 'dist/macos';
const NODE_URL = `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-darwin-arm64.tar.gz`;
const NODE_FILENAME = `node-v${NODE_VERSION}-darwin-arm64.tar.gz`;

console.log('📦 Building macOS portable package...\n');

// Helper to download file
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`⬇️  Downloading: ${url}`);
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`✓ Downloaded to ${dest}`);
        resolve();
      });
    }).on('error', reject);
  });
}

(async () => {
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
      'tracker.sh',
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

    // 5. Download Node.js
    console.log('\n⬇️  Downloading Node.js...');
    const nodeZipPath = path.join(DIST_DIR, NODE_FILENAME);
    await downloadFile(NODE_URL, nodeZipPath);

    // 6. Extract Node.js binary
    console.log('\n📦 Extracting Node.js...');
    execSync(`cd ${DIST_DIR} && tar xzf ${NODE_FILENAME} && mv node-v${NODE_VERSION}-darwin-arm64/bin/node . && rm -rf node-v${NODE_VERSION}-darwin-arm64 ${NODE_FILENAME}`, { stdio: 'inherit' });
    console.log('✓ Extracted Node.js binary');

    // 7. Make tracker.sh executable
    fs.chmodSync(path.join(DIST_DIR, 'tracker.sh'), 0o755);
    console.log('✓ Made tracker.sh executable');

    // 8. Create README
    const readme = `OWLCMS Competition Tracker - macOS
===================================

This package includes everything needed to run the tracker!

QUICK START:
============
1. Open this folder in Finder
2. Double-click "tracker.sh" (or run in Terminal: ./tracker.sh)
3. A Terminal window will open
4. Open http://localhost:8096 in your browser

OWLCMS CONFIGURATION:
====================
In OWLCMS, go to:
  Prepare Competition → Language and System Settings → Connections
  
Set "URL for Video Data" to:
  ws://localhost:8096/ws

The tracker will receive competition data automatically.

TROUBLESHOOTING:
================
- If you get "permission denied", run: chmod +x tracker.sh
- If Terminal asks about "unidentified developer", click "Open" in System Preferences
- Make sure port 8096 is not used by another program
- Check the Terminal window for error messages

For more information: https://github.com/owlcms/owlcms-tracker
`;

    fs.writeFileSync(path.join(DIST_DIR, 'README.txt'), readme);
    console.log('✓ Created README.txt');

    // 9. Create ZIP file
    console.log('\n📦 Creating ZIP file...');
    
    // Use native zip command (faster than adm-zip for large directories)
    const zipPath = 'dist/owlcms-tracker-macos.zip';
    
    // Use native zip command on macOS/Linux
    const createZip = () => {
      return new Promise((resolve, reject) => {
        const zip = spawn('zip', ['-r', '-q', zipPath, DIST_DIR]);
        
        zip.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`zip command returned exit code ${code}`));
          } else {
            resolve();
          }
        });
        
        zip.on('error', reject);
      });
    };
    
    try {
      await createZip();
      console.log(`✓ Created ${zipPath}`);
    } catch (zipErr) {
      console.warn('⚠️  Native zip failed, falling back to adm-zip...');
      // Fallback to adm-zip if native zip fails
      const zip2 = new AdmZip();
      const zipDir2 = (dirPath, zipPath = '') => {
        const files = fs.readdirSync(dirPath);
        files.forEach(file => {
          const filePath = path.join(dirPath, file);
          const zPath = zipPath ? path.join(zipPath, file) : file;
          const stats = fs.statSync(filePath);
          if (stats.isDirectory()) {
            zipDir2(filePath, zPath);
          } else {
            const entry = zip2.addFile(zPath, fs.readFileSync(filePath));
            // Preserve executable bit for .sh files
            if (file.endsWith('.sh') || file === 'node') {
              entry.attr = 0o755 << 16; // Unix file permissions
            }
          }
        });
      };
      zipDir2(DIST_DIR, 'owlcms-tracker');
      zip2.writeZip(zipPath);
      console.log(`✓ Created ${zipPath} (fallback)`);
    }

    const sizeInMB = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(1);
    console.log(`
✅ macOS package complete!

File: ${zipPath} (${sizeInMB}MB)

Ready to distribute! Users just need to:
  1. Extract the ZIP
  2. Double-click tracker.sh
  3. Open http://localhost:8096
`);

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
