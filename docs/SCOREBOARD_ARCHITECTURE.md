<!-- markdownlint-disable -->
# Scoreboard Architecture - Multi-FOP, Multi-Scoreboard System

## System Architecture Overview

```mermaid
graph TD
    OWLCMS([OWLCMS Java Backend])

    subgraph Client[Client]
        Browser[Browser Display page.svelte]
    end

    subgraph Core[Tracker Core Package]
        WSS[WebSocket Server]
        Hub[Competition Hub]
    end

    subgraph Tracker[OWLCMS Tracker]
        Broker[SSE Broker]
        subgraph Plugin[Scoreboard Plugin]
            Helpers[Plugin Helpers helpers.data.js]
            Cacheot [Plugin Cache]
            API[API Endpoint /api/scoreboard]
        end
    end

    OWLCMS -- Competition Data via WebSocket --> WSS
    WSS --> Hub
    Helpers -. Fetches database and session data .-> Hub
    Hub -- Events --> Broker
    Hub ~~~ Helpers
    Helpers -- Stores/Retrieves --> Cache
    API -. Fetches (cached) formatted data .-> Helpers
    Helpers ~~~ API
    Browser -- Fetches data --> API
    Broker -. SSE Push notification .-> Browser
```

## Overview

This system targts **15+ different scoreboard types** with **up to 6 simultaneous FOPs** for each scoreboard type. 

**OWLCMS Integration:**
- OWLCMS sends data via WebSocket connection to `ws://localhost:8096/ws`
- **No changes needed to OWLCMS** - just configure the WebSocket URL once
- Competition Hub stores per-FOP data from WebSocket messages
- Scoreboards pull processed data via `/api/scoreboard?type=...&fop=...`

> **Terminology update:** The OWLCMS update payload now exposes the ordered session list as `startOrderAthletes` (formerly `groupAthletes`). Existing references to `groupAthletes` in this document describe the same structure.

**Key Design Principles:**
1. **Modular** - Each scoreboard type is self-contained in its folder
2. **Server-side processing** - Process data once, serve hundreds of browsers
3. **Plugin-level caching** - Each scoreboard caches processed results
4. **URL-based configuration** - FOP selection and options via query parameters
5. **AI-assisted development** - Easy for novices to create/modify scoreboards
6. **No OWLCMS changes required** - Works with existing data flow
7. **Session Athletes First, Always** - Use `groupAthletes` from WebSocket type="update" as primary data source; only access `databaseState` for athletes NOT in current session

## Data Source Priority

**Key principle:** Always use session athletes data first (from WebSocket type="update", stored in the `groupAthletes` key). Only access Database Athletes (from WebSocket type="database") for athletes NOT in the current session (e.g., athletes from previous sessions, different teams).

## Architecture

### High-Level Data Flow with Caching

```
Tracker Core (Competition Hub)
      → Emits 'update' event (lifting order changes, athlete switches)
         ↓
    SSE Broker (owlcms-tracker)
         ↓
         ↓ Broadcasts SSE on state changes
         ↓
Browser 1: Receives SSE → Fetches /api/scoreboard?type=team-scoreboard&fop=A
           ↓
    Plugin helpers.data.js (cache miss)
           ↓ Compute team grouping, sorting, filtering (50ms)
           ↓ Store in plugin cache
           ↓
    Return processed data to Browser 1
    
Browser 2-200: Receive same SSE → Fetch same /api/scoreboard URL
           ↓
    Plugin helpers.data.js (cache hit!)
           ↓ Return cached data (1ms each)
           ↓
    Return processed data to Browsers 2-200

Timer Event: Tracker Core emits 'timer' event (StartTime)
           ↓
    SSE Broker broadcasts SSE
           ↓
    All browsers fetch /api/scoreboard
           ↓
    Plugin cache HIT (data hash unchanged)
           ↓ Return cached data + updated timer state
           ↓
    Browsers update timer display only (no recomputation)
```

**Benefits:**
- ✅ **Performance improvement** - Cache eliminates redundant processing
- ✅ **Timer efficiency** - Timer events don't trigger recomputation
- ✅ **Plugin-specific rules** - Each scoreboard implements custom caching
- ✅ **Scalable to hundreds of browsers** - First browser computes, rest hit cache

### Competition Hub State Stores

The **Competition Hub** (part of `tracker-core`) maintains the state of the competition. For details on how it stores `databaseState` and `fopUpdates`, see **[CORE_ARCHITECTURE.md](../../../tracker-core/docs/CORE_ARCHITECTURE.md)**.

### Update Event Flow (Standard Path)

1. **Tracker Core emits 'update' event**
   - The `Competition Hub` receives a message from OWLCMS, updates its state, and emits an event.
   - The `SSE Broker` in `owlcms-tracker` listens for this event.

2. **SSE Broker broadcasts message**
   - Simple notification: "FOP Platform_A has new data"
   - No payload - just a trigger

3. **All connected browsers receive SSE**
   - Triggers API fetch: `/api/scoreboard?type=lifting-order&fop=Platform_A`
   - Receives complete processed data for display

4. **Scoreboard updates immediately**
   - New lifting order rendered
   - Current athlete highlighted
   - Attempt numbers updated

**Benefits:**
- ✅ **OWLCMS does all business logic** (rankings, sinclair, totals)
- ✅ **Hub processes once** → Hundreds of browsers fetch same result
- ✅ **SSE is lightweight** → Only triggers, no large payloads
- ✅ **Browsers always get fresh data** → No stale cache issues

### Timer Event Flow (Efficient Caching)

Timer events are **optimized for cache efficiency** because they don't change athlete data.

1. **Tracker Core emits 'timer' event**
   - The `Competition Hub` updates the timer state in `fopUpdates[fopName]`.
   - **Important:** Does NOT change `groupAthletes` or `liftingOrderAthletes`.
   - The `SSE Broker` broadcasts message: "FOP Platform_A has new data".

2. **All connected browsers receive SSE**
   - Triggers API fetch: `/api/scoreboard?type=lifting-order&fop=Platform_A`
   - **First browser:** Checks cache using data hash
     - Data hash based on `groupAthletes` JSON (first 100 chars)
     - Hash is **unchanged** because athletes didn't change
     - **Cache HIT** - Returns cached processed data
     - Updates timer state from current `fopUpdate`
     - Processing time: ~1ms (no recomputation)
   - **Remaining 199 browsers:** Same cache hit
     - All fetch same processed data from cache
     - Total processing: 200 × 1ms = 200ms

3. **Browsers update display**
   - Receive processed data with updated timer state
   - Client-side countdown begins (autonomous)
   - No further server communication for 60 seconds
   - Timer ticks locally using `Date.now() - startTime`

**Cache Behavior:**

```javascript
// Plugin cache key does NOT include timer state
const dataHash = fopUpdate?.groupAthletes?.substring(0, 100) || '';
const cacheKey = `${fopName}-${dataHash}-${gender}-${topN}`;
// Timer state changes → Same cache key → Cache HIT ✅

// Extract timer separately (changes frequently)
function extractTimerState(fopUpdate) {
  return {
    state: fopUpdate?.athleteTimerEventType === 'StartTime' ? 'running' : 'stopped',
    timeRemaining: parseInt(fopUpdate?.athleteMillisRemaining || 0),
    duration: parseInt(fopUpdate?.timeAllowed || 60000)
  };
}

// Return cached data + fresh timer state
return {
  ...cachedProcessedData,  // From cache (team groupings, sorting, etc.)
  timer: extractTimerState(fopUpdate)  // Fresh from current update
};
```

**Performance Impact:**

| Event Type | First Browser | Next 199 Browsers | Cache Behavior |
|------------|---------------|-------------------|----------------|
| **Timer StartTime** | 1ms (cache hit) | 1ms each | No recomputation - athletes unchanged |
| **Athlete lifts** | 50ms (cache miss) | 1ms each | Recomputes once - new `groupAthletes` |
| **Weight change** | 50ms (cache miss) | 1ms each | Recomputes once - new `liftingOrderAthletes` |

**Benefits:**
- ✅ **Zero recomputation on timer events** - Cache stays valid
- ✅ **Scalable to hundreds of browsers** - All hit same cache
- ✅ **Client-side countdown** - No server load during 60-second timer
- ✅ **Fresh timer state** - Extracted separately from cached data
- ✅ **40× faster** than recomputing for every browser

**See also:** [Implementation Details → Timer Event Flow](#timer-event-flow-client-side-countdown) for client-side countdown implementation.

### Decision Event Flow

Decision events follow the **same efficient caching pattern as timer events** because the decision itself doesn't change athlete data immediately.

**Two-Phase Processing:**

**Phase 1: Decision Event (Immediate Display)**

1. **Tracker Core emits 'decision' event**
   - The `Competition Hub` updates the decision state in `fopUpdates[fopName]`.
   - **Important:** Does NOT change `groupAthletes` or `liftingOrderAthletes` yet.
   - The `SSE Broker` broadcasts message: "FOP Platform_A has new data".

2. **All connected browsers receive SSE**
   - Triggers API fetch: `/api/scoreboard?type=lifting-order&fop=Platform_A`
   - **Cache HIT** - Athletes unchanged, returns cached processed data
   - Decision state extracted separately from current `fopUpdate`
   - Processing time: ~1ms per browser (no recomputation)

3. **Browsers display decision immediately**
   - Show decision lights/indicators
   - Visual feedback to audience
   - Athlete data remains unchanged (for now)

**Phase 2: Update Event (Recomputed Rankings)**

4. **OWLCMS recomputes** lifting order and rankings based on decision
   - Generates new `groupAthletes` with updated totals
   - Generates new `liftingOrderAthletes` with new order
   - Sends type="update" message (follows Standard Path)

5. **Tracker Core emits 'update' event**
   - New `groupAthletes` JSON → New data hash
   - **Cache MISS** - Data changed, must recompute

6. **Browsers fetch updated data**
   - First browser computes new team groupings, sorting (50ms)
   - Remaining browsers hit fresh cache (1ms each)
   - Display updated lifting order, totals, ranks

**Cache Behavior:**

```javascript
// Decision state extracted separately (like timer)
function extractDecisionState(fopUpdate) {
  return {
    type: fopUpdate?.decisionEventType || null,
    timestamp: fopUpdate?.decisionTimestamp || null,
    refereeDecisions: fopUpdate?.refereeDecisions || [],
    display: fopUpdate?.decisionEventType ? 'show' : 'hide'
  };
}

// Phase 1: Decision event → Cache HIT
const dataHash = fopUpdate?.groupAthletes?.substring(0, 100) || '';
const cacheKey = `${fopName}-${dataHash}-${options}`;
// Decision state changes, athletes unchanged → Same hash → Cache HIT ✅

return {
  ...cachedProcessedData,  // From cache (unchanged athletes)
  decision: extractDecisionState(fopUpdate),  // Fresh decision
  timer: extractTimerState(fopUpdate)  // Fresh timer
};

// Phase 2: Update event → Cache MISS
// New groupAthletes → New hash → Cache MISS → Recompute ✅
```

**Timeline Example:**

```
T=0s:   OWLCMS sends DECISION (GOOD_LIFT)
        → Hub broadcasts SSE
        → 200 browsers fetch /api/scoreboard
        → All hit cache (1ms each, 200ms total)
        → Display decision lights immediately

T=1s:   OWLCMS recomputes rankings
        → Sends UPDATE with new groupAthletes
        → Hub broadcasts SSE
        → First browser recomputes (50ms)
        → Remaining 199 browsers hit fresh cache (199ms)
        → Display updated lifting order, totals
```

**Benefits:**
- ✅ **Instant decision feedback** - Cache hit for immediate display
- ✅ **Deferred ranking update** - Only recomputtes when OWLCMS sends new data
- ✅ **Two-phase processing** - Visual feedback first, data update second
- ✅ **Scalable** - Same cache efficiency as timer events
- ✅ **No redundant computation** - Decision doesn't trigger unnecessary work

**Implementation Status:** 🚧 Not yet implemented - design documented for future development.

### Cache Management & Manual Refresh

**Cache Registry Pattern**

All plugin caches register themselves at module load time to enable coordinated cache invalidation:

```javascript
// src/lib/server/cache-epoch.js
let cacheEpoch = 0;
const registeredCaches = new Set();

export function registerCache(cacheMap) {
  registeredCaches.add(cacheMap);
}

export function bumpCacheEpoch() {
  cacheEpoch += 1;
  for (const cache of registeredCaches) {
    cache.clear();  // Clear all registered caches
  }
  return cacheEpoch;
}
```

**Plugin Cache Registration**

Each plugin registers its cache on module load:

```javascript
// src/plugins/team-scoreboard/helpers.data.js
import { registerCache } from '$lib/server/cache-utils.js';

const teamScoreboardCache = new Map();
registerCache(teamScoreboardCache);  // Auto-cleared on refresh
```

**Registered Caches (8 total):**
1. `standard-scoreboard-helpers.js` → `scoreboardCache` (shared by lifting-order, rankings, session-results)
2. `team-scoreboard/helpers.data.js` → `teamScoreboardCache`
3. `attempt-bar/helpers.data.js` → `attemptBarCache`
4. `lower-third/helpers.data.js` → `lowerThirdCache`
5. `ranking-box/helpers.data.js` → `rankingBoxCache`
6. `referee-assignments/helpers.data.js` → `refereeAssignmentsCache`
7. `iwf-startbook/helpers.data.js` → `protocolCache`
8. `iwf-results/helpers.data.js` → `protocolCache`

**Manual Refresh Endpoint**

Developers can manually flush all caches via REST API:

```bash
# Flush plugin caches only (keeps hub data)
curl -X POST http://localhost:8096/api/refresh

# Full refresh: close WebSocket, force OWLCMS to reconnect and resend all data
curl -X POST http://localhost:8096/api/refresh?fullRefresh=true
```

**Refresh Flow:**

1. **POST `/api/refresh`** → `scoreboardRegistry.flushCaches()`
2. **Bump epoch** → Clear all registered caches (prevents memory leaks)
3. **Emit SSE events** → Notify all connected browsers for each FOP
4. **Browsers receive SSE** → Re-fetch scoreboard data via `/api/scoreboard`
5. **First browser** → Cache miss, recomputes from hub data (50ms)
6. **Remaining browsers** → Cache hit, instant response (1ms each)

**Response Example:**

```json
{
  "success": true,
  "message": "Plugin caches flushed - browsers notified to re-fetch",
  "fullRefresh": false,
  "connectionClosed": false,
  "cacheEpoch": 42,
  "browsersNotified": 4,
  "timestamp": 1735862400000
}
```

**Benefits:**
- ✅ **No memory leaks** - Caches are cleared directly, no orphaned entries
- ✅ **Automatic browser updates** - SSE triggers immediate re-fetch
- ✅ **Development workflow** - Test plugin changes without restarting server
- ✅ **Coordinated invalidation** - All plugins cleared atomically
- ✅ **Observable** - Response includes epoch and notification count

---

## Directory Structure

```
src/
├── lib/server/
│   ├── competition-hub.js          # Stores per-FOP data from OWLCMS
│   ├── scoreboard-registry.js      # Auto-discovers scoreboard plugins
│   ├── cache-epoch.js              # Global cache epoch and registry
│   └── cache-utils.js              # Shim for buildCacheKey + registerCache
├── routes/
│   ├── [scoreboard]/
│   │   ├── +page.server.js         # Dynamic route handler
│   │   └── +page.svelte            # Generic scoreboard wrapper
│   └── api/
│       ├── scoreboard/+server.js   # Unified API endpoint
│       └── refresh/+server.js      # Manual cache flush endpoint
└── plugins/
    ├── lifting-order/   # Scoreboard type 1
    │   ├── config.js               # Metadata, options
    │   ├── helpers.data.js         # Server-side data processing
    │   ├── page.svelte             # Display component
    │   └── README.md               # AI prompts
    ├── results/         # Scoreboard type 2
    │   └── ...
    └── team-rankings/   # Scoreboard type 3
        └── ...
```

## Plugin Structure & Principles

Each scoreboard plugin is a self-contained unit in `src/plugins/<plugin-name>/` consisting of three key files.

### 1. `config.js` (Metadata)
Defines the plugin's identity and configurable options.
- **Purpose:** Used by the registry to discover plugins and validate URL parameters.
- **Content:** Name, description, and an array of option definitions (type, default value, label).

### 2. `helpers.data.js` (Business Logic & Data)
The **only** place where data processing occurs.
- **Principle:** Fetches data from `tracker-core`, processes it, and caches the result.
- **Responsibilities:**
  - Import `competitionHub` from `@owlcms/tracker-core`.
  - Fetch raw data: 
    - `competitionHub.getFopUpdate(fop)` for basic session state.
    - `competitionHub.getDatabaseState()` for full competition data (athletes, teams, records).
    - `competitionHub.getSessionAthletes(fop)` for flattened session athlete list.
  - **Translation:** All translation keys must be resolved here using `competitionHub.getTranslations()`. The Svelte component receives already-translated strings.
  - **Caching:** Must implement a local cache (Map) keyed by FOP version and options to avoid recomputing on every request. **Register the cache** using `registerCache()` from `$lib/server/cache-utils.js` so it gets cleared on manual refresh.
  - **Transformation:** Sorts, filters, and formats data for display.

**Example cache registration:**

```javascript
import { buildCacheKey, registerCache } from '$lib/server/cache-utils.js';

const myPluginCache = new Map();
registerCache(myPluginCache);  // Auto-cleared on /api/refresh
```

### 3. `page.svelte` (Presentation)
A "dumb" view component that renders the data provided by the helper.
- **Principle:** Pure presentation only. No logic, no calculations.
- **Responsibilities:**
  - Receive `data` prop.
  - Render HTML/CSS based on the pre-computed data.
  - Handle client-side timer countdowns (visual only).
  - **No Translations:** Should not perform translation lookups; display provided strings directly.

---

## API Endpoints

The tracker exposes several REST and streaming endpoints for different purposes.

### Browser-Consumed Endpoints

#### `/api/scoreboard` (GET)
**Purpose:** Primary data endpoint for all scoreboard types

**Parameters:**
- `type` (string, required) - Scoreboard type (e.g., `lifting-order`, `team-scoreboard`, `results`)
- `fop` (string, required*) - FOP name (e.g., `Platform_A`, `A`, `B`)
  - *Not required for global scoreboards like `iwf-startbook` or `referee-assignments`
- Additional parameters vary by scoreboard (e.g., `showRecords=true`, `gender=F`, `topN=10`)

**Example:**
```bash
GET /api/scoreboard?type=lifting-order&fop=Platform_A&showRecords=true
```

**Response:**
```json
{
  "success": true,
  "type": "lifting-order",
  "fop": "Platform_A",
  "options": { "showRecords": true },
  "data": {
    "competition": { "name": "2025 Nationals", "fop": "Platform_A" },
    "athletes": [...],
    "timer": { "state": "running", "timeRemaining": 45000 },
    "decision": { "type": null },
    "records": [...]
  },
  "timestamp": 1735862400000
}
```

**Usage Flow:**
1. Browser loads scoreboard page (`/lifting-order?fop=A`)
2. Browser fetches initial data via `/api/scoreboard?type=lifting-order&fop=A`
3. Browser subscribes to SSE for real-time updates
4. On each SSE event, browser re-fetches `/api/scoreboard` for fresh data

---

#### `/api/client-stream` (GET)
**Purpose:** Server-Sent Events (SSE) endpoint for real-time push notifications

**Parameters:**
- `lang` (string, optional) - Language preference (e.g., `en`, `fr`, `es`). Default: `en`

**Example:**
```bash
GET /api/client-stream?lang=fr
```

**Event Types:**
- `fop_update` - FOP data changed (lifting order, athlete switch, weight change)
- `competition_initialized` - Database loaded from OWLCMS
- `hub_ready` - Hub fully initialized (database + translations)
- `waiting` - No competition data available yet
- `translations` - Translation data for requested language

**Event Format:**
```
data: {"type":"fop_update","fop":"Platform_A","data":{...},"timestamp":1735862400000}

data: {"type":"timer","fop":"Platform_A","timestamp":1735862400000}

data: {"type":"decision","fop":"Platform_A","timestamp":1735862400000}
```

**Browser Usage:**
```javascript
const eventSource = new EventSource('/api/client-stream?lang=en');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'fop_update' && data.fop === currentFop) {
    // Re-fetch scoreboard data
    fetch(`/api/scoreboard?type=lifting-order&fop=${currentFop}`)
      .then(res => res.json())
      .then(result => updateDisplay(result.data));
  }
};
```

---

### Development & Admin Endpoints

#### `/api/refresh` (POST)
**Purpose:** Manually flush plugin caches and notify browsers to re-fetch

**Parameters:**
- `fullRefresh=true` (optional) - Close WebSocket to force OWLCMS reconnection

**Examples:**
```bash
# Flush plugin caches only (keeps hub data)
curl -X POST http://localhost:8096/api/refresh

# Full refresh: close WebSocket, force OWLCMS to reconnect
curl -X POST http://localhost:8096/api/refresh?fullRefresh=true
```

**Response:**
```json
{
  "success": true,
  "message": "Plugin caches flushed - browsers notified to re-fetch",
  "fullRefresh": false,
  "connectionClosed": false,
  "cacheEpoch": 42,
  "browsersNotified": 4,
  "timestamp": 1735862400000
}
```

**Workflow:**
1. Clears all registered plugin caches (8 caches total)
2. Emits SSE events for all FOPs (triggers browser re-fetch)
3. Optionally closes WebSocket (if `fullRefresh=true`)

**Use Cases:**
- Testing plugin changes without server restart
- Forcing fresh data fetch during development
- Debugging cache-related issues

---

#### `/api/health` (GET)
**Purpose:** Health check endpoint for monitoring and orchestration

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-03T14:30:00.000Z",
  "uptime": 3600,
  "memory": {
    "heapUsedMB": 150,
    "heapTotalMB": 200,
    "rssMB": 300,
    "heapUsagePercent": 75
  },
  "competition": {
    "databaseLoaded": true,
    "athleteCount": 50,
    "fopCount": 3,
    "localeCount": 26
  },
  "metrics": {
    "messagesReceived": 1234,
    "messagesBroadcast": 2468
  }
}
```

**Status Values:**
- `healthy` - All systems operational
- `degraded` - Partial functionality (high memory, missing data)
- `unhealthy` - Critical failure

---

#### `/api/status` (GET)
**Purpose:** Simple readiness check (lighter than `/api/health`)

**Response:**
```json
{
  "status": "ready",
  "message": "Competition Hub is ready to receive OWLCMS messages",
  "ready": true,
  "hasCompetitionData": true,
  "metrics": {
    "activeClients": 12,
    "messagesReceived": 1234,
    "messagesBroadcast": 2468
  },
  "timestamp": "2026-01-03T14:30:00.000Z"
}
```

---

### Endpoint Summary

| Endpoint | Method | Purpose | Used By |
|----------|--------|---------|---------|
| `/api/scoreboard` | GET | Fetch processed scoreboard data | Browsers (on load + SSE trigger) |
| `/api/client-stream` | GET | Real-time SSE push notifications | Browsers (persistent connection) |
| `/api/refresh` | POST | Flush caches + notify browsers | Developers, CI/CD |
| `/api/health` | GET | Detailed health metrics | Monitoring systems |
| `/api/status` | GET | Simple readiness check | Healthcheck probes |


