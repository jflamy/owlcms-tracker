# Building and Releasing OWLCMS Tracker

## Development Workflow

### Local Development with Linked Dependencies

When developing owlcms-tracker with local changes to tracker-core:

```bash
# 1. Install and link tracker-core globally (from tracker-core directory)
cd ../tracker-core
npm install
npm link

# 2. Install owlcms-tracker dependencies
cd ../owlcms-tracker
npm install

# 3. Link tracker-core in owlcms-tracker
npm link @owlcms/tracker-core

# 4. Start development server
npm run dev
```

Changes to tracker-core will be immediately reflected in owlcms-tracker.

> Note: If you run `npm install` (or `npm ci`) in `owlcms-tracker` later, npm may replace the symlink with the locked GitHub dependency. If that happens, just run `npm link @owlcms/tracker-core` again.

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
2. **Resolves tracker-core version** - Uses the provided version, or queries GitHub for the latest semver tag
3. **Pins tracker-core in package.json** - Uses `npm pkg set` to set `@owlcms/tracker-core` to `github:owlcms/tracker-core#<version>`
4. **Updates package-lock.json** - Uses `npm install --package-lock-only` (does not touch `node_modules`, so it won't break local links)
5. **Commits changes** - Stages and commits `package.json`, `package-lock.json`, and `ReleaseNotes.md`
6. **Pushes to GitHub** - Uploads the commit
7. **Triggers workflow** - Uses `gh workflow run -f revision=<version>` to start build

### Manual Release Steps (if needed)

If you need to perform steps manually:

```bash
# 1. Pin tracker-core to the desired tag
npm pkg set dependencies.@owlcms/tracker-core=github:owlcms/tracker-core#1.0.0-rc01

# 2. Update package-lock.json without touching node_modules
npm install --package-lock-only

# 3. Commit and push
git add package.json package-lock.json ReleaseNotes.md
git commit -m "chore: update tracker-core for release 2.4.0"
git push

# 4. Trigger workflow using gh CLI
gh workflow run release.yaml -f revision=2.4.0
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

# 2. Release owlcms-tracker pinned to that tracker-core tag
cd ../owlcms-tracker
npm run release -- 2.4.0 1.0.0-beta02
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

**Solution:** `npm ci` removes `node_modules` and installs exactly what's in `package-lock.json`. If you use `npm link`, run `npm ci` first, then re-link.

```bash
npm ci
npm link @owlcms/tracker-core
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

**Solution:** Re-pin the dependency and regenerate the lock file

```bash
npm pkg set dependencies.@owlcms/tracker-core=github:owlcms/tracker-core#1.0.0-rc01
npm install --package-lock-only
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
