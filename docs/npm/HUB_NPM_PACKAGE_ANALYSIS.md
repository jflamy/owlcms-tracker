# Analysis: Isolating the OWLCMS Tracker Hub into a Separate npm Package

## Scope of this document

This document analyzes what it would mean to extract the **OWLCMS Tracker hub** (the in-memory state cache + event distribution) into a **separate npm package**, including the **WebSocket interaction** layer.

It focuses on two questions:

1. **How to isolate** the hub (package boundaries, dependencies, build/publish strategy, migration path).
2. **How helpers register / get informed** of hub updates (today vs proposed options).

Repository references (current implementation):

- Hub: [src/lib/server/tracker-core.js](../src/lib/server/tracker-core.js)
- OWLCMS WebSocket server: [src/lib/server/websocket-server.js](../src/lib/server/websocket-server.js)
- SSE stream to browsers: [src/routes/api/client-stream/+server.js](../src/routes/api/client-stream/+server.js)
- Scoreboard API (request-driven helper execution): [src/routes/api/scoreboard/+server.js](../src/routes/api/scoreboard/+server.js)
- Plugin registry (Vite `import.meta.glob` discovery): [src/lib/server/scoreboard-registry.js](../src/lib/server/scoreboard-registry.js)

---

## 1) What the “hub” currently is

### 1.1 Responsibilities currently combined in `tracker-core.js`

The current `CompetitionHub` is not just a store; it is a combined module doing:

- **State cache**
  - `databaseState` (full DB from `type=database`)
  - `fopUpdates[fopName]` (latest update/timer/decision merged)
  - `translations` (+ checksum optimizations)
  - readiness flags: `flagsLoaded`, `logosLoaded`, `translationsReady`, etc.

- **Normalization / derivation**
  - “sanitize inbound payload” and normalize V2 ordering arrays
  - derived data: flattened start order / lifting order entries
  - “merge session athletes into database” to keep DB fresh between dumps

- **Event distribution**
  - a custom `subscribe(callback)` that feeds SSE clients
  - `broadcast(message)` with per-(fop,eventType) debouncing

- **Precondition/request orchestration**
  - detects missing `database`, `translations_zip` (and plugin-demanded resources)
  - uses `requestPluginPreconditions()` which dynamically imports the websocket module to send 428 requests

### 1.2 WebSocket interaction currently in `websocket-server.js`

The WebSocket layer currently does:

- Owns the `ws` `WebSocketServer` and the active OWLCMS connection
- Auth (optional `OWLCMS_UPDATEKEY`)
- Protocol checks (`extractAndValidateVersion`)
- Routes frames by message type (`database|update|timer|decision|generic`)
- Handles binary frames (ZIP payloads) via `binary-handler.js`
- Resets hub state on first connection (flush caches and clear hub readiness)
- Implements `requestResources(resources)` (sends 428 back to OWLCMS)

### 1.3 How the browser update loop works today

- Browser establishes SSE: `/api/client-stream`
- That SSE endpoint calls `competitionHub.subscribe(cb)`
- Every hub broadcast event causes the browser to fetch `/api/scoreboard?type=...&fop=...`
- The Scoreboard API calls the plugin helper (purely request-driven)

Key implication: **helpers do not need to be “informed” of updates** to function correctly today, because they are invoked on demand, and they typically key caches off a hub version or hub-derived hash.

---

## 2) What “isolating into an npm package” means

There are two realistic targets:

### Target A (recommended): “Hub + WS adapter” npm package

Create an npm package that provides:

- The hub state machine (`CompetitionHub`)
- The OWLCMS WebSocket handling and routing (but *parameterized* so it doesn’t hard-code SvelteKit or local file storage)

The SvelteKit app keeps:

- SSE route(s) (`/api/client-stream`)
- Scoreboard API route and plugin registry
- Static assets, pages, and Svelte UI

### Target B: “Hub only” package (WS stays app-local)

This is simpler, but you explicitly asked that the **websocket interaction** be included, so Target A is what this document details.

---

## 3) Package boundary proposal

### 3.1 Proposed package layout

Create a new package (name is illustrative):

- `@owlcms/tracker-hub`
  - `hub/core` (CompetitionHub + types)
  - `hub/resources` (resource readiness flags, checksum logic)
  - `ws/server` (WebSocketServer wiring + authentication)
  - `ws/handlers` (update/timer/decision/database/generic)
  - `ws/binary` (binary frame parsing; optionally ZIP extraction hooks)

The SvelteKit app continues to own:

- `scoreboard-registry.js` (Vite compile-time discovery)
- `routes/api/*` endpoints
- plugin helpers, caches, and rendering components

### 3.2 The core design constraint: eliminate current circular dependency

Right now there is a circular dependency:

- `websocket-server.js` imports `competitionHub`
- `tracker-core.js` dynamically imports `websocket-server.js` to call `requestResources()`

In a package, this is manageable but fragile. The cleaner boundary is:

- The hub should NOT import the websocket layer at all.
- Instead, the hub exposes **“needs resources”** events or callbacks.
- The websocket adapter listens to those events and performs the request.

Concrete change:

- Replace `competitionHub.requestPluginPreconditions(missing)` (dynamic import)
- With `hub.emit('hub:needsResources', { types: [...] })` or a configured callback `resourceRequester(types)`.

This makes the package boundary crisp and makes testing easier.

### 3.3 Make file-system writes pluggable

Binary resource handling today likely extracts ZIP contents to `./local/...` and flips `flagsLoaded/logosLoaded/...` on the hub.

In an npm package, hard-coding file paths is undesirable. The adapter should accept callbacks:

- `onFlagsZip(zipBuffer) => Promise<{ ready: true, details... }>`
- `onLogosZip(zipBuffer) => ...`
- `onTranslationsZip(zipBuffer) => { locales, checksum }` (this one can remain “in hub” if it’s purely JSON parsing)

So the hub stays responsible for readiness and state; the host app chooses where assets live.

---

## 4) How to isolate (step-by-step migration strategy)

### 4.1 Minimal-change extraction plan (monorepo-first)

Recommended approach: keep everything in the same git repo initially, using npm workspaces.

1. Create `packages/tracker-hub/`
2. Move/copy hub + ws files into that package
3. Export the public API (see section 5)
4. In the SvelteKit app, replace local imports with package imports
5. Only after stabilization, publish to npm (optional)

Why monorepo-first:

- Avoids “publish before it works” pressure
- Allows you to refactor boundaries without cross-repo churn
- Keeps version alignment with tracker releases

### 4.2 Public API surface you must stabilize

You’ll need to decide what is **public contract** vs internal implementation.

Minimum contract for the hub core:

- `handleOwlcmsMessage(payload, type)`
- `handleFullCompetitionData(payload)`
- `handleTranslations(...)` or `handleTranslationsZip(...)`
- `getDatabaseState()`
- `getFopUpdate(fopName)`
- `getStartOrderEntries(fopName, opts)`
- `getLiftingOrderEntries(fopName, opts)`
- `getAvailableFOPs()`
- `subscribe(cb)` (or a replacement event interface)

Minimum contract for websocket interaction:

- `initWebSocketServer(httpServer)` (Node http server)
- Or a more generic `attachToWsServer(wss)`
- A way to send “428 missing resources” back to OWLCMS

### 4.3 Build output constraints (ESM / SvelteKit)

The tracker is currently ESM-style modules. The package should:

- Publish ESM (`"type": "module"`)
- Provide `exports` map for `core` and `ws` entrypoints
- Avoid relying on Vite-only features (`import.meta.glob`) inside the package

---

## 5) Proposed APIs

### 5.1 Hub core API (package)

Provide one of these patterns:

**Option 1 (recommended): factory + instance**

- `createCompetitionHub(options) => hub`
  - optional configuration: debounce timings, logger, etc.

This avoids relying on `globalThis.__competitionHub` inside the package.

The tracker app can keep HMR persistence by doing:

- `globalThis.__competitionHub ||= createCompetitionHub(...)`

**Option 2: exported singleton**

- `export const competitionHub = new CompetitionHub()`

This is simpler but less reusable for other hosts/tests.

### 5.2 WebSocket adapter API (package)

Goal: keep the WebSocket adapter reusable across environments.

A practical API:

- `createOwlcmsWebSocketServer({ hub, protocol, auth, resources })`
  - returns `{ init(httpServer), requestResources(types), getActiveConnection() }`

Key injection points:

- `hub` (required)
- `auth` (optional): `{ updateKeyEnvName?: 'OWLCMS_UPDATEKEY', validate?: fn }`
- `resources` (callbacks): `{ onBinary(type, buffer), onFlagsZip, onLogosZip, ... }`
- `protocol` (version validation): you can keep the existing logic but export it from package

---

## 6) How helpers register / get informed of updates

You asked specifically: “how would the helpers register to get informed of updates to the hub”. There are three viable models.

### Model 0 (today): helpers do NOT register (pull on request)

Today’s behavior:

- The browser learns “something changed” via SSE.
- The browser then fetches `/api/scoreboard?...`.
- That request invokes the helper; helper reads `hub.getFopUpdate()` and returns computed data.

Cache invalidation is typically achieved by including a hub version or hash in the helper’s cache key.

Pros:

- Very simple
- No long-lived plugin registrations (avoids HMR leaks)
- No concurrency complexity

Cons:

- No opportunity to “precompute” immediately when updates arrive

If the only requirement is “helpers reflect latest hub state”, this model already satisfies it.

### Model 1: hub emits typed events; helpers can subscribe (push)

In the package, formalize events:

- `hub.on('fop:update', ({ fopName, messageType, prevVersion, nextVersion, payload }) => ...)`
- `hub.on('database:ready', ...)`
- `hub.on('translations:ready', ...)`
- `hub.on('resource:ready', { type: 'flags_zip' | ... })`

How helpers use it:

- A plugin module can register a listener at module load time.
- Or, better: the **scoreboard registry** calls an optional plugin hook once.

Example plugin hook shape:

- `export function initPlugin({ hub }) { hub.on('fop:update', ...invalidate cache...) }`

Pros:

- Allows proactive cache invalidation or precomputation
- Gives a clean way to react to “database arrived” etc.

Cons:

- Requires lifecycle management (unsubscribe on HMR/reload)
- Risk of memory leaks if plugin initialization runs multiple times

Mitigation:

- Make the registry own subscriptions and store unsubscribe functions.
- Provide `registry.dispose()` called from websocket “first connection reset” logic.

### Model 2: version counters + optional “watch” helper (hybrid)

Standardize a version API in the hub:

- `hub.getFopStateVersion(fopName)`
- `hub.getDatabaseVersion()`
- `hub.getTranslationsVersion()`

Then helpers simply do:

- `cacheKey = fopName + '-v' + hub.getFopStateVersion(fopName) + ...options`

If you still want a registration mechanism, provide an optional helper hook:

- `hub.watchFop(fopName, cb)` that only emits “version changed” events, not payloads.

This is a good compromise: helpers don’t need to understand event payload structure.

---

## 7) WebSocket interaction inside the package: key decisions

### 7.1 Where does “requestResources” live?

Today:

- Hub triggers `requestResources()` by dynamically importing the websocket module.

In the package:

- The WebSocket adapter should implement `requestResources(types)`.
- The hub should only emit `hub:needsResources` with a list.

This makes the hub reusable even in non-WebSocket environments.

### 7.2 Connection lifetime and “first connection reset”

Today, the websocket server clears hub state on the first connection since server start.

In a package, make this explicit:

- `wsServer.on('connection:ready', ...)` or a boolean option like `resetHubOnFirstConnection: true`.

Also decide whether cache flushing belongs to:

- The tracker app (plugin registry)
- Or a plugin-hook contract in the package

Recommended: keep plugin cache behavior app-local.

### 7.3 Binary resources and storage

If the package includes binary handling, it should not hard-code “extract into local/flags”.

Instead:

- Provide a default in-memory handler (for tests)
- Let the tracker app supply a disk-backed handler

---

## 8) Risks / costs of isolation

- **Public API permanence**: Once published, internal refactors become harder.
- **HMR behavior**: In dev, SvelteKit/Vite can re-import modules; event listener duplication must be managed.
- **Environment coupling**: `ws` and Node streams make this Node-only. That’s fine for this project, but should be explicit.
- **Dependency surface grows**: parsers, binary ZIP handling, and protocol validation add dependencies and upgrade constraints.

---

## 9) Suggested end state (clean separation)

**In `@owlcms/tracker-hub`:**

- `CompetitionHub` core with:
  - state, normalization, versions, events
  - readiness tracking
  - no SvelteKit imports
  - no direct websocket imports

- `OwlcmsWebSocketServer` adapter with:
  - protocol validation
  - authentication
  - routing to hub
  - binary frame parsing with injected storage callbacks

**In `owlcms-tracker` app:**

- SSE endpoint uses hub’s subscription/event interface
- Scoreboard API invokes helpers as today
- Plugin registry (Vite glob) stays local
- Plugins may optionally register via registry-provided `initPlugin({ hub })`

---

## 10) Recommendation

If the goal is “make the hub reusable in other projects”, extract **hub core + ws adapter** into a package, but keep:

- plugin discovery (Vite glob)
- UI routes
- disk layout and extraction specifics

…in the app.

For “helpers get informed of updates”, prefer **Model 0 or Model 2** unless you have a concrete need for proactive recomputation. If you do need push notifications, implement **Model 1** but make the **registry** own subscription lifecycle to avoid dev/HMR listener leaks.
