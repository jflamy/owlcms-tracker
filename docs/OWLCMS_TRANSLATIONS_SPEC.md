# Tracker Implementation — Hub, Libraries, Plugins, and Data Flow

This document explains the actual architecture and implementation: what data the hub stores, how support libraries work, how plugins access data, and how displayInfo is structured.

## Competition Hub (`src/lib/server/competition-hub.js`)

The hub is the central state store for all competition data. It receives WebSocket messages from OWLCMS and stores data in memory for plugins and browsers to access.

### Hub Properties

```javascript
{
  // Raw data from OWLCMS WebSocket messages
  databaseState: { ... },           // Full database payload from type="database"
  fopUpdates: {
    "Platform_A": { ... },          // Current FOP state from type="update"
    "Platform_B": { ... },
    ...
  },
  
  // Cached translations (merged per-locale)
  translations: {
    "en": { "Start": "Start", ... },
    "fr": { "Start": "Commencer", ... },
    "fr-CA": { /* merged with "fr" */ },
    ...
  },
  
  // Flags, pictures, styles (loaded from binary ZIP frames)
  flags: { /* country code → image data */ },
  pictures: { /* athlete ID → image data */ },
  styles: { /* loaded CSS/assets */ },
  
  // Metadata
  lastUpdate: timestamp,
  databaseChecksum: "...",
  lastTranslationsChecksum: "...",
  learningMode: boolean
}
```

### Key Hub Methods

```javascript
// Data access
hub.getDatabaseState()                    // Returns full databaseState
hub.getFopUpdate(fopName)                 // Returns current FOP state
hub.getTranslations(locale)               // Returns complete merged translation map
hub.getFlags()                            // Returns flags map
hub.getPictures()                         // Returns pictures map

// Data mutation
hub.setDatabaseState(payload)             // Store database from type="database"
hub.setFopUpdate(fopName, payload)        // Store/merge FOP update from type="update"
hub.setTranslations(locale, map)          // Store and merge translation map
hub.setFlags(map)                         // Store flags
hub.setPictures(map)                      // Store pictures

// Queries
hub.getAvailableFOPs()                    // List of FOP names discovered
hub.getMissingPreconditions()             // Returns ["translations"] if missing
```

## Data from OWLCMS WebSocket

### type="database" — Full Synchronization

Received once (usually on startup or reconnection) containing:

```javascript
{
  "competitionName": "National Championship",
  "fops": ["Platform_A", "Platform_B"],
  "athletes": [
    {
      "startNumber": 1,
      "fullName": "John Doe",
      "teamName": "USA",
      "gender": "M",
      "bodyweight": 75.5,
      "sinclair": 410.2,
      "robi": 330.1,
      "total": 300,
      "snatch": 140,
      "cleanAndJerk": 160,
      "attempts": [
        { "lift": "SNATCH", "declaration": 140, "change": null, "actualLift": 140, ... },
        ...
      ]
    },
    ...
  ],
  "categories": [ ... ],
  "sessions": [ ... ]
}
```

Stored in `hub.databaseState`.

### type="update" — Session/FOP Events

Received frequently when lifting order changes, athletes switch, etc.:

```javascript
{
  "uiEvent": "LiftingOrderUpdated",  // or "SwitchGroup", "GroupDone", etc.
  "fopName": "Platform_A",
  "competitionName": "...",
  
  // Current session data (overrides/augments database)
  "groupAthletes": "[json string]",         // Current session athletes (JSON string!)
  "liftingOrderAthletes": "[json string]",  // Next lifters in order (JSON string!)
  
  // Current lifter info
  "fullName": "John Doe",
  "teamName": "USA",
  "startNumber": 1,
  "weight": 140,
  "attemptNumber": 1,
  
  // Timer state (set by type="timer" messages)
  "athleteTimerEventType": "StartTime",     // "StartTime", "StopTime", "SetTime"
  "athleteMillisRemaining": 60000,
  "timeAllowed": 60000,
  
  // Decision state (set by type="decision" messages)
  "decisionEventType": "FULL_DECISION",     // "FULL_DECISION", "DOWN_SIGNAL", "RESET"
  "d1": true,
  "d2": true,
  "d3": false,
  
  ...
}
```

Stored in `hub.fopUpdates[fopName]`.

**Important:** `groupAthletes` and `liftingOrderAthletes` are **JSON strings**, not objects. They must be parsed:

```javascript
const athletes = JSON.parse(fopUpdate.groupAthletes);
```

### type="translations" — Locale Data

```javascript
{
  "type": "translations",
  "payload": {
    "en": { "Start": "Start", "Stop": "Stop", ... },
    "fr": { "Start": "Commencer", ... },
    "fr-CA": { "Start": "Démarrer", ... },  // Only regional overrides
    ...
  }
}
```

Or as binary ZIP frame containing `translations.json`.

Parsed and merged by hub. Regional variants inherit from base locales.

## How Plugins Access Data

Plugins are server-side request handlers. When a browser requests `/api/scoreboard?type=lifting-order&fop=Platform_A`, the system:

1. Finds the plugin in `src/plugins/lifting-order/`
2. Calls `helpers.data.js` function to fetch and process data
3. Returns processed data to browser

### Plugin Data Access Pattern

**File:** `src/plugins/lifting-order/helpers.data.js`

```javascript
import { competitionHub } from '$lib/server/competition-hub.js';

export function getScoreboardData(fopName = 'A', options = {}) {
  // Access the hub
  const fopUpdate = competitionHub.getFopUpdate(fopName);
  const databaseState = competitionHub.getDatabaseState();
  const translations = competitionHub.getTranslations('en');  // or any locale
  
  // Parse session athletes (JSON string!)
  let currentAthletes = [];
  if (fopUpdate?.groupAthletes) {
    currentAthletes = JSON.parse(fopUpdate.groupAthletes);
  }
  
  // Parse lifting order
  let liftingOrder = [];
  if (fopUpdate?.liftingOrderAthletes) {
    liftingOrder = JSON.parse(fopUpdate.liftingOrderAthletes);
  }
  
  // Extract timer state
  const timerState = {
    state: fopUpdate?.athleteTimerEventType === 'StartTime' ? 'running' : 'stopped',
    timeRemaining: parseInt(fopUpdate?.athleteMillisRemaining || 0),
    duration: parseInt(fopUpdate?.timeAllowed || 60000)
  };
  
  // Process data: filter, sort, group, transform
  const processed = {
    currentLifter: {
      name: fopUpdate?.fullName,
      team: fopUpdate?.teamName,
      weight: fopUpdate?.weight,
      attempt: fopUpdate?.attemptNumber
    },
    liftingOrder: liftingOrder.slice(0, 8),  // Top 8
    timer: timerState,
    competition: {
      name: fopUpdate?.competitionName,
      fop: fopName
    }
  };
  
  return processed;
}
```

### Data Hierarchy

**Use this priority:**

1. **Session athletes first** — `fopUpdate.groupAthletes` (current lifting session)
   - Already filtered to current group/session
   - Contains `classname` field for highlighting (e.g., "current-athlete", "good-lift")
   - Precomputed by OWLCMS

2. **Lifting order** — `fopUpdate.liftingOrderAthletes` (next lifters)
   - Already sorted by OWLCMS
   - Contains precomputed display fields

3. **Database athletes** — `databaseState.athletes` (all athletes)
   - Only use for athletes NOT in current session
   - Raw data from database (requires field transformation)
   - Full history of all competitions/sessions

## Database Structure (`databaseState`)

The database contains complete athlete and competition data:

```javascript
{
  "competitionName": "National Championship 2025",
  "fops": ["Platform_A", "Platform_B", "Platform_C"],
  
  "athletes": [
    {
      "id": 1,
      "startNumber": 1,
      "fullName": "John Doe",
      "teamName": "USA",
      "gender": "M",
      "bodyweight": 75.5,
      "birthDate": "1990-05-15",
      
      // Computed fields (set by OWLCMS)
      "sinclair": 410.2,
      "robi": 330.1,
      "total": 300,
      "snatch": 140,
      "cleanAndJerk": 160,
      "rank": 1,
      
      // Lift history
      "attempts": [
        {
          "lift": "SNATCH",
          "declaration": 140,
          "change": null,
          "actualLift": 140,
          "good": true,
          "liftNo": 1
        },
        ...
      ]
    },
    ...
  ],
  
  "categories": [
    {
      "name": "M73",
      "gender": "M",
      "maxWeight": 73.0,
      ...
    },
    ...
  ],
  
  "sessions": [
    {
      "name": "M73 Snatch",
      "gender": "M",
      "lift": "SNATCH",
      ...
    },
    ...
  ]
}
```

## How displayInfo Works

`displayInfo` is precomputed by OWLCMS and included in `type="update"` messages. It contains display-ready values for each athlete that should be shown on scoreboards.

### displayInfo Structure

Inside `groupAthletes` (parsed from JSON string), each athlete has a `displayInfo` object:

```javascript
{
  "fullName": "John Doe",
  "teamName": "USA",
  "weight": 140,                    // Requested weight for current attempt
  "attemptNumber": 1,
  "total": 300,                     // Running total
  "sinclair": 410.2,                // Sinclair score
  "rank": 1,                        // Current rank in competition
  
  // Lift-specific display fields
  "displayWeight": "140",           // Formatted weight string
  "displayAttempt": "1/3",          // Formatted attempt string
  
  // Highlighting flags (set by OWLCMS based on session state)
  "classname": "current-athlete",   // "current-athlete", "waiting", "good-lift", "no-lift"
  "className": "current-athlete",   // Alternative field name (compatibility)
  
  // Computed by OWLCMS for display
  "bestSnatch": 140,                // Best snatch lift so far
  "bestCleanJerk": 160,             // Best clean & jerk so far
  
  ...
}
```

### How Plugins Use displayInfo

```javascript
// In helpers.data.js
const athletes = JSON.parse(fopUpdate.groupAthletes);

athletes.forEach(athlete => {
  // Display-ready values are pre-computed
  console.log(athlete.displayInfo.fullName);     // "John Doe"
  console.log(athlete.displayInfo.displayWeight); // "140"
  console.log(athlete.classname);                 // "current-athlete"
  
  // Svelte component renders these directly
  // No transformation needed — OWLCMS handles all formatting
});
```

### classname Field

Set by OWLCMS to indicate athlete state:

- `"current-athlete"` — Currently lifting
- `"waiting"` — In queue, waiting to lift
- `"good-lift"` — Just received good lift decision
- `"no-lift"` — Just received no-lift decision
- `"finished"` — Completed their lifts
- Empty string — Other athletes

Used by Svelte components for styling:

```svelte
<div class:current-athlete={athlete.classname === 'current-athlete'}>
  {athlete.displayInfo.fullName}
</div>
```

## Support Libraries

### Sinclair Coefficients (`src/lib/sinclair-coefficients.js`)

Pre-computed Sinclair calculation coefficients per gender/bodyweight:

```javascript
export const sinclair = {
  M: { 81: 1.35, 87: 1.25, ... },  // Coefficients for bodyweights
  F: { 55: 1.40, 59: 1.30, ... }
};
```

Used to compute Sinclair scores from totals.

### Timer Logic (`src/lib/timer-logic.js`)

Client-side countdown timer that doesn't require server communication after initial state:

```javascript
export function createTimer() {
  let timerStartTime = null;
  let timerInitialRemaining = 0;
  
  function updateTimer(timerData) {
    // Calculate elapsed time client-side
    if (timerData.state === 'running') {
      const elapsed = Date.now() - timerStartTime;
      const remaining = Math.max(0, timerInitialRemaining - elapsed);
      const seconds = Math.ceil(remaining / 1000);
      // ... update display
    }
  }
  
  return {
    subscribe: (callback) => { ... },
    syncWithServer: (timerData) => { ... },
    start: (timerData) => { ... }
  };
}
```

### SSE Client (`src/lib/sse-client.js`)

Manages Server-Sent Events connection for real-time updates:

```javascript
// Browser opens SSE connection
/api/client-stream?lang=fr-CA&fop=Platform_A

// Server broadcasts update when new data arrives
// Browser fetches /api/scoreboard?type=lifting-order&fop=Platform_A
// and receives fresh data
```

## Data Flow Summary

```
OWLCMS WebSocket Connection
    ↓
type="database" → hub.databaseState
type="update"   → hub.fopUpdates[fopName]
type="translations" → hub.translations[locale]
    ↓
Browser SSE connection
    ↓
/api/scoreboard?type=lifting-order&fop=A
    ↓
plugin/lifting-order/helpers.data.js
    ↓
Parse JSON strings (groupAthletes, liftingOrderAthletes)
Transform data (filter, sort, compute)
    ↓
Return processed object
    ↓
Browser receives and Svelte component renders
    ↓
Uses displayInfo fields for display (no client-side computation)
Uses classname for conditional styling
```

## Key Implementation Points

1. **JSON Strings**: `groupAthletes` and `liftingOrderAthletes` are JSON strings from OWLCMS, not objects. Always `JSON.parse()` them in plugins.

2. **displayInfo**: OWLCMS precomputes all display values. Use them directly in components — no formatting needed.

3. **classname Highlighting**: Use the `classname` field to conditionally style athletes based on their state (current, good-lift, etc.).

4. **Data Priority**: Session athletes → Lifting order → Database athletes. Don't mix data sources unnecessarily.

5. **Hub is Authoritative**: All data flows through the hub. Plugins get data from the hub, never directly from OWLCMS.

6. **No Business Logic in Browser**: All sorting, filtering, grouping, ranking happens in `helpers.data.js`. Components only display pre-processed data.
