# Distribution Structure Update

## Changes Made

### 1. ✅ Untracked Build Folder
- Updated `.gitignore` to use simple `build/` entry instead of tracking individual files
- Build artifacts are now completely ignored as a directory

### 2. ✅ Unified Distribution Folder
All distribution packages now go under a single `dist/` folder with platform-specific subfolders:

```
dist/
├── .gitkeep                           # Folder marker for git
├── windows/                           # Windows build working directory
├── owlcms-tracker-windows.zip        # Windows portable package (generated)
├── macos/                            # macOS build working directory
├── owlcms-tracker-macos.zip          # macOS portable package (generated)
├── rpi/                              # Raspberry Pi build working directory
└── owlcms-tracker-rpi.zip            # RPi portable package (generated)
```

### 3. ✅ Updated Build Scripts
All platform build scripts now use the unified `dist/` structure:

| Script | Old Location | New Location |
|--------|--------------|--------------|
| `build-windows.js` | `dist-windows/` | `dist/windows/` |
| `build-macos.js` | `dist-macos/` | `dist/macos/` |
| `build-rpi.js` | `dist-rpi/` | `dist/rpi/` |

ZIP outputs also moved:
- `owlcms-tracker-windows.zip` → `dist/owlcms-tracker-windows.zip`
- `owlcms-tracker-macos.zip` → `dist/owlcms-tracker-macos.zip`
- `owlcms-tracker-rpi.zip` → `dist/owlcms-tracker-rpi.zip`

### 4. ✅ Updated package.json Scripts
```json
{
  "build:windows": "npm run build && node scripts/build-windows.js",
  "build:macos": "npm run build && node scripts/build-macos.js",
  "build:rpi": "npm run build && node scripts/build-rpi.js",
  "build:all": "npm run build:windows && npm run build:macos && npm run build:rpi"
}
```

## Usage

### Build Single Platform
```bash
npm run build:windows  # Creates dist/owlcms-tracker-windows.zip
npm run build:macos    # Creates dist/owlcms-tracker-macos.zip
npm run build:rpi      # Creates dist/owlcms-tracker-rpi.zip
```

### Build All Platforms
```bash
npm run build:all
```

### Files Generated
Each build script:
1. Creates `dist/{platform}/` working directory
2. Copies app files and dependencies
3. Downloads and bundles platform-specific Node.js binary
4. Creates `dist/owlcms-tracker-{platform}.zip`

## Git Tracking

### Ignored (not tracked)
- `/build` - SvelteKit production build output
- `/dist` - All distribution packages and working directories
- `/dist-windows/`, `/dist-macos/`, `/dist-rpi/` - Old directory structure (deprecated)

### Tracked
- `.gitkeep` - Ensures `dist/` folder structure is preserved in git
- All source files remain tracked normally

## Next Steps

1. ✅ Clean up old `dist-*` directories locally if needed:
   ```bash
   rm -rf dist-windows dist-macos dist-rpi
   ```

2. Test build scripts:
   ```bash
   npm run build:all
   ```

3. Verify distribution packages are created in `dist/`:
   ```bash
   ls -lh dist/*.zip
   ```

4. Commit changes:
   ```bash
   git add .gitignore package.json dist/.gitkeep scripts/
   git commit -m "refactor: unify distribution packages under dist/ folder"
   ```
