# Tracker Core Migration (tracker-core) — LLM Action Prompt

Use this prompt to extract the **hub + WebSocket ingestion + shared utilities** from **owlcms-tracker** into the new **tracker-core** repository.

**Target state:** the new repo publishes (or can be locally linked as) the package `@owlcms/tracker-core` implementing the API contract in [API_REFERENCE.md](./API_REFERENCE.md).

---

## Role

You are an automated coding agent working primarily in the **tracker-core** repository, using **owlcms-tracker** as the source of the current implementation to extract.

---

## Goals (must achieve all)

1. Create the new repo `owlcms/tracker-core` containing:
   - hub/state store (`competitionHub`)
   - WebSocket integration helpers supporting both modes:
     - standalone server
     - attach/inject into an existing HTTP/Express server (required)
   - protocol parsing + binary handlers + embedded database helpers
   - shared utility/scoring helpers documented as public API

2. Ensure the public import surface matches [API_REFERENCE.md](./API_REFERENCE.md), including:

   - `import { competitionHub } from '@owlcms/tracker-core';`
   - `import { createWebSocketServer, attachWebSocketToServer } from '@owlcms/tracker-core/websocket';`
   - `import { getFlagUrl, getFlagHtml } from '@owlcms/tracker-core/utils';`
   - `import { CalculateSinclair2024 } from '@owlcms/tracker-core/scoring';`

3. Remove tracker-only coupling from extracted code (no SvelteKit route/plugin registry dependencies).

---

## Constraints (follow strictly)

- The core package must be **Node-only** (Node 18+):
  - no SvelteKit `$lib/...` aliases
  - no browser globals
- Do not move tracker-only code into core (SvelteKit routes, plugin registry, UI-specific logic).
- Keep “tracker-specific behavior” optional via callbacks (no hard dependencies on tracker modules).
- Maintain hub ↔ websocket cooperation for **resource requests / preconditions** within the package.
- The core API must allow configuring **where local files are written** when OWLCMS sends ZIP resources (flags/logos/pictures/styles).

---

## Work plan (execute in order)

### Step 1 — Identify what to move (from owlcms-tracker)

Copy these modules out of the tracker repo (paths are from `owlcms-tracker`):

1. Hub and core state:
   - `src/lib/server/competition-hub.js`

2. WebSocket + protocol + parsing:
   - `src/lib/server/websocket-server.js`
   - `src/lib/server/protocol-config.js`
   - `src/lib/server/parser-v2.js` (and any format detector helpers)
   - `src/lib/server/binary-handler.js`
   - `src/lib/server/embedded-database.js`
   - `src/lib/server/records-extractor.js`

3. Utilities intended to be public:
   - `src/lib/server/flag-resolver.js`
   - `src/lib/server/cache-utils.js`
   - `src/lib/server/timer-decision-helpers.js`
   - `src/lib/server/team-points-formula.js`
   - `src/lib/server/attempt-bar-visibility.js`
   - plus any other “pure” helpers referenced by scoreboards and documented in the API reference

Do NOT move tracker-only modules:

- `src/lib/server/scoreboard-registry.js`
- anything under `src/routes/**`
- client-side stores/components

### Step 2 — Create a core repo layout with stable public entrypoints

Use a `src/` implementation folder and expose stable public imports via subpath entrypoints.

Recommended layout:

```
tracker-core/
  src/
    index.js
    competition-hub.js
    websocket/
      index.js
    utils/
      index.js
      flag-resolver.js
      cache-utils.js
      timer-decision-helpers.js
      attempt-bar-visibility.js
      records-extractor.js
    scoring/
      index.js
      sinclair-coefficients.js
      qpoints-coefficients.js
      gamx2.js
      team-points-formula.js
    protocol/
      protocol-config.js
      parser-v2.js
      binary-handler.js
      embedded-database.js
```

This structure is not mandatory, but the public imports MUST remain stable.

### Step 3 — Refactor imports: remove SvelteKit aliases

Replace any imports like:

```js
import { competitionHub } from '$lib/server/competition-hub.js';
```

with package-local relative imports, e.g.:

```js
import { competitionHub } from '../competition-hub.js';
```

Rule: core repo must not depend on SvelteKit aliases.

### Step 4 — Implement the public API entrypoints

Create public entrypoints matching [API_REFERENCE.md](./API_REFERENCE.md):

1. `src/index.js` (package root)

```js
export { competitionHub } from './competition-hub.js';
// Optional: export { CompetitionHub } from './competition-hub.js';
```

2. `src/websocket/index.js` (must expose both modes)

```js
export { createWebSocketServer, attachWebSocketToServer } from '../websocket-server.js';
```

3. `src/utils/index.js`

```js
export { getFlagUrl, getFlagHtml, resolveFlagPath } from './flag-resolver.js';
export { buildCacheKey } from './cache-utils.js';
export {
  extractTimers,
  computeDisplayMode,
  extractDecisionState,
  extractTimerAndDecisionState
} from './timer-decision-helpers.js';
export { extractRecordsFromUpdate } from './records-extractor.js';
```

4. `src/scoring/index.js`

```js
export { CalculateSinclair2024, CalculateSinclair2020, getMastersAgeFactor } from './sinclair-coefficients.js';
export { CalculateQPoints } from './qpoints-coefficients.js';
export { computeGamx, Variant } from './gamx2.js';
export { calculateTeamPoints } from './team-points-formula.js';
```

### Step 5 — Remove tracker-only coupling (make behavior optional)

The extracted WebSocket server must not import tracker-only modules (example: `scoreboard-registry.js`).

Instead:

- remove all tracker-only imports
- provide hook points via callbacks (as documented in [API_REFERENCE.md](./API_REFERENCE.md)):
  - `onConnect`, `onDisconnect`, `onMessage`, `onError`

If “first connection resets” are needed:

- either keep it as consumer behavior (preferred), implemented by tracker in `onConnect`, OR
- only keep a generic internal flag if it does not introduce tracker coupling.

### Step 6 — Preserve hub ↔ websocket cooperation for resource requests

Ensure the “resource request / preconditions” mechanism continues to work entirely inside the package:

- `competitionHub.requestPluginPreconditions([...])` can trigger an internal `requestResources([...])`
- `requestResources` can send a 428-style response over the active OWLCMS WebSocket connection

Typical implementation requirement:

- the WebSocket integration stores the active connection reference
- the hub can call an internal `requestResources` function (direct or injected)

### Step 6.1 — Add configurable local files output directory (required)

OWLCMS sends ZIP resources that must be written to disk (flags/logos/pictures/styles). The core must support configuring the base directory so deployments can write to durable storage.

Requirements:

- The WebSocket integration APIs accept `localFilesDir` (string, filesystem path).
- If omitted, default to `path.join(process.cwd(), 'local')`.
- ZIP extraction writes to subfolders under `localFilesDir`:
  - `flags_zip` → `${localFilesDir}/flags`
  - `logos_zip` → `${localFilesDir}/logos`
  - `pictures_zip` → `${localFilesDir}/pictures`
  - `styles` → `${localFilesDir}/styles`

Document this option in [API_REFERENCE.md](./API_REFERENCE.md) and keep it consistent with implementation.

### Step 7 — Define package entrypoints (`package.json` exports)

To support the imports in [API_REFERENCE.md](./API_REFERENCE.md), define subpath exports similar to:

```json
{
  "name": "@owlcms/tracker-core",
  "type": "module",
  "exports": {
    ".": "./dist/index.js",
    "./websocket": "./dist/websocket/index.js",
    "./utils": "./dist/utils/index.js",
    "./scoring": "./dist/scoring/index.js"
  }
}
```

If you do not build to `dist/`, point exports at `src/` (acceptable for local linking), but published packages generally prefer `dist/`.

---

## Validation checklist (must pass)

1. These imports resolve in a minimal Node script:

- `import { competitionHub } from '@owlcms/tracker-core'`
- `import { attachWebSocketToServer } from '@owlcms/tracker-core/websocket'`
- `import { getFlagUrl } from '@owlcms/tracker-core/utils'`
- `import { CalculateSinclair2024 } from '@owlcms/tracker-core/scoring'`

2. Both WebSocket integration modes exist and match [API_REFERENCE.md](./API_REFERENCE.md#websocket-server-integration), especially attach/inject.

3. Resource requests/preconditions still function end-to-end via the active WebSocket connection.
