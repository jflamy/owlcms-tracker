# Tracker Core Developer Guide

**Building custom competition applications with OWLCMS**

This guide covers everything from choosing the right development approach to building production-ready applications using the Tracker Core package.

---

## Table of Contents

1. [Developer Scenarios](#developer-scenarios) - Which approach fits your needs?
2. [Installation & Setup](#installation--setup) - Getting started
3. [Quick Start Examples](#quick-start-examples) - Working code
4. [Repository Architecture](#repository-architecture) - Understanding the structure
5. [Troubleshooting](#troubleshooting) - Common issues

---

## Developer Scenarios

### Which Developer Are You?

Choose your scenario to see the recommended setup:

#### Scenario 1: External REST API Developer

**You want to:** Build a custom application (vMix controller, mobile app backend, custom scoreboard service)

**You need:**
- Hub API to read competition data
- WebSocket connection to OWLCMS
- No tracker source code needed

**Recommended approach:** **Source checkout + npm link**

**Why:** Browse hub source code when debugging, understand data structures, see implementation examples

**Setup (do this):**

```bash
# Clone hub repo (read-only reference)
git clone https://github.com/owlcms/tracker-core.git
cd tracker-core
npm install

# Link it globally for local development
npm link

# Create your Express app in separate directory
cd ..
mkdir my-vmix-controller
cd my-vmix-controller
npm init -y

# Link to local hub
npm link @owlcms/tracker-core

# Install other dependencies
npm install express
```

---

#### Scenario 2: Tracker Plugin Developer  

**You want to:** Create custom scoreboards for the owlcms-tracker app

**You need:**
- Tracker source code to add plugins to `src/plugins/`
- Hub as a black-box dependency
- No need to modify hub internals

**Recommended approach (post-migration):** **Clone owlcms-tracker + link tracker-core**

**Why:** Plugin development stays the same (you only edit `src/plugins/`), but `owlcms-tracker` now requires the `@owlcms/tracker-core` dependency in order to run.

**Setup (required to run `npm run dev`):**

```bash
# 1) Get tracker-core and link it (you don't need to edit it)
git clone https://github.com/owlcms/tracker-core.git
cd tracker-core
npm install
npm link

# 2) Get owlcms-tracker and link it to your local tracker-core
cd ..
git clone https://github.com/owlcms/owlcms-tracker.git
cd owlcms-tracker
npm install
npm link @owlcms/tracker-core

# 3) Run the tracker
npm run dev
```

**Create your plugin (same workflow as today):**
- Use an LLM to create a new folder under `src/plugins/<your-plugin>/` following the existing plugin patterns.
- Restart the dev server if the plugin registry requires it.

If you prefer installing `@owlcms/tracker-core` from a registry instead of linking, use **Scenario 4**.

---

#### Scenario 3: Core Hub/Tracker Developer

**You want to:** Enhance hub API while developing tracker features simultaneously

**You need:**
- Both hub and tracker source code
- Ability to modify hub and test in tracker immediately
- Synchronized commits across both codebases

**Recommended approach:** **Linked development setup**

**Why:** Simple atomic workflow, automatic workspace linking, easier to keep in sync

**Setup (do this):**

```bash
# Clone both repos
git clone https://github.com/owlcms/tracker-core.git
git clone https://github.com/owlcms/owlcms-tracker.git

# Link hub globally
cd tracker-core
npm install
npm link

# Link tracker to use local hub
cd ../owlcms-tracker
npm install
npm link @owlcms/tracker-core

# Run tracker (it will use your local hub)
npm run dev
```

**What happens:**
- Tracker SvelteKit app runs on port 8096
- `npm link` creates a symlink: `tracker/node_modules/@owlcms/tracker-core` → `../tracker-core/src`
- When tracker imports `@owlcms/tracker-core`, it reads directly from your hub source folder
- Vite dev server watches the hub folder for file changes
- Edit hub source → Save → Vite detects change → Tracker auto-reloads the affected modules (HMR)
- **You only run the tracker** - hub is a library dependency, not a separate app

**Automated setup script (tracker includes this):**

```bash
cd owlcms-tracker
npm run setup:linked
```

**Benefits:**
- ✅ Edit hub source code while tracker is running
- ✅ See hub changes immediately in tracker (HMR reloads)
- ✅ Atomic commits across hub and tracker
- ✅ Test hub changes in real tracker context

---

#### Scenario 4: Use tracker-core without a checkout

**You want to:** Use `@owlcms/tracker-core` without cloning the `tracker-core` repository

**Recommended approach:** Install the published `@owlcms/tracker-core` package (public)

**Setup (do this):**

```bash
# If @owlcms is published on GitHub Packages, you typically need the registry mapping
# but NOT an auth token when the package is public.
echo "@owlcms:registry=https://npm.pkg.github.com" >> .npmrc

# Install package
npm install @owlcms/tracker-core@^1.0.0
```

**When to use:** Consumers who just want the stable package without a source checkout

---

#### Scenario 5: Publish tracker-core as a public package (maintainers)

**You want to:** Publish `@owlcms/tracker-core` as a public package on GitHub, using GitHub Actions

**Recommended approach:** Release-driven publish from `tracker-core` repo

**High-level steps:**

1. In `tracker-core/package.json`, ensure publish settings are correct for a public package:
  - `name: "@owlcms/tracker-core"`
  - `type: "module"`
  - `publishConfig.access: "public"`
  - `publishConfig.registry: "https://npm.pkg.github.com"`
2. Add a GitHub Actions workflow that:
  - runs `npm ci`
  - runs any lightweight checks
  - publishes on tagged releases (for example: `v1.2.3`) using `GITHUB_TOKEN`
3. Create a release/tag to trigger the workflow.
4. Verify install works without authentication for consumers (Scenario 4).

---

## Installation & Setup

### Prerequisites

- Node.js 18+ installed
- Basic JavaScript/TypeScript knowledge  
- OWLCMS running and accessible via WebSocket

---

Follow the setup steps in your Scenario above. This section intentionally avoids duplicating those instructions.

---

## Quick Start Examples

**Complete working example** - automatically switches vMix overlays based on competition events (good lift → show video, bad lift → show video, then back to scoreboard).

### 1. Install Dependencies

```bash
npm install @owlcms/tracker-core express axios
```

### 2. Create `vmix-controller.js`

```javascript
import { competitionHub, EVENT_TYPES, attachWebSocketToServer } from '@owlcms/tracker-core';
import express from 'express';
import axios from 'axios';

// vMix Configuration
const VMIX_HOST = 'http://localhost:8088'; // vMix HTTP API
const SCOREBOARD_INPUT = 1;  // Input number for scoreboard overlay
const GOOD_LIFT_INPUT = 2;   // Input number for "Good Lift" video
const BAD_LIFT_INPUT = 3;    // Input number for "Bad Lift" video

// Switch vMix input
async function switchVmixInput(inputNumber) {
  try {
    await axios.get(`${VMIX_HOST}/api/?Function=PreviewInput&Input=${inputNumber}`);
    await axios.get(`${VMIX_HOST}/api/?Function=Transition&Duration=500`);
    console.log(`[vMix] Switched to input ${inputNumber}`);
  } catch (error) {
    console.error('[vMix] Switch failed:', error.message);
  }
}

// Update scoreboard overlay with athlete data
async function updateVmixScoreboard(fopUpdate) {
  const currentAthlete = fopUpdate?.fullName || 'No athlete';
  const weight = fopUpdate?.weight || '--';
  const attempt = fopUpdate?.attemptNumber || '--';
  
  try {
    await axios.get(`${VMIX_HOST}/api/?Function=SetText&Input=${SCOREBOARD_INPUT}&Value=${currentAthlete}`);
    console.log(`[vMix] Updated scoreboard: ${currentAthlete} - ${weight}kg (Attempt ${attempt})`);
  } catch (error) {
    console.error('[vMix] Scoreboard update failed:', error.message);
  }
}

// Start Express server
const app = express();
const server = app.listen(8096, () => {
  console.log('[Server] Running on port 8096');
});

// Attach WebSocket handler to existing server (handles OWLCMS connection automatically)
attachWebSocketToServer({
  server,
  path: '/ws',
  hub: competitionHub,
  onConnect: () => console.log('[WebSocket] OWLCMS connected'),
  onDisconnect: () => console.log('[WebSocket] OWLCMS disconnected')
});

// Subscribe to competition events
competitionHub.on(EVENT_TYPES.DECISION, async ({ fopName, payload }) => {
  console.log(`[Decision] FOP ${fopName}: ${payload.decisionEventType}`);
  
  if (payload.decisionEventType === 'FULL_DECISION') {
    // Count good lifts (d1, d2, d3 are "true"/"false" strings)
    const goodCount = [payload.d1, payload.d2, payload.d3]
      .filter(d => d === 'true')
      .length;
    
    const isGoodLift = goodCount >= 2;
    
    // Switch to appropriate video
    await switchVmixInput(isGoodLift ? GOOD_LIFT_INPUT : BAD_LIFT_INPUT);
    
    // Return to scoreboard after 3 seconds
    setTimeout(async () => {
      await switchVmixInput(SCOREBOARD_INPUT);
    }, 3000);
  }
});

competitionHub.on(EVENT_TYPES.UPDATE, async ({ fopName, payload }) => {
  console.log(`[Update] FOP ${fopName}: ${payload.uiEvent}`);
  
  if (payload.uiEvent === 'LiftingOrderUpdated') {
    // Update scoreboard with new athlete info
    await updateVmixScoreboard(payload);
  }
});

competitionHub.on(EVENT_TYPES.TIMER, ({ fopName, payload }) => {
  if (payload.athleteTimerEventType === 'StartTime') {
    console.log(`[Timer] FOP ${fopName}: Timer started (${payload.athleteMillisRemaining}ms)`);
  }
});

console.log('[vMix Controller] Ready - waiting for OWLCMS connection');
console.log('[Setup] Configure OWLCMS: Prepare Competition → Language and System Settings → Connections');
console.log('[Setup] Set "URL for Video Data" to: ws://localhost:8096/ws');
```

### 3. Configure OWLCMS

In OWLCMS: **Prepare Competition → Language and System Settings → Connections → URL for Video Data**

Set to: `ws://localhost:8096/ws`

### 4. Configure vMix

1. Create inputs in vMix:
   - Input 1: Browser source pointing to scoreboard (e.g., `http://localhost:8096/lifting-order?fop=A`)
   - Input 2: Video file for "Good Lift" animation
   - Input 3: Video file for "Bad Lift" animation

2. Ensure vMix HTTP API is enabled (Settings → Web Controller → Enable)

### 5. Run

```bash
node vmix-controller.js
```

**What it does:**
- ✅ Receives all OWLCMS events (decisions, timer, updates)
- ✅ Automatically switches to good/bad lift video on referee decision
- ✅ Returns to scoreboard after 3 seconds
- ✅ Updates scoreboard overlay with current athlete info

---

## Additional Usage Examples

### Express.js REST API Server

Build a REST API that exposes competition data:

```javascript
import { competitionHub } from '@owlcms/tracker-core';
import express from 'express';

const app = express();

// Get current lifting order for a FOP
app.get('/api/lifting-order/:fop', (req, res) => {
  const fopUpdate = competitionHub.getFopUpdate({ fopName: req.params.fop });
  const sessionAthletes = competitionHub.getSessionAthletes({ fopName: req.params.fop });
  
  res.json({
    currentAthlete: fopUpdate?.fullName || null,
    athletes: sessionAthletes,
    timer: {
      state: fopUpdate?.athleteTimerEventType,
      remaining: fopUpdate?.athleteMillisRemaining
    }
  });
});

// Get all athletes in database
app.get('/api/athletes', (req, res) => {
  const database = competitionHub.getDatabaseState();
  res.json(database?.athletes || []);
});

app.listen(3000, () => {
  console.log('API server running on port 3000');
});
```

### Next.js API Route

```javascript
// pages/api/scoreboard/[fop].js
import { competitionHub } from '@owlcms/tracker-core';

export default function handler(req, res) {
  const { fop } = req.query;
  
  const fopUpdate = competitionHub.getFopUpdate({ fopName: fop });
  const sessionAthletes = competitionHub.getSessionAthletes({ fopName: fop });
  
  res.status(200).json({
    fop,
    currentAthlete: {
      name: fopUpdate?.fullName,
      weight: fopUpdate?.weight,
      attempt: fopUpdate?.attemptNumber
    },
    athletes: sessionAthletes,
    timestamp: Date.now()
  });
}
```

### CLI Data Export Tool

```javascript
#!/usr/bin/env node
import { competitionHub, EVENT_TYPES } from '@owlcms/tracker-core';
import fs from 'fs';

// Wait for database
competitionHub.on(EVENT_TYPES.DATABASE, () => {
  const database = competitionHub.getDatabaseState();
  
  // Export to JSON
  fs.writeFileSync(
    'competition-export.json',
    JSON.stringify(database, null, 2)
  );
  
  console.log('✓ Competition data exported to competition-export.json');
  console.log(`  Athletes: ${database.athletes?.length || 0}`);
  console.log(`  Teams: ${database.teams?.length || 0}`);
  process.exit(0);
});

console.log('Waiting for OWLCMS database...');
```

---

## API Reference

See [API_REFERENCE.md](./API_REFERENCE.md) for complete API documentation including:

- **Core Hub Methods** (14 methods)
- **Event System** (11 event types)
- **WebSocket Integration** (2 modes)
- **Data Structures** (Database State, FOP Updates, Session Athletes)
- **Utility Modules** (17 modules)

---

## Repository Architecture

### Understanding the Structure

The Tracker Core and Tracker system uses **separate repositories** for clean separation of concerns:

#### Repository: `tracker-core`

**Purpose:** Core data hub package for external developers

**Contents:**
- Hub API (`competition-hub.js`)
- WebSocket server (`websocket-server.js`)
- Utility modules (scoring, translations, embedded database)
- API documentation (`docs/npm/`)
- Package build configuration

**Published as:** `@owlcms/tracker-core` (public package on GitHub Packages)

**Target users:**
- External developers building custom applications
- Developers who only need hub functionality
- Production applications that don't need tracker

---

#### Repository: `owlcms-tracker`

**Purpose:** Competition scoreboard application with plugin system

**Contents:**
- SvelteKit app with routes and UI
- Plugin system (`src/plugins/`)
- Scoreboard templates
- Tracker-specific documentation
- Dependency: `@owlcms/tracker-core`

**Target users:**
- Plugin developers creating custom scoreboards
- Competition organizers deploying tracker
- Users who want pre-built scoreboard application

---

### Why Separate Repos?

**Benefits:**

1. **Clean separation** - Hub has no tracker-specific code
2. **Independent versioning** - Hub can be updated without tracker changes
3. **Smaller downloads** - External devs only get hub (~500KB)
4. **Clear boundaries** - Plugin devs don't accidentally modify hub
5. **Easier onboarding** - New developers understand scope immediately

**Workflow for Core Developers:**

Use the linked development setup from **Scenario 3** to work on both simultaneously:

```bash
# Clone both repos
git clone https://github.com/owlcms/tracker-core.git
git clone https://github.com/owlcms/owlcms-tracker.git

# Link them
cd tracker-core && npm install && npm link
cd ../owlcms-tracker && npm install && npm link @owlcms/tracker-core

# Develop in parallel
# Run the tracker; it will load tracker-core from your linked checkout
# Terminal: cd owlcms-tracker && npm run dev
```

Changes to hub are immediately reflected in tracker during development.

---

### Publishing Workflow

**Hub Package:**
1. Make changes in `tracker-core` repo
2. Update version in `package.json`
3. Create GitHub release
4. GitHub Actions publishes the public package (see Scenario 5)
5. External developers get update with `npm update @owlcms/tracker-core`

**Tracker App:**
1. Make changes in `owlcms-tracker` repo
2. Update `package.json` dependency: `"@owlcms/tracker-core": "^1.2.0"`
3. Deploy tracker with updated hub dependency

**Atomic updates across both:**
1. Branch in `tracker-core`, commit changes
2. Branch in `owlcms-tracker`, update dependency, test
3. Merge both PRs together
4. Publish hub, then deploy tracker

---

## Troubleshooting

### Registry Configuration (published package)

If you install `@owlcms/tracker-core` as a published package (Scenario 4) and it is hosted on GitHub Packages, you may need the scoped registry mapping:

```bash
echo "@owlcms:registry=https://npm.pkg.github.com" >> ~/.npmrc
```

If you use `npm link` (Scenario 1, 2, or 3), you do not need any registry configuration.

### Import Errors

Make sure your `package.json` has `"type": "module"` for ES6 imports:

```json
{
  "type": "module"
}
```

### OWLCMS Not Connecting

1. Check OWLCMS configuration: **Prepare Competition → Connections → URL for Video Data**
2. Ensure URL is `ws://your-server:8096/ws` (not `http://`)
3. Check firewall rules allow WebSocket connections

### Hub Not Receiving Data

```javascript
// Add debug logging
competitionHub.on(EVENT_TYPES.DATABASE, () => {
  console.log('[Debug] Database received');
});

competitionHub.on(EVENT_TYPES.UPDATE, ({ fopName, payload }) => {
  console.log(`[Debug] Update received for ${fopName}:`, payload.uiEvent);
});

```

---

## Next Steps

- **Complete API Documentation:** [API_REFERENCE.md](./API_REFERENCE.md) - All hub methods, events, data structures
- **Implementation Details:** [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) - For contributors modifying hub internals
- **Core Repo Extraction:** [CORE_MIGRATION.md](./CORE_MIGRATION.md) - What changes to make in the new `tracker-core` repository
- **Tracker Update Guide:** [TRACKER_MIGRATION.md](./TRACKER_MIGRATION.md) - What to change in `owlcms-tracker` to consume the package
- **Build Custom Scoreboards:** See [CREATE_YOUR_OWN.md](../../CREATE_YOUR_OWN.md) in the tracker repo for plugin development guide
