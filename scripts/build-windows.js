import fs from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';
const DIST_DIR = 'dist/windows';

console.log('📦 Building Windows portable package...\n');

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
    const readme = `OWLCMS Competition Tracker - Windows
====================================

This package contains the tracker application files.
  It is intended to be launched by the OWLCMS control panel.

REQUIREMENTS:
=============
- Node.js 22+ installed (https://nodejs.org/)

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

To run manually from command line (advanced):
  node start-with-ws.js

For more information: https://github.com/owlcms/owlcms-tracker
`;

    fs.writeFileSync(path.join(DIST_DIR, 'README.txt'), readme);
    console.log('✓ Created README.txt');

    // 6. Create ZIP file
    console.log('\n📦 Creating ZIP file...');
    
    const zipPath = 'dist/owlcms-tracker-windows.zip';

    // Use native zip command (cross-platform: works on Linux/macOS/Windows with Git Bash)
    // Change to DIST_DIR and zip current directory to avoid nested paths
    const createZip = () => {
      return new Promise((resolve, reject) => {
        const zipFilename = path.basename(zipPath);
        const zip = spawn('zip', ['-r', '-q', `../${zipFilename}`, '.'], {
          cwd: DIST_DIR
        });
        
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
  2. Launch using the OWLCMS control panel
`);

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();


