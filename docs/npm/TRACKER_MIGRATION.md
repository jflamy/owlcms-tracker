# Tracker Migration (owlcms-tracker) — LLM Action Prompt

Use this prompt to migrate the **owlcms-tracker** repo to the extracted core package.

**Target state:** tracker consumes the core package as the single source of truth.

- **Core package:** `@owlcms/tracker-core`
- **Core repo:** `owlcms/tracker-core` (separate)
- **Core API contract:** [API_REFERENCE.md](./API_REFERENCE.md)

---

## Role

You are an automated coding agent working in the **owlcms-tracker** repository.

---

## Goals (must achieve all)

1. Stop using the embedded hub/WebSocket implementation under `src/lib/server/*` as the source of truth.
2. Use `@owlcms/tracker-core` as the single source of truth for:
   - hub state (`competitionHub`)
   - WebSocket ingestion utilities
   - shared utilities (flags, scoring, cache helpers, timer/decision helpers)
3. Preserve tracker behavior by keeping tracker-only logic in tracker.
4. Avoid breaking existing plugin imports if possible (use shims).

---

## Constraints (follow strictly)

- Prefer **repo checkout + `npm link`** for team development (avoid GitHub Packages auth during development).
- GitHub Packages auth is only for **installing published packages** (CI/production).
- Ensure there is only **one** hub singleton in use at runtime: either direct package imports everywhere, or tracker shims that re-export the package everywhere.
- Do not invent new APIs in core; follow [API_REFERENCE.md](./API_REFERENCE.md).

---

## Work plan (execute in order)

### Step 1 — Dependency setup

1. Update `owlcms-tracker/package.json` to depend on core:
   - add `"@owlcms/tracker-core": "^<version>"`

2. Document preferred local dev setup (repo checkout + link):
   - Use the canonical steps in [DEVELOPER_USAGE.md](./DEVELOPER_USAGE.md).

3. (Optional, only if installing published packages) Document GitHub Packages auth:
   - `.npmrc` entries:
     - `@owlcms:registry=https://npm.pkg.github.com`
     - `//npm.pkg.github.com/:_authToken=<PAT>`
   - Never commit tokens.

### Step 2 — Switch hub imports (use a shim to minimize churn)

Goal: existing tracker code (routes/plugins) can keep importing from `$lib/server/...` while the implementation comes from the package.

1. Keep this file in tracker: `src/lib/server/competition-hub.js`
2. Replace its contents with a re-export:

```js
export { competitionHub } from '@owlcms/tracker-core';
```

3. Ensure no other tracker module creates or exports a different hub singleton.

### Step 3 — Switch shared utilities (prefer shims)

Create/convert tracker-local modules to re-export package modules so existing imports keep working.

For each commonly imported helper, change the tracker file to a re-export from the package:

- `src/lib/server/flag-resolver.js` → `@owlcms/tracker-core/utils`
- `src/lib/server/cache-utils.js` → `@owlcms/tracker-core/utils`
- `src/lib/server/timer-decision-helpers.js` → `@owlcms/tracker-core/utils`
- scoring modules → `@owlcms/tracker-core/scoring`

If an existing tracker helper contains tracker-specific behavior, do not move it into core. Keep it as a wrapper that imports from the package and adds tracker-only logic.

### Step 4 — WebSocket integration: switch to core integration API

Tracker must use the core WebSocket integration API:

- Standalone: `createWebSocketServer({ port, path, hub })`
- Inject/attach: `attachWebSocketToServer({ server, path, hub })` (**preferred**)

Use imports per the API reference:

```js
import { competitionHub } from '@owlcms/tracker-core';
import { attachWebSocketToServer } from '@owlcms/tracker-core/websocket';
```

Also ensure the tracker sets where OWLCMS-delivered ZIP resources are written:

- Pass `localFilesDir` when starting the WebSocket integration.
- Pass `localUrlPrefix` when starting the WebSocket integration (default: `/local`).
- Update tracker’s `<localUrlPrefix>/*` serving logic (production hook or Express static) to read files from the same directory.

This is required so deployments can place flags/logos/pictures/styles on durable storage (not tied to `process.cwd()`).

It also ensures scoreboards and downstream consumers can change the URL base (not hard-coded `/local`).

Tracker-specific behavior stays in tracker:

- keep tracker-only resets/cache flushes in tracker startup code
- if you need “first connection only” behavior:
  - maintain a `firstConnectionHandled` boolean in tracker
  - do tracker resets inside `onConnect` only when `firstConnectionHandled === false`

### Step 5 — Decommission embedded core source files

Once shims are in place and tracker is using the package:

- Stop importing embedded implementations as sources of truth.
- Either delete or leave them unused temporarily.

Minimum expected outcomes:

- `src/lib/server/competition-hub.js` is a shim (package-backed).
- `src/lib/server/websocket-server.js` is either a shim/wrapper around core integration, or no longer used.
- Any protocol/parser/binary modules that belong to core are no longer used directly by tracker.

---

## Validation checklist (must pass)

1. Tracker starts and accepts OWLCMS WebSocket connections.
2. `/api/status` (and other hub-backed routes) still function.
3. At least one scoreboard plugin that uses `competitionHub.getFopUpdate()` still renders.
4. Resource requests (flags/logos/translations preconditions) still work end-to-end.

**If something fails:** the most common cause is mixing old local modules with package modules (two different singletons). Fix by enforcing one approach:

- either import only from the package everywhere, or
- use tracker shims that consistently re-export the package everywhere.
