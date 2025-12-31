# NPM Package Implementation Plan

**For OWLCMS maintainers - Extracting the hub into a separate repository**

## Overview

This document outlines the practical steps to extract the competition hub and server utilities from the monorepo into a **separate repository** (`tracker-core`) as a standalone npm package (`@owlcms/tracker-core`).

**Architecture Decision:** Separate repositories (not monorepo workspaces)

**Related documents:**
- [API_REFERENCE.md](./API_REFERENCE.md) - Complete API documentation
- [DEVELOPER_USAGE.md](./DEVELOPER_USAGE.md) - **For external developers** - Installation and usage guide

## Package Scope

The `@owlcms/tracker-core` package includes:

✅ **Tracker Core** - State management and event broadcasting  
✅ **WebSocket Server** - OWLCMS message receiver with two integration modes:
  - Standalone server (creates own HTTP server)
  - Injectable into existing Express/HTTP server (recommended)  
✅ **Utility Modules** - Flag resolver, scoring formulas, translations  
✅ **Event System** - EventEmitter-based push notifications

❌ **NOT included** - SvelteKit tracker app, scoreboard plugins, UI components

## Repository Architecture

### New Repository: `tracker-core`

**Purpose:** Core data hub package for external developers

**Structure:**
```
tracker-core/                    # NEW separate git repository
├── package.json
├── README.md
├── LICENSE
├── .github/
│   └── workflows/
│       └── publish.yml             # Auto-publish to GitHub Packages
├── src/
│   ├── index.js                    # Main exports
│   ├── tracker-core.js          # Hub class
│   ├── websocket-server.js         # WebSocket integration
│   ├── utils/
│   │   ├── flag-resolver.js
│   │   ├── sinclair-coefficients.js
│   │   ├── translations.js
│   │   └── ...
│   └── embedded-database.js
├── docs/
│   └── npm/                        # This documentation
│       ├── API_REFERENCE.md
│       ├── DEVELOPER_USAGE.md
│       └── ...
└── tests/
    └── ...
```

**Published as:** `@owlcms/tracker-core` on GitHub Packages

---

### Modified Repository: `owlcms-tracker`

**Purpose:** Competition scoreboard application with plugin system

**Structure:**
```
owlcms-tracker/                     # EXISTING repository (modified)
├── package.json
│   # Now depends on: "@owlcms/tracker-core": "^1.0.0"
├── src/
│   ├── plugins/                    # Import from @owlcms/tracker-core
│   ├── routes/
│   └── lib/
│       ├── stores.js               # Uses hub events
│       └── ...
├── docs/
│   ├── CREATE_YOUR_OWN.md          # Plugin development guide
│   └── ...
└── README.md
```

**Dependencies:** Uses hub as npm package from GitHub Packages

---

## Why Separate Repositories?

**Benefits:**

1. **Clean separation** - Hub has no tracker-specific code
2. **Independent versioning** - Hub can be updated without tracker changes
3. **Smaller downloads** - External devs only clone what they need (~500KB vs ~50MB)
4. **Clear boundaries** - Plugin devs don't accidentally modify hub
5. **Easier onboarding** - New developers understand scope immediately
6. **Multiple consumers** - Future apps (owlcms-tv, owlcms-mobile) can use same hub

**Trade-offs:**

- ⚠️ Two repos to manage (separate issues, PRs, releases)
- ⚠️ Need npm link for local development (documented in DEVELOPER_USAGE.md)
- ⚠️ Breaking changes require coordinated updates
- ⚠️ Must publish hub before tracker can use new features

**Mitigation strategies:**
- Automated setup script: `npm run setup:linked` in tracker repo
- Semantic versioning prevents accidental breakage
- Clear deprecation policy for API changes
- Linked development workflow for core contributors (Option B in DEVELOPER_USAGE.md)

#### 2.1 package.json

```json
{
  "name": "@owlcms/tracker-core",
  "version": "1.0.0",
  "description": "Competition hub and server utilities for OWLCMS scoreboards",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./websocket": {
      "import": "./dist/websocket-server.js"
    },
    "./flags": {
      "import": "./dist/flag-resolver.js"
    },
    "./scoring": {
      "import": "./dist/scoring/index.js"
    }
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "node build.js",
    "dev": "node build.js --watch",
    "test": "node --test",
    "prepublishOnly": "npm run build"
  },
  "keywords": [
    "owlcms",
    "weightlifting",
    "scoreboard",
    "competition"
  ],
  "author": "Jean-François Lamy",
  "license": "AGPL-3.0",
  "peerDependencies": {
    "ws": "^8.0.0"
  },
  "dependencies": {
    "adm-zip": "^0.5.0",
    "events": "^3.3.0"
  },
  "devDependencies": {
    "esbuild": "^0.19.0"
  }
}
```

#### 2.2 Build Script (packages/tracker-core/build.js)

```javascript
import * as esbuild from 'esbuild';
import { readdir } from 'fs/promises';
import { join } from 'path';

const watch = process.argv.includes('--watch');

// Build main bundle
await esbuild.build({
  entryPoints: ['src/index.js'],
  bundle: false,  // Don't bundle - just copy and transform
  outdir: 'dist',
  platform: 'node',
  target: 'node18',
  format: 'esm',
  sourcemap: true,
  watch: watch ? {
    onRebuild(error, result) {
      if (error) console.error('Build failed:', error);
      else console.log('Rebuilt successfully');
    }
  } : false
});

console.log('Build complete');
```

---

## Implementation Steps

### Step 1: Create New Hub Repository

#### 1.1 Initialize Repository

```bash
# Create new repo on GitHub: owlcms/tracker-core
mkdir tracker-core
cd tracker-core
git init
git remote add origin https://github.com/owlcms/tracker-core.git
```

#### 1.2 Hub package.json

```json
{
  "name": "@owlcms/tracker-core",
  "version": "1.0.0",
  "description": "OWLCMS Tracker Core - Real-time competition data management",
  "type": "module",
  "main": "./src/index.js",
  "exports": {
    ".": "./src/index.js",
    "./websocket": "./src/websocket-server.js",
    "./utils": "./src/utils/index.js",
    "./utils/scoring": "./src/utils/sinclair-coefficients.js",
    "./utils/flags": "./src/utils/flag-resolver.js",
    "./utils/translations": "./src/utils/translations.js"
  },
  "files": [
    "src/**/*.js",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "test": "echo \"Tests TBD\" && exit 0"
  },
  "keywords": [
    "owlcms",
    "weightlifting",
    "competition",
    "scoreboard",
    "websocket"
  ],
  "repository": {
    "type": "git",
    "url": "https://github.com/owlcms/tracker-core.git"
  },
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  },
  "author": "Jean-François Lamy",
  "license": "AGPL-3.0",
  "dependencies": {
    "ws": "^8.0.0"
  }
}
```

#### 1.3 Directory Structure

Create the following structure:

```
tracker-core/
├── .github/
│   └── workflows/
│       └── publish.yml          # Auto-publish on release
├── src/
│   ├── index.js                 # Main exports
│   ├── tracker-core.js       # Hub class
│   ├── websocket-server.js      # WebSocket integration
│   ├── utils/
│   │   ├── index.js             # Utility exports
│   │   ├── flag-resolver.js
│   │   ├── sinclair-coefficients.js
│   │   ├── qpoints-coefficients.js
│   │   ├── gamx2.js
│   │   ├── team-points-formula.js
│   │   ├── translations.js
│   │   ├── cache-utils.js
│   │   ├── timer-decision-helpers.js
│   │   ├── attempt-bar-visibility.js
│   │   ├── records-extractor.js
│   │   └── standard-scoreboard-helpers.js
│   └── embedded-database.js
├── docs/
│   └── npm/                     # Copy from tracker repo
│       ├── API_REFERENCE.md
│       ├── DEVELOPER_USAGE.md
│       ├── IMPLEMENTATION_PLAN.md
│       └── HUB_NPM_PACKAGE_ANALYSIS.md
├── README.md
├── LICENSE
└── package.json
```

---

### Step 2: Copy Files from Tracker Repo

#### 2.1 Identify Source Files in owlcms-tracker

Files to copy from `owlcms-tracker/src/lib/server/`:

- `tracker-core.js`
- `websocket-server.js`
- `embedded-database.js`
- `utils/flag-resolver.js`
- `utils/sinclair-coefficients.js`
- `utils/qpoints-coefficients.js`
- `utils/gamx2.js`
- `utils/team-points-formula.js`
- `utils/translations.js`
- `utils/cache-utils.js`
- `utils/timer-decision-helpers.js`
- `utils/attempt-bar-visibility.js`
- `utils/records-extractor.js`
- `utils/standard-scoreboard-helpers.js`

#### 2.2 Copy Script

```bash
#!/bin/bash
# copy-to-hub.sh

TRACKER_PATH="../owlcms-tracker/src/lib/server"
HUB_PATH="./src"

# Copy main files
cp "$TRACKER_PATH/tracker-core.js" "$HUB_PATH/"
cp "$TRACKER_PATH/websocket-server.js" "$HUB_PATH/"
cp "$TRACKER_PATH/embedded-database.js" "$HUB_PATH/"

# Copy utility files
mkdir -p "$HUB_PATH/utils"
cp "$TRACKER_PATH/utils/"*.js "$HUB_PATH/utils/"

echo "✅ Files copied from tracker to hub"
```

#### 2.3 Update Import Paths

After copying, update import statements to reflect new structure:

**Before (in tracker):**
```javascript
import { competitionHub } from '$lib/server/tracker-core.js';
```

**After (in hub):**
```javascript
import { competitionHub } from './tracker-core.js';
```

---

### Step 3: Create Main Entry Point

Create `src/index.js` in hub repo:

```javascript
// Core hub
export { CompetitionHub, competitionHub } from './tracker-core.js';

// Data accessors
export {
  getDatabaseState,
  getFopUpdate,
  getSessionAthletes,
  getStartOrderEntries,
  getLiftingOrderEntries,
  getTranslations,
  getSessionStatus,
  getTeamNameById,
  getFopStateVersion,
  getCategoryToAgeGroupMap
} from './hub-accessors.js';

// WebSocket server
export { createWebSocketServer } from './websocket-server.js';

// Flag utilities
export { getFlagUrl, resolveFlagPath, getFlagHtml } from './flag-resolver.js';

// Scoring utilities
export {
  CalculateSinclair2024,
  CalculateSinclair2020,
  getMastersAgeFactor
} from './sinclair-coefficients.js';

export { CalculateQPoints } from './qpoints-coefficients.js';
export { computeGamx, Variant } from './gamx2.js';
export { calculateTeamPoints } from './team-points-formula.js';

// Cache utilities
export { buildCacheKey } from './cache-utils.js';

// Timer/decision helpers
export {
  extractTimers,
  computeDisplayMode,
  extractDecisionState,
  extractTimerAndDecisionState
} from './timer-decision-helpers.js';

// Attempt bar utilities
export {
  computeAttemptBarVisibility,
  hasCurrentAthlete,
  logAttemptBarDebug
} from './attempt-bar-visibility.js';

// Records utilities
export { extractRecordsFromUpdate } from './records-extractor.js';

// Standard scoreboard helpers
export {
  getScoreboardData as getStandardScoreboardData,
  SCOREBOARD_CONFIGS
} from './standard-scoreboard-helpers.js';

// Event type constants
export const EVENT_TYPES = {
  UPDATE: 'update',
  TIMER: 'timer',
  DECISION: 'decision',
  DATABASE: 'database',
  FLAGS_LOADED: 'flags_loaded',
  LOGOS_LOADED: 'logos_loaded',
  TRANSLATIONS_LOADED: 'translations_loaded',
  DATABASE_READY: 'database:ready',
  HUB_READY: 'hub:ready',
  SESSION_DONE: 'session:done',
  SESSION_REOPENED: 'session:reopened'
};
```

Create `src/index.js` in hub repo:

```javascript
// src/index.js - Main entry point for @owlcms/tracker-core

// Core hub
export { CompetitionHub, competitionHub } from './tracker-core.js';

// WebSocket server
export { createWebSocketServer, attachWebSocketToServer } from './websocket-server.js';

// Flag utilities
export { getFlagUrl, resolveFlagPath, getFlagHtml } from './utils/flag-resolver.js';

// Scoring utilities
export {
  CalculateSinclair2024,
  CalculateSinclair2020,
  getMastersAgeFactor
} from './utils/sinclair-coefficients.js';

export { CalculateQPoints } from './utils/qpoints-coefficients.js';
export { computeGamx, Variant } from './utils/gamx2.js';
export { calculateTeamPoints } from './utils/team-points-formula.js';

// Cache utilities
export { buildCacheKey } from './utils/cache-utils.js';

// Timer/decision helpers
export {
  extractTimers,
  computeDisplayMode,
  extractDecisionState,
  extractTimerAndDecisionState
} from './utils/timer-decision-helpers.js';

// Attempt bar utilities
export {
  computeAttemptBarVisibility,
  hasCurrentAthlete,
  logAttemptBarDebug
} from './utils/attempt-bar-visibility.js';

// Records utilities
export { extractRecordsFromUpdate } from './utils/records-extractor.js';

// Standard scoreboard helpers
export {
  getScoreboardData as getStandardScoreboardData,
  SCOREBOARD_CONFIGS
} from './utils/standard-scoreboard-helpers.js';

// Event type constants
export const EVENT_TYPES = {
  UPDATE: 'update',
  TIMER: 'timer',
  DECISION: 'decision',
  DATABASE: 'database',
  FLAGS_LOADED: 'flags_loaded',
  LOGOS_LOADED: 'logos_loaded',
  TRANSLATIONS_LOADED: 'translations_loaded',
  DATABASE_READY: 'database:ready',
  HUB_READY: 'hub:ready',
  SESSION_DONE: 'session:done',
  SESSION_REOPENED: 'session:reopened'
};
```

---

### Step 4: Update Tracker Repository

#### 4.1 Update tracker package.json

In `owlcms-tracker/package.json`, add hub dependency:

```json
{
  "name": "owlcms-tracker",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@owlcms/tracker-core": "^1.0.0",
    "@sveltejs/kit": "^2.0.0",
    "svelte": "^4.0.0"
  },
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "setup:linked": "node scripts/setup-linked-development.js"
  }
}
```

#### 4.2 Update Import Statements in Tracker

Find and replace all imports:

**Before:**
```javascript
import { competitionHub } from '$lib/server/tracker-core.js';
import { getFlagUrl } from '$lib/server/utils/flag-resolver.js';
```

**After:**
```javascript
import { competitionHub } from '@owlcms/tracker-core';
import { getFlagUrl } from '@owlcms/tracker-core/utils/flags';
```

**Automated replacement:**
```bash
cd owlcms-tracker

# Replace hub imports
find src -name "*.js" -o -name "*.svelte" | \
  xargs sed -i "s|from '\$lib/server/tracker-core.js'|from '@owlcms/tracker-core'|g"

# Replace utility imports
find src -name "*.js" -o -name "*.svelte" | \
  xargs sed -i "s|from '\$lib/server/utils/|from '@owlcms/tracker-core/utils/|g"
```

#### 4.3 Remove Copied Files from Tracker

After verifying imports work, remove the now-redundant files:

```bash
cd owlcms-tracker

# Remove main hub files
rm src/lib/server/tracker-core.js
rm src/lib/server/websocket-server.js
rm src/lib/server/embedded-database.js

# Remove utility files (if all moved to hub)
rm -rf src/lib/server/utils/
```

#### 4.4 Create Linked Development Setup Script

Create `owlcms-tracker/scripts/setup-linked-development.js`:

```javascript
#!/usr/bin/env node
/**
 * Setup script for linked development (Option B in DEVELOPER_USAGE.md)
 * Automates npm link setup for core developers
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const HUB_REPO = '../tracker-core';
const HUB_EXISTS = fs.existsSync(HUB_REPO);

console.log('🔗 Setting up linked development environment\n');

if (!HUB_EXISTS) {
  console.error('❌ tracker-core repository not found');
  console.log('Expected location:', path.resolve(HUB_REPO));
  console.log('\nPlease clone it first:');
  console.log('  cd ..');
  console.log('  git clone https://github.com/owlcms/tracker-core.git');
  process.exit(1);
}

try {
  console.log('📦 Installing hub dependencies...');
  execSync('npm install', { cwd: HUB_REPO, stdio: 'inherit' });

  console.log('\n🔗 Linking hub globally...');
  execSync('npm link', { cwd: HUB_REPO, stdio: 'inherit' });

  console.log('\n🔗 Linking tracker to hub...');
  execSync('npm link @owlcms/tracker-core', { stdio: 'inherit' });

  console.log('\n✅ Linked development setup complete!');
  console.log('\nYou can now:');
  console.log('  - Edit hub source in ../tracker-core/src/');
  console.log('  - Changes will be reflected immediately in tracker');
  console.log('  - Run: npm run dev');
} catch (error) {
  console.error('\n❌ Setup failed:', error.message);
  process.exit(1);
}
```

Make it executable:
```bash
chmod +x scripts/setup-linked-development.js
```

---

### Step 5: GitHub Actions for Auto-Publishing

Create `.github/workflows/publish.yml` in hub repo:

```yaml
name: Publish to GitHub Packages

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          registry-url: 'https://npm.pkg.github.com'
          scope: '@owlcms'
      
      - name: Install dependencies
        run: npm install
      
      - name: Publish to GitHub Packages
        run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Usage:**
1. Update version in `package.json`
2. Create GitHub release (e.g., `v1.0.1`)
3. GitHub Actions automatically publishes to GitHub Packages

---

### Step 6: Local Development Workflows

#### Option A: Source Checkout (For External Developers)

```bash
# Clone hub for reference
git clone https://github.com/owlcms/tracker-core.git
cd tracker-core
npm install
npm link

# Create custom app
cd ..
mkdir my-app
cd my-app
npm init -y
npm link @owlcms/tracker-core
```

#### Option B: Linked Development (For Core Contributors)

```bash
# Clone both repos
git clone https://github.com/owlcms/tracker-core.git
git clone https://github.com/owlcms/owlcms-tracker.git

# Automated setup
cd owlcms-tracker
npm run setup:linked

# Or manual setup
cd tracker-core && npm install && npm link
cd ../owlcms-tracker && npm install && npm link @owlcms/tracker-core
```

#### Option C: Package Install (For Production)

```bash
# Configure GitHub Packages
echo "@owlcms:registry=https://npm.pkg.github.com" >> .npmrc
echo "//npm.pkg.github.com/:_authToken=YOUR_PAT" >> .npmrc

# Install package
npm install @owlcms/tracker-core@^1.0.0
```

---

### Step 7: Migration Checklist

#### Phase 1: Create Hub Repo

- [ ] Create `tracker-core` GitHub repository
- [ ] Initialize with `package.json` and directory structure
- [ ] Copy files from tracker using script
- [ ] Update import paths in copied files
- [ ] Create `src/index.js` with exports
- [ ] Add GitHub Actions workflow for publishing
- [ ] Copy documentation from `tracker/docs/npm/` to `hub/docs/npm/`
- [ ] Create README.md for hub repo

#### Phase 2: Test Hub Package

- [ ] `npm link` hub locally
- [ ] Create test project to verify exports
- [ ] Test WebSocket integration (both modes)
- [ ] Test all utility modules
- [ ] Verify event system works

#### Phase 3: Update Tracker Repo

- [ ] Update `package.json` with hub dependency
- [ ] Create `scripts/setup-linked-development.js`
- [ ] Find/replace import statements
- [ ] Remove copied files from tracker
- [ ] Test tracker with linked hub (Option B)
- [ ] Verify all plugins still work
- [ ] Run existing tests

#### Phase 4: Publish and Deploy

- [ ] Commit hub repo, push to GitHub
- [ ] Create v1.0.0 release (triggers auto-publish)
- [ ] Verify package appears in GitHub Packages
- [ ] Update tracker to use published package
- [ ] Test production build of tracker

#### Phase 5: Documentation

- [ ] Update tracker README to reference hub package
- [ ] Add setup instructions for three developer scenarios
- [ ] Document linked development workflow
- [ ] Add troubleshooting guide
- [ ] Update contribution guidelines

---

### Step 8: Coordinated Updates (Breaking Changes)

**⚠️ This section is for CORE MAINTAINERS publishing breaking changes, not for local development.**

For local plugin development (Scenario 2), just clone tracker and run `npm install` - no coordination needed.  
For local core development (Scenario 3), use `npm link` (Option B) - changes are immediate via symlink.

When making breaking changes to hub that require tracker updates:

**Process:**

1. **Hub repo:**
   - Create feature branch (e.g., `feature/add-logo-api`)
   - Make changes, update version (e.g., `1.1.0` → `2.0.0` for breaking)
   - Do NOT merge yet

2. **Tracker repo:**
   - Create matching branch (e.g., `feature/use-logo-api`)
   - Use `npm link @owlcms/tracker-core` to test against hub branch
   - Update tracker code to use new API
   - Verify all tests pass

3. **Merge coordination (PUBLISHING only):**
   - Merge hub PR first
   - Create hub release (triggers auto-publish)
   - Wait for package to be available on GitHub Packages
   - Update tracker dependency version in `package.json`
   - Merge tracker PR

4. **Rollback plan:**
   - Hub maintains backward compatibility for one major version
   - Tracker can pin to older version if needed: `"@owlcms/tracker-core": "^1.0.0"`


## Publishing Strategy

### GitHub Packages vs npm Public Registry

**Decision: GitHub Packages**

Reasons:
- ✅ Free for public repositories
- ✅ Integrated with GitHub (no separate account needed)
- ✅ Automatic publishing via GitHub Actions
- ✅ Fine-grained access control
- ❌ Requires authentication to install (`.npmrc` configuration)

**Alternative:** npm public registry requires:
- Creating npm organization
- Managing separate credentials
- Public visibility (not an issue for AGPL licensed code)

### Versioning Strategy

Follow **Semantic Versioning** (semver):

- **Major (X.0.0)**: Breaking API changes
- **Minor (1.X.0)**: New features, backward compatible
- **Patch (1.0.X)**: Bug fixes, no API changes

**Examples:**
- `1.0.0` → `1.0.1`: Fixed bug in timer logic
- `1.0.1` → `1.1.0`: Added `getLogoPath()` method
- `1.1.0` → `2.0.0`: Changed `getSessionAthletes()` signature (breaking)

### Release Process

1. Update version in `package.json` (in hub repo)
2. Commit: `git commit -m "Release v1.2.0"`
3. Create Git tag: `git tag v1.2.0`
4. Push with tags: `git push && git push --tags`
5. Create GitHub Release (triggers auto-publish)
6. Verify package appears in GitHub Packages
7. Update tracker dependency: `"@owlcms/tracker-core": "^1.2.0"`

---

## Testing Strategy

### Hub Package Tests (in hub repo)

Create `tests/` directory in hub repo:

```javascript
// tests/hub-basic.test.js
import { competitionHub, EVENT_TYPES } from '../src/index.js';
import assert from 'assert';

// Test hub initialization
assert.ok(competitionHub, 'Hub should be defined');
assert.ok(competitionHub.getDatabaseState, 'Hub should have getDatabaseState method');

// Test event subscription
let eventFired = false;
competitionHub.on(EVENT_TYPES.DATABASE, () => {
  eventFired = true;
});

// Simulate database message
competitionHub.handleOwlcmsMessage({
  type: 'database',
  payload: { competition: { name: 'Test' }, athletes: [] }
});

assert.ok(eventFired, 'DATABASE event should fire');
console.log('✅ All tests passed');
```

Run tests: `node tests/hub-basic.test.js`

### Tracker Integration Tests (in tracker repo)

Ensure tracker tests still pass after switching to package:

```bash
cd owlcms-tracker
npm test  # Run existing test suite
```

---

## Migration Risks and Mitigation

### Risk 1: Import Path Changes

**Risk:** Breaking all plugin imports when switching from relative to package imports

**Mitigation:**
- Use automated find/replace script
- Test each plugin after replacement
- Keep a backup branch before migration

### Risk 2: Missing Dependencies

**Risk:** Hub code accidentally imports tracker-specific modules

**Mitigation:**
- Review all imports in copied files
- Run hub tests in isolation
- Check for SvelteKit-specific imports (`$lib`, `$app`, etc.)

### Risk 3: Circular Dependencies

**Risk:** Hub code depends on tracker, tracker depends on hub

**Mitigation:**
- Hub should have ZERO tracker dependencies
- Review all imports during file copy
- Hub should be pure JavaScript (no Svelte components)

### Risk 4: Breaking Existing Deployments

**Risk:** Tracker deployments fail after hub extraction

**Mitigation:**
- Test tracker build with linked hub before publishing
- Publish hub as v1.0.0 before updating tracker
- Keep rollback plan (tracker can use old code temporarily)

---

## Future Enhancements

### Possible Future Work

1. **TypeScript Definitions**
   - Add `.d.ts` files for IDE autocomplete
   - Improve developer experience

2. **Unit Tests**
   - Comprehensive test suite for hub
   - CI/CD integration with test coverage

3. **Multiple Consumer Apps**
   - owlcms-tv (Roku/Apple TV app)
   - owlcms-mobile (React Native app)
   - All use same `@owlcms/tracker-core` package

4. **Plugin System**
   - Hub exposes plugin hooks
   - Third-party developers can extend functionality

5. **Performance Monitoring**
   - Add optional telemetry
   - Track hub performance in production

---

## Conclusion

This implementation plan provides a complete roadmap for extracting the competition hub into a separate repository and publishing it as `@owlcms/tracker-core` on GitHub Packages.

**Key Benefits:**
- ✅ Clean separation of concerns
- ✅ External developers can build custom applications
- ✅ Plugin developers have clear API boundaries
- ✅ Core developers can work on both simultaneously (linked development)
- ✅ Automated publishing via GitHub Actions
- ✅ Semantic versioning for stability

**Next Steps:**
1. Review this plan with team
2. Create `tracker-core` GitHub repository
3. Follow migration checklist (Step 7)
4. Test thoroughly before first release
5. Publish v1.0.0 and update tracker

For usage examples and developer guidance, see [DEVELOPER_USAGE.md](./DEVELOPER_USAGE.md).
