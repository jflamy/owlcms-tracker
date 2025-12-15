import fs from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';
import https from 'https';
import AdmZip from 'adm-zip';
import { createReadStream, createWriteStream } from 'fs';

const NODE_VERSION = '22.12.0';
const DIST_DIR = 'dist/rpi';
const NODE_URL = `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-armv7l.tar.gz`;
const NODE_FILENAME = `node-v${NODE_VERSION}-linux-armv7l.tar.gz`;

console.log('📦 Building Raspberry Pi portable package...\n');

// Helper to download file
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`⬇️  Downloading: ${url}`);
    const file = createWriteStream(dest);
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

// Helper to extract tar.gz
function extractTarGz(tarPath, dest) {
  console.log(`📦 Extracting ${tarPath}...`);
  execSync(`tar -xzf "${tarPath}" -C "${dest}"`, { stdio: 'pipe' });
  
  // Move node binary from extracted directory to root
  const extractedDir = path.join(dest, `node-v${NODE_VERSION}-linux-armv7l`);
  const binSrc = path.join(extractedDir, 'bin', 'node');
  const binDest = path.join(dest, 'node');
  
  if (fs.existsSync(binSrc)) {
    fs.copyFileSync(binSrc, binDest);
    fs.chmodSync(binDest, 0o755);
    fs.rmSync(extractedDir, { recursive: true });
    console.log('✓ Extracted Node.js binary');
  }
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
      'tracker-rpi.sh',
      'start-with-ws.js',
      'package.json'
    ];

    filesToCopy.forEach(file => {
      if (fs.existsSync(file)) {
        fs.copyFileSync(file, path.join(DIST_DIR, file));
        if (file.endsWith('.sh')) {
          fs.chmodSync(path.join(DIST_DIR, file), 0o755);
        }
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

    // 5. Download Node.js for ARMv7 (32-bit Raspberry Pi)
    console.log('\n⬇️  Downloading Node.js for ARMv7...');
    const nodeGzPath = path.join(DIST_DIR, NODE_FILENAME);
    await downloadFile(NODE_URL, nodeGzPath);

    // 6. Extract Node.js binary
    console.log('\n📦 Extracting Node.js...');
    extractTarGz(nodeGzPath, DIST_DIR);
    fs.unlinkSync(nodeGzPath);

    // 7. Make launcher executable
    fs.chmodSync(path.join(DIST_DIR, 'tracker-rpi.sh'), 0o755);

    // 8. Create README
    const readme = `OWLCMS Competition Tracker - Raspberry Pi
==========================================

This package includes everything needed to run the tracker!
Includes Node.js 22.12.0 pre-bundled for ARMv7 (32-bit RPi).

QUICK START:
============
1. Extract this ZIP folder
2. Open a terminal in the extracted folder
3. Run: ./tracker-rpi.sh
4. Open http://localhost:8096 in your browser

REQUIREMENTS:
=============
- Raspberry Pi with ARMv7 processor (RPi 2, 3, 4, 5)
- Linux-based OS (Raspberry Pi OS, Ubuntu, etc.)

OWLCMS CONFIGURATION:
====================
In OWLCMS, go to:
  Prepare Competition → Language and System Settings → Connections
  
Set "URL for Video Data" to:
  ws://localhost:8096/ws
  
(Replace localhost with your RPi's IP address if accessing remotely)

FINDING YOUR RPi IP ADDRESS:
============================
When you run tracker-rpi.sh, it will display:
  "🌐 Access tracker at: http://192.168.X.X:8096"

Use this address from other computers on your network.

TROUBLESHOOTING:
================
- Make sure port 8096 is not used by another program
- If you get "node: command not found", the bundled binary may not work
- Check for error messages in the terminal
- If the script won't run, try: chmod +x tracker-rpi.sh

To run from command line:
  ./tracker-rpi.sh

Or if that doesn't work:
  ./node start-with-ws.js

For more information: https://github.com/owlcms/owlcms-tracker
`;

    fs.writeFileSync(path.join(DIST_DIR, 'README.txt'), readme);
    console.log('✓ Created README.txt');

    // 9. Create ZIP file
    console.log('\n📦 Creating ZIP file...');
    
    // Use native zip command (faster than adm-zip for large directories)
    const zipPath = 'dist/owlcms-tracker-rpi.zip';
    
    // Use native zip command on Linux
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
      zipDir2(DIST_DIR, 'owlcms-tracker-rpi');
      zip2.writeZip(zipPath);
      console.log(`✓ Created ${zipPath} (fallback)`);
    }
    console.log(`✓ Created ${zipPath}`);

    const sizeInMB = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(1);
    console.log(`
✅ Raspberry Pi package complete!

File: ${zipPath} (${sizeInMB}MB)

Ready to distribute! Users just need to:
  1. Extract the ZIP on their RPi
  2. Open terminal and run: ./tracker-rpi.sh
  3. Open http://localhost:8096 (or their RPi's IP:8096)

HARDWARE COMPATIBILITY:
  - Raspberry Pi 2 (ARMv7) ✅
  - Raspberry Pi 3 (ARMv7) ✅
  - Raspberry Pi 4 (ARMv7) ✅
  - Raspberry Pi 5 (ARMv7) ✅
  - Raspberry Pi Zero 2 (ARMv7) ✅

NOTE: 64-bit Raspberry Pi OS users may need to install Node.js differently.
      For best compatibility, use 32-bit Raspberry Pi OS.
`);

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
