# Building and Releasing OWLCMS Tracker

## Development Workflow

### Local Development with Linked Dependencies

When developing owlcms-tracker with local changes to tracker-core:

```bash
# 1. Link tracker-core globally (from tracker-core directory)
cd ../tracker-core
npm link

# 2. Link tracker-core in owlcms-tracker
cd ../owlcms-tracker
npm link @owlcms/tracker-core

# 3. Start development server
npm run dev
```

Changes to tracker-core will be immediately reflected in owlcms-tracker.

### Checking Link Status

```bash
# List linked packages
npm ls --link

# Check if tracker-core is a symlink
ls -l node_modules/@owlcms/tracker-core
```

## Release Process

### Prerequisites

Install GitHub CLI if not already installed:

```bash
# Windows (via winget)
winget install GitHub.cli

# Or download from: https://cli.github.com/

# Authenticate
gh auth login
```

### Automated Release Script

The `release` script automates the entire release workflow:

```bash
npm run release -- <version>
```

**Example:**
```bash
npm run release -- 2.4.0
```

**What the script does:**

1. **Validates version** - Checks semver format (X.Y.Z or X.Y.Z-beta01)
2. **Unlinks tracker-core** - Removes npm link if present
3. **Updates from GitHub** - Fetches latest tracker-core commit
4. **Commits changes** - Stages and commits package-lock.json
5. **Pushes to GitHub** - Uploads the commit
6. **Triggers workflow** - Uses `gh workflow run -f revision=<version>` to start build
7. **Re-links tracker-core** - Restores npm link for development

### Manual Release Steps (if needed)

If you need to perform steps manually:

```bash
# 1. Unlink tracker-core
npm unlink --no-save @owlcms/tracker-core

# 2. Update to latest from GitHub
npm update @owlcms/tracker-core

# 3. Update release.yaml with version number
# (Not needed - gh workflow run passes version directly)

# 4. Commit and push
git add package-lock.json
git commit -m "chore: update tracker-core for release 2.4.0"
git push

# 5. Trigger workflow using gh CLI
gh workflow run release.yaml -f revision=2.4.0

# 6. Re-link for development
npm link @owlcms/tracker-core
```

## Release Workflow Details

### GitHub Actions Workflow

The release workflow (`.github/workflows/release.yaml`) performs:

1. **Dependency Installation** - Uses `npm ci` with exact package-lock.json versions
2. **Plugin Preparation** - Keeps only standard plugins for distribution
3. **Build Process** - Creates production builds for all platforms
4. **Package Creation**:
   - Windows (x64)
   - macOS ARM64 (M-series)
   - macOS x64 (Intel)
   - Raspberry Pi (ARM)
5. **Docker Image** - Builds and pushes to container registry
6. **GitHub Release** - Creates release with all packages and release notes

### Version Requirements

**Valid semver formats:**
- `X.Y.Z` - Standard release (e.g., `2.4.0`)
- `X.Y.Z-suffix` - Pre-release (e.g., `2.4.0-beta01`, `2.4.0-rc1`)

## Coordinated Releases (tracker-core + owlcms-tracker)

When releasing both packages together:

```bash
# 1. Release tracker-core first
cd ../tracker-core
npm run release 1.0.0-beta02

# 2. Update owlcms-tracker dependencies
cd ../owlcms-tracker
npm update @owlcms/tracker-core

# 3. Verify the commit hash
grep "resolved.*tracker-core" package-lock.json

# 4. Release owlcms-tracker
npm run release -- 2.4.0
```

## Troubleshooting

### GitHub CLI not installed

**Problem:** Script fails with "gh: command not found"

**Solution:** Install GitHub CLI

```bash
# Windows
winget install GitHub.cli

# Then authenticate
gh auth login
```

### "npm ci" fails with missing package

**Problem:** `npm ci` requires exact versions from package-lock.json

**Solution:** Use `npm install` (preserves links) or unlink before running `npm ci`

```bash
npm unlink --no-save @owlcms/tracker-core
npm ci
```

### Link is still present after release script

**Problem:** Script couldn't find tracker-core at sibling path

**Solution:** Manually re-link

```bash
cd ../tracker-core
npm link
cd ../owlcms-tracker
npm link @owlcms/tracker-core
```

### Wrong commit hash in package-lock.json

**Problem:** package-lock.json points to old commit

**Solution:** Force update from GitHub

```bash
npm unlink --no-save @owlcms/tracker-core
npm update @owlcms/tracker-core
npm link @owlcms/tracker-core
```

### Vite not picking up changes

**Problem:** Module caching after code changes

**Solution:** Restart dev server

```bash
# Stop server (Ctrl+C)
npm run dev
```

## Development Tips

### Learning Mode

Capture all WebSocket messages from OWLCMS for debugging:

```bash
npm run dev:learning
```

Messages are saved to `samples/message-[timestamp].json`

### Verify Exports

Check that all required exports are available:

```bash
cd ../tracker-core
node scripts/verify-exports.js
```

### Directory Structure Assumption

The prepare-release script assumes this directory layout:

```
Dev/
├── git/
│   ├── owlcms-tracker/
│   └── tracker-core/
```

If your directories are named differently, adjust the script or manually re-link after release.
