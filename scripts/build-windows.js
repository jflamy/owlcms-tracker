import fs from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';
import https from 'https';
import AdmZip from 'adm-zip';

const NODE_VERSION = '22.12.0';
const DIST_DIR = 'dist/windows';
const NODE_URL = `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-win-x64.zip`;
const NODE_FILENAME = `node-v${NODE_VERSION}-win-x64.zip`;

console.log('📦 Building Windows portable package...\n');

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
      'tracker.bat',
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
    // Use unzip command (cross-platform: works on Linux/macOS/Windows with Git Bash)
    const extractNodeZip = () => {
      return new Promise((resolve, reject) => {
        const unzip = spawn('unzip', ['-q', nodeZipPath, '-d', DIST_DIR]);
        unzip.on('close', (code) => {
          if (code !== 0) reject(new Error(`unzip returned exit code ${code}`));
          else resolve();
        });
        unzip.on('error', (err) => {
          console.log('unzip not available, trying PowerShell...');
          // Fallback to PowerShell on Windows
          const psCommand = `
            $ErrorActionPreference = 'Stop'
            $ProgressPreference = 'SilentlyContinue'
            $zipPath = '${path.resolve(nodeZipPath).replace(/\\/g, '/')}'
            $destPath = '${path.resolve(DIST_DIR).replace(/\\/g, '/')}'
            Expand-Archive -LiteralPath $zipPath -DestinationPath $destPath -Force
          `;
          const ps = spawn('powershell.exe', ['-NoProfile', '-Command', psCommand], {
            stdio: 'inherit',
            windowsHide: false
          });
          ps.on('close', (psCode) => {
            if (psCode !== 0) reject(new Error(`PowerShell extract returned ${psCode}`));
            else resolve();
          });
          ps.on('error', reject);
        });
      });
    };
    await extractNodeZip();
    fs.renameSync(path.join(DIST_DIR, `node-v${NODE_VERSION}-win-x64`, 'node.exe'), path.join(DIST_DIR, 'node.exe'));
    fs.rmSync(path.join(DIST_DIR, `node-v${NODE_VERSION}-win-x64`), { recursive: true });
    fs.unlinkSync(nodeZipPath);
    console.log('✓ Extracted Node.js binary');

    // 7. Create README
    const readme = `OWLCMS Competition Tracker - Windows
====================================

This package includes everything needed to run the tracker!
No additional downloads or installations required.

QUICK START:
============
1. Double-click tracker.bat
2. A command window will open
3. Open http://localhost:8096 in your browser

OWLCMS CONFIGURATION:
====================
In OWLCMS, go to:
  Prepare Competition → Language and System Settings → Connections
  
Set "URL for Video Data" to:
  ws://localhost:8096/ws

The tracker will receive competition data automatically.

TROUBLESHOOTING:
================
- If Windows Firewall asks, click "Allow access"
- Make sure port 8096 is not used by another program
- If the window closes immediately, check for error messages
- Try right-clicking tracker.bat and selecting "Run as administrator"

To run from command line:
  node start-with-ws.js

For more information: https://github.com/owlcms/owlcms-tracker
`;

    fs.writeFileSync(path.join(DIST_DIR, 'README.txt'), readme);
    console.log('✓ Created README.txt');

    // 8. Create ZIP file
    console.log('\n📦 Creating ZIP file...');
    
    const zipPath = 'dist/owlcms-tracker-windows.zip';

    // Use native zip command (cross-platform: works on Linux/macOS/Windows with Git Bash)
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
        
        zip.on('error', (err) => {
          // If zip command not found, try PowerShell (Windows-only)
          console.log('zip command not found, trying PowerShell...');
          const distFullPath = path.resolve(DIST_DIR).replace(/\\/g, '/');
          const zipFullPath = path.resolve(zipPath).replace(/\\/g, '/');
          const psCommand = `
            $ErrorActionPreference = 'Stop'
            $ProgressPreference = 'SilentlyContinue'
            $src = "${distFullPath}/*"
            $dst = "${zipFullPath}"
            if (Test-Path -LiteralPath $dst) { Remove-Item -LiteralPath $dst -Force }
            Compress-Archive -Path $src -DestinationPath $dst -Force
          `;
          
          const ps = spawn('powershell.exe', ['-NoProfile', '-Command', psCommand], {
            stdio: 'inherit',
            windowsHide: false
          });
          
          ps.on('close', (psCode) => {
            if (psCode !== 0) {
              reject(new Error(`PowerShell returned exit code ${psCode}`));
            } else {
              resolve();
            }
          });
          
          ps.on('error', reject);
        });
      });
    };
    
    try {
      await createZip();
      console.log(`✓ Created ${zipPath}`);
    } catch (zipErr) {
      console.error('❌ PowerShell ZIP failed:', zipErr.message);
      throw zipErr;
    }

    const sizeInMB = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(1);
    console.log(`
✅ Windows package complete!

File: ${zipPath} (${sizeInMB}MB)

Ready to distribute! Users just need to:
  1. Extract the ZIP
  2. Double-click tracker.bat
  3. Open http://localhost:8096
`);

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();


