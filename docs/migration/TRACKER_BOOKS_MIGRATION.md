# Agent Prompt: Migrate IWF Plugins to tracker-books Repository

## Objective

Migrate `iwf-startbook` and `iwf-results` plugins from `owlcms-tracker` to a new `tracker-books` repository, integrate back as a git subtree at `src/plugins/books/`, and enable side-by-side testing via `_new` URL suffixes.

## Prerequisites

- Working directory: `c:\Dev\git\owlcms-tracker`
- GitHub access to create `owlcms/tracker-books` repository
- Node.js and npm installed
- Git configured with push access to both repos

## Context

### Current State
```
owlcms-tracker/src/plugins/
  iwf-startbook/          # IWF Start Book plugin (~2300 lines helpers.data.js)
  iwf-results/            # IWF Results Book plugin (~1500 lines helpers.data.js)
  lifting-order/          # Other plugins (unchanged)
  team-scoreboard/
  ...
```

### Target State
```
owlcms-tracker/src/plugins/
  iwf-startbook/          # ORIGINAL (kept during testing)
  iwf-results/            # ORIGINAL (kept during testing)
  books/                  # SUBTREE from tracker-books repo
    iwf-helpers/          # Shared pure utility functions
    iwf-startbook/        # Refactored plugin
    iwf-results/          # Refactored plugin
    README.md
```

### URL Routing (Testing Phase)
- `/iwf-startbook` → Original plugin (unchanged)
- `/iwf-results` → Original plugin (unchanged)
- `/iwf-startbook_new` → Subtree plugin (refactored)
- `/iwf-results_new` → Subtree plugin (refactored)

---

## Phase 1: Create tracker-books Repository

### Step 1.1: Create GitHub Repository

Create a new repository at `https://github.com/owlcms/tracker-books`

### Step 1.2: Clone and Initialize

```bash
cd c:\Dev\git
git clone https://github.com/owlcms/tracker-books.git
cd tracker-books
```

### Step 1.3: Copy Current Plugin State

```bash
# Copy current plugin files (no history needed)
cp -r ../owlcms-tracker/src/plugins/iwf-startbook ./iwf-startbook
cp -r ../owlcms-tracker/src/plugins/iwf-results ./iwf-results

git add iwf-startbook/ iwf-results/
git commit -m "Initial commit: Copy IWF plugins from tracker"
```

### Step 1.4: Create iwf-helpers Directory Structure

```bash
mkdir iwf-helpers
touch iwf-helpers/official-roles.js
touch iwf-helpers/athlete-transforms.js
touch iwf-helpers/category-mapping.js
touch iwf-helpers/records-extraction.js
touch iwf-helpers/timetable.js
touch iwf-helpers/session-helpers.js
```

### Step 1.5: Extract Shared Code to iwf-helpers

**Analysis:** Both `helpers.data.js` files contain ~800 lines of duplicated code including:

1. **official-roles.js** - Extract:
   - `OFFICIAL_ROLE_TRANSLATION_KEYS` constant
   - `OFFICIAL_ROLE_PRESENTATION_ORDER` constant
   - `getOfficialRoleTranslationKey()` function
   - `sortOfficialsList()` function
   - `buildOfficialSections()` function

2. **athlete-transforms.js** - Extract:
   - `transformAthlete()` function (unify signatures)
   - `formatAttempt()` function
   - `getAthleteTeam()` function

3. **category-mapping.js** - Extract:
   - `buildCategoryMap()` function
   - `buildAthleteParticipationMap()` function
   - `buildSubcategoryMap()` function
   - `buildAthleteAgeGroupParticipation()` function
   - `extractSessionAgeGroupsWithWeights()` function

4. **records-extraction.js** - Extract:
   - `extractRecords()` function (unify signatures)
   - `extractNewRecords()` function

5. **timetable.js** - Extract:
   - `buildTimetableData()` function
   - `formatSessionTime()` function

6. **session-helpers.js** - Extract:
   - `mapOfficials()` function
   - `buildRankingsData()` function
   - `buildCategoryParticipantsData()` function (startbook only)

**Important:** These are PURE functions with NO imports. Keep all `$lib/server` and `@owlcms/tracker-core` imports in the plugin `helpers.data.js` files.

### Step 1.6: Update Plugin Imports

After extraction, update both plugin `helpers.data.js` files:

```javascript
// iwf-startbook/helpers.data.js (top of file)
import { competitionHub } from '$lib/server/competition-hub.js';
import { logger, getHeaderLogoUrl, formatCategoryDisplay, sortRecordsByFederation, sortRecordsList } from '@owlcms/tracker-core';
import { registerCache } from '$lib/server/cache-epoch.js';

// Import from shared helpers
import { 
  OFFICIAL_ROLE_TRANSLATION_KEYS,
  OFFICIAL_ROLE_PRESENTATION_ORDER,
  getOfficialRoleTranslationKey, 
  sortOfficialsList, 
  buildOfficialSections 
} from '../iwf-helpers/official-roles.js';

import { transformAthlete, formatAttempt, getAthleteTeam } from '../iwf-helpers/athlete-transforms.js';
import { buildCategoryMap, buildAthleteParticipationMap, buildSubcategoryMap, buildAthleteAgeGroupParticipation, extractSessionAgeGroupsWithWeights } from '../iwf-helpers/category-mapping.js';
import { extractRecords, extractNewRecords } from '../iwf-helpers/records-extraction.js';
import { buildTimetableData, formatSessionTime } from '../iwf-helpers/timetable.js';
import { mapOfficials, buildRankingsData, buildCategoryParticipantsData } from '../iwf-helpers/session-helpers.js';

// Re-export for external use if needed
export { getOfficialRoleTranslationKey };

const protocolCache = new Map();
registerCache(protocolCache);

// ... rest of plugin-specific code
```

```javascript
// iwf-results/helpers.data.js (top of file)
import { competitionHub } from '$lib/server/competition-hub.js';
import { logger, getHeaderLogoUrl, formatCategoryDisplay, sortRecordsByFederation, sortRecordsList } from '@owlcms/tracker-core';
import { calculateTeamPoints } from '$lib/server/team-points-formula.js';
import { registerCache } from '$lib/server/cache-epoch.js';

// Import from shared helpers
import { 
  OFFICIAL_ROLE_TRANSLATION_KEYS,
  OFFICIAL_ROLE_PRESENTATION_ORDER,
  sortOfficialsList, 
  buildOfficialSections 
} from '../iwf-helpers/official-roles.js';

import { transformAthlete, formatAttempt, getAthleteTeam } from '../iwf-helpers/athlete-transforms.js';
import { buildCategoryMap, buildAthleteParticipationMap } from '../iwf-helpers/category-mapping.js';
import { extractRecords, extractNewRecords } from '../iwf-helpers/records-extraction.js';
import { buildTimetableData, formatSessionTime } from '../iwf-helpers/timetable.js';
import { mapOfficials, buildRankingsData } from '../iwf-helpers/session-helpers.js';

const protocolCache = new Map();
registerCache(protocolCache);

// ... rest of plugin-specific code
```

### Step 1.7: Add Repository Documentation

Create `README.md`:

```markdown
# Tracker Books

Document generation plugins for OWLCMS Tracker.

## Structure

- **iwf-helpers/** - Shared utility functions (pure functions, no imports)
- **iwf-startbook/** - IWF Start Book plugin
- **iwf-results/** - IWF Results Book plugin

## Integration

Integrated into owlcms-tracker as git subtree at `src/plugins/books/`.

## Development

Edit files in `owlcms-tracker/src/plugins/books/`, then:

```bash
git push-books  # Push changes to this repo
```
```

### Step 1.8: Commit and Push

```bash
git add .
git commit -m "Refactor: Extract shared helpers to iwf-helpers"
git push origin main
```

---

## Phase 2: Add Subtree to owlcms-tracker

### Step 2.1: Add Git Subtree

```bash
cd c:\Dev\git\owlcms-tracker

git subtree add --prefix src/plugins/books https://github.com/owlcms/tracker-books.git main --squash
git push origin main
```

### Step 2.2: Configure Git Aliases

```bash
git config alias.push-books 'subtree push --prefix src/plugins/books https://github.com/owlcms/tracker-books.git main'
git config alias.pull-books 'subtree pull --prefix src/plugins/books https://github.com/owlcms/tracker-books.git main --squash'
```

### Step 2.3: Add NPM Scripts

Update `package.json` scripts section:

```json
{
  "scripts": {
    "books:add": "git subtree add --prefix src/plugins/books https://github.com/owlcms/tracker-books.git main --squash",
    "books:remove": "rm -rf src/plugins/books",
    "books:pull": "git subtree pull --prefix src/plugins/books https://github.com/owlcms/tracker-books.git main --squash",
    "books:push": "git subtree push --prefix src/plugins/books https://github.com/owlcms/tracker-books.git main"
  }
}
```

---

## Phase 3: Update Scoreboard Registry

### Step 3.1: Update Glob Patterns

In `src/lib/server/scoreboard-registry.js`, change:

```javascript
// FROM:
const configModules = import.meta.glob('../../plugins/*/config.js', { eager: true });
const helperModules = import.meta.glob('../../plugins/*/helpers.data.js', { eager: true });

// TO:
const configModules = import.meta.glob('../../plugins/**/config.js', { eager: true });
const helperModules = import.meta.glob('../../plugins/**/helpers.data.js', { eager: true });
```

### Step 3.2: Update _doInitialize Method

Replace the `_doInitialize` method:

```javascript
async _doInitialize() {
    const discovered = new Set();

    for (const configPath of Object.keys(configModules)) {
        const parts = configPath.split('/');
        if (parts.length < 3) continue;
        
        // Find 'plugins' index
        const pluginsIndex = parts.indexOf('plugins');
        if (pluginsIndex === -1 || pluginsIndex >= parts.length - 2) continue;
        
        // Everything between 'plugins' and 'config.js'
        const pluginPath = parts.slice(pluginsIndex + 1, -1).join('/');
        discovered.add(pluginPath);
    }

    for (const pluginPath of discovered) {
        await this.registerScoreboard(pluginPath);
    }

    this.initialized = true;
}
```

### Step 3.3: Update registerScoreboard Method

Replace the `registerScoreboard` method:

```javascript
async registerScoreboard(pluginPath) {
    try {
        const configModule = configModules[`../../plugins/${pluginPath}/config.js`];
        if (!configModule) {
            console.warn(`[ScoreboardRegistry] Skipping ${pluginPath}: no config.js`);
            return;
        }
        
        const config = configModule.default || configModule;
        
        const helpersModule = helperModules[`../../plugins/${pluginPath}/helpers.data.js`];
        const dataHelper = helpersModule
            ? helpersModule.getScoreboardData || helpersModule.default
            : null;
        
        // Extract folder name (last segment of path)
        const folderName = pluginPath.split('/').pop();
        
        // TESTING PHASE: Subtree plugins (under books/) get _new suffix
        // This allows side-by-side testing with originals
        const isSubtreePlugin = pluginPath.startsWith('books/');
        const type = isSubtreePlugin ? `${folderName}_new` : folderName;
        
        this.scoreboards.set(type, {
            type,
            pluginPath,  // Full path for dynamic imports
            folderName,
            config,
            dataHelper,
            path: `../../plugins/${pluginPath}`
        });
        
        console.log(`[ScoreboardRegistry] Registered: ${pluginPath} → type: ${type}`);
        
    } catch (err) {
        console.error(`[ScoreboardRegistry] Failed to register ${pluginPath}:`, err);
    }
}
```

### Step 3.4: Update +page.server.js

In `src/routes/[scoreboard=scoreboard]/+page.server.js`, add `pluginPath` to the return object:

```javascript
return {
    scoreboardType: type,
    pluginPath: scoreboard.pluginPath,  // ADD THIS LINE
    scoreboardName: scoreboard.config.name,
    scoreboardDescription: scoreboard.config.description,
    fopName,
    options,
    config: scoreboard.config
};
```

### Step 3.5: Update +page.svelte Dynamic Import

In `src/routes/[scoreboard=scoreboard]/+page.svelte`, change the dynamic import:

```svelte
<!-- FROM: -->
{#await import(`../../plugins/${data.scoreboardType}/page.svelte`)}

<!-- TO: -->
{#await import(`../../plugins/${data.pluginPath}/page.svelte`)}
```

---

## Phase 4: Testing

### Step 4.1: Start Development Server

```bash
cd c:\Dev\git\owlcms-tracker
npm run dev
```

### Step 4.2: Verify URL Routing

Test these URLs:

| URL | Expected Source | Description |
|-----|-----------------|-------------|
| `/iwf-startbook` | `src/plugins/iwf-startbook/` | Original plugin |
| `/iwf-results` | `src/plugins/iwf-results/` | Original plugin |
| `/iwf-startbook_new` | `src/plugins/books/iwf-startbook/` | Subtree plugin |
| `/iwf-results_new` | `src/plugins/books/iwf-results/` | Subtree plugin |

### Step 4.3: Compare Output

Open side-by-side:
- `http://localhost:8096/iwf-startbook` vs `http://localhost:8096/iwf-startbook_new`
- `http://localhost:8096/iwf-results` vs `http://localhost:8096/iwf-results_new`

**Verify identical output:**
- ✅ Same participant lists
- ✅ Same official role displays
- ✅ Same record formatting
- ✅ Same team points calculation
- ✅ Same page layout and styling

### Step 4.4: Test Subtree Workflow

```bash
# Make a test change in subtree
echo "// test" >> src/plugins/books/iwf-startbook/helpers.data.js

# Commit to tracker
git add src/plugins/books/
git commit -m "Test: Verify subtree push"

# Push to tracker-books repo
git push-books

# Verify change appears in tracker-books
cd c:\Dev\git\tracker-books
git pull origin main
```

### Step 4.5: Test Minimal Build (Without Books)

```bash
cd c:\Dev\git\owlcms-tracker

# Remove books
npm run books:remove

# Verify dev server still works
npm run dev
# URLs /iwf-startbook_new and /iwf-results_new should 404
# URLs /iwf-startbook and /iwf-results should still work

# Re-add books
npm run books:add
```

---

## Phase 5: Packaging (Two Variants)

### Step 5.1: Update package.json Scripts

Add build scripts for both variants:

```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    
    "build:minimal": "npm run books:remove && vite build",
    "build:full": "npm run books:add && vite build",
    
    "package": "npm run package:minimal && npm run package:full",
    "package:minimal": "npm run build:minimal && node scripts/package.js minimal",
    "package:full": "npm run build:full && node scripts/package.js full",
    
    "books:add": "git subtree add --prefix src/plugins/books https://github.com/owlcms/tracker-books.git main --squash || git subtree pull --prefix src/plugins/books https://github.com/owlcms/tracker-books.git main --squash",
    "books:remove": "rm -rf src/plugins/books",
    "books:pull": "git subtree pull --prefix src/plugins/books https://github.com/owlcms/tracker-books.git main --squash",
    "books:push": "git subtree push --prefix src/plugins/books https://github.com/owlcms/tracker-books.git main"
  }
}
```

### Step 5.2: Create Packaging Script

Create `scripts/package.js`:

```javascript
#!/usr/bin/env node
import { execSync } from 'child_process';
import { readFileSync } from 'fs';

const variant = process.argv[2] || 'full';
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const version = pkg.version;

const zipName = variant === 'minimal' 
  ? `owlcms-tracker-${version}-minimal.zip`
  : `owlcms-tracker-${version}.zip`;

console.log(`Packaging ${variant} build as ${zipName}...`);

execSync(`cd build && zip -r ../${zipName} .`, { stdio: 'inherit' });

console.log(`✓ Created ${zipName}`);
```

### Step 5.3: Create Dockerfile Variants

Create `Dockerfile` (full build - default):

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Ensure books are included
RUN npm run books:add || true
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/build ./build
COPY --from=builder /app/package*.json ./
RUN npm ci --production
EXPOSE 8096
CMD ["node", "build"]
```

Create `Dockerfile.minimal`:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Remove books for minimal build
RUN rm -rf src/plugins/books
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/build ./build
COPY --from=builder /app/package*.json ./
RUN npm ci --production
EXPOSE 8096
CMD ["node", "build"]
```

### Step 5.4: Update CI/CD Pipeline

Example GitHub Actions workflow (`.github/workflows/release.yml`):

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - run: npm ci
      
      # Build minimal variant
      - name: Build Minimal
        run: |
          rm -rf src/plugins/books
          npm run build
          cd build && zip -r ../owlcms-tracker-${{ github.ref_name }}-minimal.zip .
      
      # Build full variant  
      - name: Build Full
        run: |
          git subtree add --prefix src/plugins/books https://github.com/owlcms/tracker-books.git main --squash || true
          npm run build
          cd build && zip -r ../owlcms-tracker-${{ github.ref_name }}.zip .
      
      # Upload artifacts
      - name: Upload Release Assets
        uses: softprops/action-gh-release@v1
        with:
          files: |
            owlcms-tracker-${{ github.ref_name }}.zip
            owlcms-tracker-${{ github.ref_name }}-minimal.zip

  docker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Build Full Docker Image
        run: |
          docker build -t owlcms/tracker:${{ github.ref_name }} .
          docker push owlcms/tracker:${{ github.ref_name }}
      
      - name: Build Minimal Docker Image
        run: |
          docker build -f Dockerfile.minimal -t owlcms/tracker:${{ github.ref_name }}-minimal .
          docker push owlcms/tracker:${{ github.ref_name }}-minimal
```

### Step 5.5: Build Output Summary

| Artifact | Contents | Use Case |
|----------|----------|----------|
| `owlcms-tracker-X.Y.Z.zip` | All scoreboards + IWF books | Competition venue |
| `owlcms-tracker-X.Y.Z-minimal.zip` | Scoreboards only | Public displays |
| `owlcms/tracker:X.Y.Z` | Full Docker image | Container deployments |
| `owlcms/tracker:X.Y.Z-minimal` | Minimal Docker image | Lightweight deployments |

---

## Phase 6: Cutover (After Successful Testing)

Once the `_new` variants are fully validated, we **keep only the subtree versions and remove the originals entirely**.

### Step 6.1: Flip the Type Registration

In `src/lib/server/scoreboard-registry.js`, change:

```javascript
// FROM (testing phase):
const isSubtreePlugin = pluginPath.startsWith('books/');
const type = isSubtreePlugin ? `${folderName}_new` : folderName;

// TO (cutover):
const isOriginalPlugin = !pluginPath.includes('/');
const type = isOriginalPlugin ? `${folderName}_old` : folderName;
```

**After cutover:**
- `/iwf-startbook` → Subtree plugin (new default)
- `/iwf-results` → Subtree plugin (new default)
- `/iwf-startbook_old` → Original plugin (fallback)
- `/iwf-results_old` → Original plugin (fallback)

### Step 6.2: Test Cutover

Verify:
- `http://localhost:8096/iwf-startbook` now uses subtree plugin
- `http://localhost:8096/iwf-startbook_old` uses original plugin

### Step 6.3: Remove Original Plugins (Final Step)

**Only after production verification (1-2 weeks):**

```bash
cd c:\Dev\git\owlcms-tracker

# Remove originals - we keep only the subtree versions
git rm -r src/plugins/iwf-startbook
git rm -r src/plugins/iwf-results
git commit -m "Remove original IWF plugins - migration complete"
git push origin main
```

Then simplify the registry to remove the suffix logic entirely:

```javascript
// Simplified - no more _old suffix needed
const type = pluginPath.split('/').pop();
```

**Result after cutover:**
- Only subtree-based plugins remain (`src/plugins/books/iwf-startbook/`, `src/plugins/books/iwf-results/`)
- Original plugins deleted from tracker repo
- Packaging continues to produce both minimal (no books) and full (with books) variants

---

## Rollback Procedures

### During Testing Phase (Originals Exist)

No action needed - original URLs work normally.

### After Cutover (Before Original Removal)

```javascript
// Revert registry change:
const isSubtreePlugin = pluginPath.startsWith('books/');
const type = isSubtreePlugin ? `${folderName}_new` : folderName;
```

### After Original Removal

```bash
# Restore originals from git history
git checkout HEAD~1 -- src/plugins/iwf-startbook src/plugins/iwf-results
git commit -m "Rollback: Restore original IWF plugins"
```

---

## Success Criteria

- [ ] tracker-books repository created with refactored plugins
- [ ] iwf-helpers contains extracted shared code (~800 lines)
- [ ] Both plugins use `../iwf-helpers/` imports correctly
- [ ] Subtree added at `src/plugins/books/`
- [ ] Git aliases configured (push-books, pull-books)
- [ ] NPM scripts added (books:add, books:remove, books:pull, books:push)
- [ ] Registry updated with `**/config.js` glob pattern
- [ ] Registry handles nested paths correctly
- [ ] `_new` URLs work for subtree plugins
- [ ] Original URLs continue to work
- [ ] Side-by-side output is identical
- [ ] Subtree push/pull workflow tested
- [ ] Minimal build (without books) tested

---

## Files Modified

### tracker-books Repository (New)
- `iwf-helpers/official-roles.js` (new)
- `iwf-helpers/athlete-transforms.js` (new)
- `iwf-helpers/category-mapping.js` (new)
- `iwf-helpers/records-extraction.js` (new)
- `iwf-helpers/timetable.js` (new)
- `iwf-helpers/session-helpers.js` (new)
- `iwf-startbook/helpers.data.js` (modified - imports)
- `iwf-results/helpers.data.js` (modified - imports)
- `README.md` (new)

### owlcms-tracker Repository
- `package.json` (add scripts)
- `src/lib/server/scoreboard-registry.js` (update glob, registerScoreboard)
- `src/routes/[scoreboard=scoreboard]/+page.server.js` (add pluginPath)
- `src/routes/[scoreboard=scoreboard]/+page.svelte` (use pluginPath)
- `src/plugins/books/` (subtree - auto-added)
