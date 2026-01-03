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

## Directory Structure

```
src/
├── lib/server/
│   ├── competition-hub.js          # Stores per-FOP data from OWLCMS
│   └── scoreboard-registry.js      # Auto-discovers scoreboard plugins
├── routes/
│   ├── [scoreboard]/
│   │   ├── +page.server.js         # Dynamic route handler
│   │   └── +page.svelte            # Generic scoreboard wrapper
│   └── api/scoreboard/
│       └── +server.js              # Unified API endpoint
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
  - **Caching:** Must implement a local cache (Map) keyed by FOP version and options to avoid recomputing on every request.
  - **Transformation:** Sorts, filters, and formats data for display.

### 3. `page.svelte` (Presentation)
A "dumb" view component that renders the data provided by the helper.
- **Principle:** Pure presentation only. No logic, no calculations.
- **Responsibilities:**
  - Receive `data` prop.
  - Render HTML/CSS based on the pre-computed data.
  - Handle client-side timer countdowns (visual only).
  - **No Translations:** Should not perform translation lookups; display provided strings directly.


