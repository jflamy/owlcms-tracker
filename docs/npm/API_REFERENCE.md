# Tracker Core API Reference

**Package:** `@owlcms/tracker-core`

This document provides a complete reference for all APIs exposed by the Tracker Core package.

---

## Table of Contents

1. [Hub Data Access Methods](#hub-data-access-methods)
   - [Core Data Access](#core-data-access) - 14 methods including athlete getters
   - [Less Common Methods](#less-common-methods) - 3 utility methods
2. [Event System](#event-system)
3. [WebSocket Server Integration](#websocket-server-integration)
4. [Utility Modules](#utility-modules)
5. [Data Structures](#data-structures)

---

## Hub Data Access Methods

The Tracker Core provides methods to access competition state. All methods are available via the hub singleton:

```javascript
import { competitionHub } from '@owlcms/tracker-core';
```

**Quick Reference:**

| Method | Purpose |
|--------|---------|
| `getDatabaseState()` | Full competition data |
| `getFopUpdate(fopName)` | Latest FOP state (includes athlete keys) |
| `getCurrentAthlete(fopName)` | Current lifter (no array scanning) ⭐ |
| `getNextAthlete(fopName)` | Next lifter (no array scanning) ⭐ |
| `getPreviousAthlete(fopName)` | Previous lifter (no array scanning) ⭐ |
| `getSessionAthletes(fopName, opts)` | All session athletes |
| `getStartOrderEntries(fopName, opts)` | Registration order |
| `getLiftingOrderEntries(fopName, opts)` | Lifting queue |
| `getTranslations(locale)` | Localized strings |
| `getSessionStatus(fopName)` | Session complete/active |
| `getTeamNameById(teamId)` | Resolve team names |
| `isReady()` | Hub initialization check |
| `getFopStateVersion(fopName)` | Cache invalidation version |
| `getCategoryToAgeGroupMap()` | Category grouping |

### Core Data Access

#### `getDatabaseState()`

Returns the complete competition database received from OWLCMS.

**Returns:** `Object | null`

```javascript
const db = competitionHub.getDatabaseState();
// {
//   competition: { name, mensTeamSize, womensTeamSize, sinclair, fops },
//   athletes: [...],
//   teams: [...],
//   ageGroups: [...],
//   records: [...],
//   databaseChecksum: "...",
//   initialized: true
// }
```

**Usage:** Use for global competition data, athlete lists, team information.

---

#### `getFopUpdate(fopName)`

Returns the latest update payload for a specific FOP (Field of Play).

**Parameters:**
- `fopName` (string) - FOP identifier (e.g., "Platform A", "A")

**Returns:** `Object | null`

```javascript
const fopData = competitionHub.getFopUpdate('Platform A');
// {
//   competitionName: "2025 Nationals",
//   fopName: "Platform A",
//   currentAthleteKey: "123",       // Direct key - no scanning needed!
//   nextAthleteKey: "124",          // Direct key - no scanning needed!
//   previousAthleteKey: "122",      // Direct key (may not always be present)
//   fullName: "DOE, John",
//   teamName: "USA Weightlifting",
//   sessionAthletes: [...],
//   startOrderAthletes: [...],
//   liftingOrderAthletes: [...],
//   athleteTimerEventType: "StartTime",
//   athleteMillisRemaining: 60000,
//   // ... etc
// }
```

**Direct access to current/next/previous:**
- `fopUpdate.currentAthleteKey` - Key of current lifter (use to find in arrays or call `getCurrentAthlete()`)
- `fopUpdate.nextAthleteKey` - Key of next lifter (use to find in arrays or call `getNextAthlete()`)
- `fopUpdate.previousAthleteKey` - Key of previous lifter (may be undefined, use `getPreviousAthlete()` for fallback)

**Key-based ordering (advanced):**
- `fopUpdate.startOrderKeys` - Array of athlete keys in registration order (includes category spacers as `{isSpacer: true}`)
- `fopUpdate.liftingOrderKeys` - Array of athlete keys in lifting order (includes lift type spacers)

The hub provides two views:
1. **Key arrays** (`startOrderKeys`, `liftingOrderKeys`) - Lightweight references to athletes
2. **Resolved arrays** (`startOrderAthletes`, `liftingOrderAthletes`) - Full athlete objects with display fields

Use `getStartOrderEntries()` / `getLiftingOrderEntries()` to get resolved arrays with optional spacers.

**Usage:** Primary data source for scoreboard plugins, contains precomputed session data.

---

#### `getSessionAthletes(fopName, options)`

Returns flattened array of athletes in current session with display-ready fields.

**Parameters:**
- `fopName` (string) - FOP identifier
- `options` (Object, optional)
  - `includeSpacer` (boolean) - Include category spacer rows (default: false)

**Returns:** `Array<Object>`

```javascript
const athletes = competitionHub.getSessionAthletes('Platform A');
// [
//   {
//     key: "123",
//     fullName: "DOE, John",
//     teamName: "USA Weightlifting",
//     categoryName: "M89 Senior",
//     sattempts: [{value: 100, status: "good"}, ...],
//     cattempts: [{value: 120, status: "current"}, ...],
//     bestSnatch: "100",
//     bestCleanJerk: "120",
//     total: "220",
//     classname: "current blink",
//     flagURL: "/local/flags/USA.svg",
//     ...
//   }
// ]
```

**Usage:** Display athlete lists with all precomputed fields from OWLCMS.

---

#### `getCurrentAthlete(fopName)`

Returns the current athlete on the platform with enriched data (no array scanning needed).

**Parameters:**
- `fopName` (string) - FOP identifier (default: 'A')

**Returns:** `Object | null`

```javascript
const current = competitionHub.getCurrentAthlete('Platform A');
// {
//   key: "123",
//   fullName: "DOE, John",
//   teamName: "USA Weightlifting",
//   categoryName: "M89 Senior",
//   sattempts: [...],
//   cattempts: [{value: 120, status: "current"}, ...],
//   total: "100",
//   sinclair: "285.432",
//   classname: "current blink",
//   currentWeight: 120,
//   currentAttempt: "1/6",
//   currentLiftType: "CLEANJERK",
//   ...
// }
```

**Usage:** Get current lifter without scanning `getSessionAthletes()` array.

---

#### `getNextAthlete(fopName)`

Returns the next athlete in lifting order (no array scanning needed).

**Parameters:**
- `fopName` (string) - FOP identifier (default: 'A')

**Returns:** `Object | null`

```javascript
const next = competitionHub.getNextAthlete('Platform A');
// {
//   key: "124",
//   fullName: "SMITH, Jane",
//   teamName: "CAN Weightlifting",
//   currentWeight: 95,
//   currentAttempt: "2/6",
//   currentLiftType: "SNATCH",
//   ...
// }
```

**Usage:** Display "On Deck" athlete without array scanning.

---

#### `getPreviousAthlete(fopName)`

Returns the previous athlete who lifted (no array scanning needed).

**Parameters:**
- `fopName` (string) - FOP identifier (default: 'A')

**Returns:** `Object | null`

```javascript
const previous = competitionHub.getPreviousAthlete('Platform A');
// {
//   key: "122",
//   fullName: "JONES, Bob",
//   teamName: "GBR Weightlifting",
//   currentWeight: 110,
//   currentAttempt: "3/6",
//   currentLiftType: "SNATCH",
//   ...
// }
```

**Usage:** Display last lifter or replay context without array scanning.

**Note:** All three methods (`getCurrentAthlete`, `getNextAthlete`, `getPreviousAthlete`) return enriched athlete objects with:
- `currentWeight` - The weight being attempted/requested
- `currentAttempt` - Attempt number as formatted string (e.g., "1/6", "4/6")
- `currentLiftType` - "SNATCH" or "CLEANJERK"
- Plus all standard session athlete fields (name, team, attempts, totals, rankings, etc.)

---

#### `getStartOrderEntries(fopName, options)`

Returns athletes in registration/start order (sorted by lot number).

**Parameters:**
- `fopName` (string) - FOP identifier
- `options` (Object, optional)
  - `includeSpacer` (boolean) - Include category spacer rows (default: false)

**Returns:** `Array<Object>`

```javascript
const startOrder = competitionHub.getStartOrderEntries('Platform A', {
  includeSpacer: true
});
// [
//   { fullName: "M89 Senior", isSpacer: true, categoryName: "M89 Senior" },
//   { key: "123", fullName: "DOE, John", ... },
//   { key: "124", fullName: "SMITH, Jane", ... },
//   { fullName: "M96 Senior", isSpacer: true, categoryName: "M96 Senior" },
//   ...
// ]
```

**Usage:** Display registration order with optional category headers.

---

#### `getLiftingOrderEntries(fopName, options)`

Returns athletes in lifting order (sorted by next attempt weight).

**Parameters:**
- `fopName` (string) - FOP identifier
- `options` (Object, optional)
  - `includeSpacer` (boolean) - Include lift type spacer rows (default: false)

**Returns:** `Array<Object>`

```javascript
const liftingOrder = competitionHub.getLiftingOrderEntries('Platform A', {
  includeSpacer: true
});
// [
//   { fullName: "Snatch", isSpacer: true, className: "snatch-spacer" },
//   { key: "123", fullName: "DOE, John", classname: "current blink", ... },
//   { key: "125", fullName: "JONES, Bob", classname: "next", ... },
//   { fullName: "Clean & Jerk", isSpacer: true, className: "cleanjerk-spacer" },
//   ...
// ]
```

**Usage:** Display lifting order with current/next athlete highlighting.

---

#### `getTranslations(locale)`

Returns translation map for specified locale with fallback chain.

**Parameters:**
- `locale` (string) - Locale code (e.g., "en", "fr", "fr-CA")

**Returns:** `Object`

```javascript
const t = competitionHub.getTranslations('fr-CA');
// {
//   "Start": "Démarrer",    // fr-CA override
//   "Stop": "Arrêter",      // Fallback from "fr"
//   "Athlete": "Athlète",
//   ...
// }
```

**Fallback logic:**
- `"fr-CA"` → Merge `"fr"` base + `"fr-CA"` overrides
- `"en-GB"` → Merge `"en"` base + `"en-GB"` overrides
- `"en"` → Base locale, no merge

**Usage:** Localize scoreboard labels and UI text.

---

#### `getSessionStatus(fopName)`

Returns session completion status for a FOP.

**Parameters:**
- `fopName` (string) - FOP identifier

**Returns:** `Object`

```javascript
const status = competitionHub.getSessionStatus('Platform A');
// {
//   isDone: false,
//   sessionName: "Session 1",
//   lastActivity: 1735689600000
// }
```

**Session lifecycle:**
- `isDone: false` - Session in progress
- `isDone: true` - Session completed (received `GroupDone` event)
- **Reopens automatically** when any new event arrives (timer, decision, update)

**Usage:** Show "Session Complete" message or final results.

---

#### `getTeamNameById(teamId)`

Resolves team name from numeric team ID.

**Parameters:**
- `teamId` (number) - Team ID from athlete.team field

**Returns:** `string | null`

```javascript
const teamName = competitionHub.getTeamNameById(12345);
// "USA Weightlifting"
```

**Usage:** Convert athlete's numeric team ID to display name.

---

#### `isReady()`

Checks if hub has received minimum required data (database + translations).

**Returns:** `boolean`

```javascript
if (competitionHub.isReady()) {
  // Safe to process queries
  const athletes = competitionHub.getDatabaseState().athletes;
}
```

**Usage:** Wait for hub initialization before accessing data.

---

#### `getFopStateVersion(fopName)`

Returns version number for FOP state, increments on every relevant message.

**Parameters:**
- `fopName` (string) - FOP identifier

**Returns:** `number`

```javascript
const version = competitionHub.getFopStateVersion('Platform A');
// 42

// Use in cache keys
const cacheKey = `${fopName}-v${version}-${gender}-${topN}`;
```

**Increments on:**
- `type="update"` - Lifting order changes, athlete switches
- `type="timer"` - Timer start/stop/set
- `type="decision"` - Referee decisions
- `type="database"` - Full database reload

**Usage:** Cache invalidation - plugin checks version in cache key to detect stale data.

---

#### `getCategoryToAgeGroupMap()`

Returns map of category codes to age group codes.

**Returns:** `Map<string, string>`

```javascript
const catMap = competitionHub.getCategoryToAgeGroupMap();
catMap.get('SR_M89'); // "SR" (Senior)
catMap.get('YTH_F64'); // "YTH" (Youth)
```

**Usage:** Filter athletes by age group, group categories in results.

---

### Less Common Methods

#### `getAvailableFOPs()`

Returns list of all known FOP names.

**Returns:** `Array<string>`

```javascript
const fops = competitionHub.getAvailableFOPs();
// ["Platform A", "Platform B", "Platform C"]
```

**Usage:** Populate FOP selector dropdowns.

---

#### `getFlagPath(teamName)`

Returns local filesystem path to team flag image (if available).

**Parameters:**
- `teamName` (string) - Team/country name

**Returns:** `string | null`

```javascript
const flagPath = competitionHub.getFlagPath('USA Weightlifting');
// "/local/flags/USA Weightlifting.svg"
```

**Usage:** Display team flags in scoreboards.

---

#### `getLogoPath(teamName)`

Returns local filesystem path to team logo image (if available).

**Parameters:**
- `teamName` (string) - Team/organization name

**Returns:** `string | null`

```javascript
const logoPath = competitionHub.getLogoPath('USA Weightlifting');
// "/local/logos/USA Weightlifting.png"
```

**Usage:** Display team logos in results, credentials, etc.

---

## Event System

The Tracker Core extends `EventEmitter` to broadcast competition events. Subscribe to events for reactive workflows (e.g., video switching, live graphics updates).

### Event Types

```javascript
import { EVENT_TYPES } from '@owlcms/tracker-core';
```

| Event Type | When Emitted | Payload |
|------------|--------------|---------|
| `EVENT_TYPES.DATABASE` | Full database received | `(databaseState)` |
| `EVENT_TYPES.UPDATE` | Lifting order/athlete change | `(fopName, updatePayload)` |
| `EVENT_TYPES.TIMER` | Timer start/stop/set | `(fopName, timerPayload)` |
| `EVENT_TYPES.DECISION` | Referee decision | `(fopName, decisionPayload)` |
| `EVENT_TYPES.FLAGS_LOADED` | Flag images extracted | `(flagCount)` |
| `EVENT_TYPES.LOGOS_LOADED` | Logo images extracted | `(logoCount)` |
| `EVENT_TYPES.TRANSLATIONS_LOADED` | Translations loaded | `(localeCount)` |
| `EVENT_TYPES.DATABASE_READY` | Database initialized | `()` |
| `EVENT_TYPES.HUB_READY` | Hub fully initialized (database + translations) | `()` |
| `EVENT_TYPES.SESSION_DONE` | Session completed | `(fopName, sessionName)` |
| `EVENT_TYPES.SESSION_REOPENED` | Session resumed after completion | `(fopName, sessionName)` |

### Event Subscription

```javascript
import { competitionHub, EVENT_TYPES } from '@owlcms/tracker-core';

// One-time events
competitionHub.once(EVENT_TYPES.HUB_READY, () => {
  console.log('Hub initialized - safe to process queries');
});

// Recurring events
competitionHub.on(EVENT_TYPES.DECISION, (fopName, payload) => {
  console.log(`Decision on ${fopName}: ${payload.decisionEventType}`);
  
  if (payload.decisionEventType === 'FULL_DECISION') {
    const goodCount = [payload.d1, payload.d2, payload.d3]
      .filter(d => d === 'true')
      .length;
    
    const isGoodLift = goodCount >= 2;
    console.log(isGoodLift ? 'Good lift!' : 'No lift');
  }
});

competitionHub.on(EVENT_TYPES.UPDATE, (fopName, payload) => {
  if (payload.uiEvent === 'LiftingOrderUpdated') {
    console.log(`New current athlete: ${payload.fullName}`);
  }
});

competitionHub.on(EVENT_TYPES.TIMER, (fopName, payload) => {
  if (payload.athleteTimerEventType === 'StartTime') {
    console.log(`Timer started: ${payload.athleteMillisRemaining}ms`);
  }
});

competitionHub.on(EVENT_TYPES.SESSION_DONE, (fopName, sessionName) => {
  console.log(`Session "${sessionName}" on ${fopName} is complete`);
});
```

### Event Payload Examples

#### UPDATE Event Payload

```javascript
{
  uiEvent: "LiftingOrderUpdated",
  fopName: "Platform A",
  competitionName: "2025 Nationals",
  currentAthleteKey: "123",
  nextAthleteKey: "124",
  fullName: "DOE, John",
  teamName: "USA Weightlifting",
  attemptNumber: 2,
  weight: 120,
  sessionAthletes: [...],
  startOrderAthletes: [...],
  liftingOrderAthletes: [...]
}
```

#### TIMER Event Payload

```javascript
{
  fopName: "Platform A",
  athleteTimerEventType: "StartTime",  // "StartTime" | "StopTime" | "SetTime"
  athleteMillisRemaining: 60000,
  athleteStartTimeMillis: 1735689600000,
  timeAllowed: 60000,
  breakTimerEventType: null,  // Break timer (if active)
  breakMillisRemaining: 0,
  serverLocalTime: "14:23:45.123"
}
```

#### DECISION Event Payload

```javascript
{
  fopName: "Platform A",
  decisionEventType: "FULL_DECISION",  // "FULL_DECISION" | "DOWN_SIGNAL" | "RESET"
  fullName: "DOE, John",
  attemptNumber: 2,
  d1: "true",   // Referee 1: "true" | "false" | null
  d2: "true",   // Referee 2
  d3: "false",  // Referee 3
  decisionsVisible: "true",
  down: "true"
}
```

---

## WebSocket Server Integration

The hub package includes WebSocket server functionality to receive messages from OWLCMS. Two integration modes are supported:

### Mode 1: Standalone WebSocket Server

Creates its own HTTP server for WebSocket connections.

```javascript
import { competitionHub } from '@owlcms/tracker-core';
import { createWebSocketServer } from '@owlcms/tracker-core/websocket';

createWebSocketServer({
  port: 8095,
  path: '/ws',
  hub: competitionHub,
  onConnect: (ws) => {
    console.log('[WebSocket] OWLCMS connected');
  },
  onDisconnect: () => {
    console.log('[WebSocket] OWLCMS disconnected');
  },
  onMessage: (message) => {
    console.log('[WebSocket] Received:', message.type);
  },
  onError: (error) => {
    console.error('[WebSocket] Error:', error);
  }
});

console.log('WebSocket server listening on ws://localhost:8095/ws');
```

**Use case:** Simple standalone applications, CLI tools, testing.

---

### Mode 2: Inject into Existing HTTP Server (Recommended)

Attach WebSocket handler to an existing Express/HTTP server.

```javascript
import express from 'express';
import { createServer } from 'http';
import { competitionHub } from '@owlcms/tracker-core';
import { attachWebSocketToServer } from '@owlcms/tracker-core/websocket';

const app = express();
const httpServer = createServer(app);

// Your Express routes
app.get('/api/athletes', (req, res) => {
  const db = competitionHub.getDatabaseState();
  res.json(db?.athletes || []);
});

app.get('/api/lifting-order/:fop', (req, res) => {
  const fopData = competitionHub.getFopUpdate(req.params.fop);
  const liftingOrder = competitionHub.getLiftingOrderEntries(req.params.fop);
  res.json({
    currentAthlete: fopData?.fullName,
    athletes: liftingOrder
  });
});

// Attach WebSocket handler to existing server
attachWebSocketToServer({
  server: httpServer,
  path: '/ws',
  hub: competitionHub,
  onConnect: () => console.log('[WebSocket] OWLCMS connected'),
  onDisconnect: () => console.log('[WebSocket] OWLCMS disconnected')
});

httpServer.listen(8095, () => {
  console.log('HTTP server: http://localhost:8095');
  console.log('WebSocket: ws://localhost:8095/ws');
});
```

**Use case:** Production applications, custom REST APIs, multi-protocol servers.

---

### WebSocket Configuration Options

Both `createWebSocketServer` and `attachWebSocketToServer` accept these options:

```javascript
{
  // Required
  hub: competitionHub,           // Hub instance to forward messages to

  // Local files output (recommended for production)
  // Where OWLCMS-delivered ZIP resources are written:
  //   - flags_zip  -> <localFilesDir>/flags
  //   - logos_zip  -> <localFilesDir>/logos
  //   - pictures_zip -> <localFilesDir>/pictures
  //   - styles     -> <localFilesDir>/styles
  // The consumer must serve these files at URL path: /local/*
  // Default (if omitted): path.join(process.cwd(), 'local')
  localFilesDir: '/var/lib/owlcms-tracker/local',
  
  // Optional
  port: 8095,                    // Port (standalone mode only)
  path: '/ws',                   // WebSocket path (default: '/ws')
  server: httpServer,            // HTTP server (inject mode only)
  
  // Callbacks
  onConnect: (ws) => {},         // Called when OWLCMS connects
  onDisconnect: () => {},        // Called when OWLCMS disconnects
  onMessage: (message) => {},    // Called on every message (after hub processing)
  onError: (error) => {},        // Called on WebSocket errors
  
  // Advanced
  verifyClient: (info, cb) => {} // Custom connection verification
}
```

---

## Local Files (flags/logos/pictures/styles)

OWLCMS can send ZIP resources (e.g., `flags_zip`, `logos_zip`, `translations_zip`) over the same WebSocket connection.

- The **URL paths** used by clients remain stable (e.g., `/local/flags/<name>.svg`, `/local/logos/<name>.png`).
- The **filesystem output directory** for extracted files must be configurable via the WebSocket integration option `localFilesDir`.

This is required so deployments can write to a durable, configurable location (container volume, system service directory, etc.).

---

### OWLCMS Configuration

In OWLCMS, configure the WebSocket URL:

**Prepare Competition → Language and System Settings → Connections → URL for Video Data**

Set to: `ws://your-server:8095/ws`

---

## Utility Modules

### Flag Resolver

```javascript
import { getFlagUrl, getFlagHtml } from '@owlcms/tracker-core/utils';

// Get flag URL (returns null if not found)
const flagUrl = getFlagUrl('USA Weightlifting');
// "/local/flags/USA Weightlifting.svg"

// Get flag as HTML img tag
const flagHtml = getFlagHtml('USA Weightlifting', { width: 32, height: 24 });
// '<img src="/local/flags/USA Weightlifting.svg" width="32" height="24" alt="USA Weightlifting" />'
```

---

### Scoring Formulas

#### Sinclair

```javascript
import { 
  CalculateSinclair2024, 
  CalculateSinclair2020,
  getMastersAgeFactor
} from '@owlcms/tracker-core/scoring';

const sinclair2024 = CalculateSinclair2024(220, 88.5, 'M');
// 285.432

const sinclair2020 = CalculateSinclair2020(220, 88.5, 'M');
// 283.156

// Masters age adjustment
const ageFactor = getMastersAgeFactor(45, 'M');
const adjustedSinclair = sinclair2024 * ageFactor;
```

---

#### QPoints

```javascript
import { CalculateQPoints } from '@owlcms/tracker-core/scoring';

const qpoints = CalculateQPoints(220, 88.5, 'M');
// 95.234
```

---

#### GAMX

```javascript
import { computeGamx, Variant } from '@owlcms/tracker-core/scoring';

const gamx = computeGamx(220, 88.5, 'M', Variant.GAMX);
// 512.34

const gamx2 = computeGamx(220, 88.5, 'M', Variant.GAMX2);
// 523.45
```

---

### Team Scoring

```javascript
import { calculateTeamPoints } from '@owlcms/tracker-core/team';

const teamPoints = calculateTeamPoints({
  mensTeamSize: 5,      // Top 5 men count
  womensTeamSize: 5,    // Top 5 women count
  scoringMethod: 'sinclair'  // 'sinclair' | 'qpoints' | 'gamx'
}, athletes);

// Returns: { teamName: totalPoints, ... }
```

---

### Cache Utilities

```javascript
import { buildCacheKey } from '@owlcms/tracker-core/cache';

const cacheKey = buildCacheKey({
  fopName: 'Platform A',
  includeFop: true,
  opts: {
    gender: 'M',
    topN: 10,
    sortBy: 'sinclair'
  }
});
// "Platform_A-M-10-sinclair"
```

---

### Timer & Decision Helpers

```javascript
import { 
  extractTimers,
  extractDecisionState,
  extractTimerAndDecisionState
} from '@owlcms/tracker-core/helpers';

const fopUpdate = competitionHub.getFopUpdate('Platform A');

// Extract timer states (athlete + break)
const timers = extractTimers(fopUpdate);
// {
//   athlete: { state: "running", timeRemaining: 60000, duration: 60000 },
//   break: { state: "stopped", timeRemaining: 0, duration: 0 }
// }

// Extract decision state
const decision = extractDecisionState(fopUpdate);
// { type: "FULL_DECISION", visible: true }

// Extract both at once
const { timers, decision } = extractTimerAndDecisionState(fopUpdate);
```

---

### Attempt Bar Visibility

```javascript
import { 
  computeAttemptBarVisibility,
  hasCurrentAthlete
} from '@owlcms/tracker-core/helpers';

const fopUpdate = competitionHub.getFopUpdate('Platform A');

// Check if attempt bar should be shown
const showAttemptBar = computeAttemptBarVisibility(fopUpdate);
// true if timer running or athlete on platform

// Check if there's a current athlete
const hasCurrent = hasCurrentAthlete(fopUpdate);
// true if currentAthleteKey is set
```

---

### Records Extraction

```javascript
import { extractRecordsFromUpdate } from '@owlcms/tracker-core/records';

const fopUpdate = competitionHub.getFopUpdate('Platform A');

// Get new records broken in current session
const newRecords = extractRecordsFromUpdate(fopUpdate);
// [
//   { recordName: "National", recordLift: "SNATCH", recordValue: 125, athleteName: "DOE, John" },
//   ...
// ]
```

---

## Data Structures

### Database State

Complete structure returned by `getDatabaseState()`:

```javascript
{
  competition: {
    name: string,              // Competition name
    mensTeamSize: number,      // Top N athletes for men's team scoring
    womensTeamSize: number,    // Top N athletes for women's team scoring
    sinclair: string,          // Scoring formula: "2020", "2024", etc.
    fops: Array<string>        // FOP names: ["Platform A", "Platform B"]
  },
  athletes: Array<{
    key: string | number,      // Unique athlete identifier (can be negative)
    firstName: string,
    lastName: string,
    fullBirthDate: Array<number> | string,  // [2001, 1, 18] or "2001-01-18"
    gender: "M" | "F",
    bodyWeight: number,
    categoryCode: string,      // e.g., "SR_M89"
    team: number,              // Team ID (resolved via getTeamNameById)
    sessionName: string,
    startNumber: number,
    lotNumber: number,
    // Attempt declarations and results (6 attempts total)
    snatch1Declaration: number,
    snatch1Change1: number | null,
    snatch1Change2: number | null,
    snatch1ActualLift: number | null,  // Positive = good, negative = fail
    snatch1AutomaticProgression: number | null,
    snatch2Declaration: number,
    snatch2Change1: number | null,
    snatch2Change2: number | null,
    snatch2ActualLift: number | null,
    snatch2AutomaticProgression: number | null,
    snatch3Declaration: number,
    snatch3Change1: number | null,
    snatch3Change2: number | null,
    snatch3ActualLift: number | null,
    snatch3AutomaticProgression: number | null,
    cleanJerk1Declaration: number,
    cleanJerk1Change1: number | null,
    cleanJerk1Change2: number | null,
    cleanJerk1ActualLift: number | null,
    cleanJerk1AutomaticProgression: number | null,
    cleanJerk2Declaration: number,
    cleanJerk2Change1: number | null,
    cleanJerk2Change2: number | null,
    cleanJerk2ActualLift: number | null,
    cleanJerk2AutomaticProgression: number | null,
    cleanJerk3Declaration: number,
    cleanJerk3Change1: number | null,
    cleanJerk3Change2: number | null,
    cleanJerk3ActualLift: number | null,
    cleanJerk3AutomaticProgression: number | null,
    total: number,
    sinclair: number,
    participations: Array<{
      categoryCode: string,
      snatchRank: number,
      cleanJerkRank: number,
      totalRank: number,
      teamMember: boolean,
      championshipType: string
    }>
  }>,
  teams: Array<{
    id: number,
    name: string,
    fullName: string,
    code: string
  }>,
  ageGroups: Array<{
    active: boolean,
    code: string,
    name: string,
    categories: Array<{
      code: string,
      categoryCode: string,
      id: number | string
    }>
  }>,
  records: Array<{
    id: number,
    recordValue: number,
    ageGrp: string,
    athleteName: string,
    bwCatLower: number,
    bwCatUpper: number,
    gender: "M" | "F",
    recordFederation: string,
    recordLift: "SNATCH" | "CLEANJERK" | "TOTAL",
    recordName: string,
    bwCatString: string,
    groupNameString: string   // Empty for pre-existing, session name for new records
  }>,
  databaseChecksum: string,
  lastUpdate: number,
  initialized: boolean
}
```

---

### FOP Update

Complete structure returned by `getFopUpdate(fopName)`:

```javascript
{
  // Competition metadata
  competitionName: string,
  fop: string,                    // FOP name
  fopName: string,                // Alternative field name
  fopState: string,               // "INACTIVE", "CURRENT_ATHLETE", "BREAK", etc.
  sessionName: string,            // Current session/group name
  sessionInfo: string,            // Formatted session details
  
  // Current athlete identifiers (no array scanning needed!)
  currentAthleteKey: string,      // Key of current lifter
  nextAthleteKey: string,         // Key of next lifter
  previousAthleteKey: string,     // Key of previous lifter (may be undefined)
  
  // Current athlete display fields
  fullName: string,
  teamName: string,
  startNumber: number,
  categoryName: string,
  attempt: string,
  attemptNumber: number,
  weight: number,
  
  // Session athletes (flattened array with display-ready fields)
  sessionAthletes: Array<{
    // See "Session Athlete (Display-Ready)" section below
  }>,
  
  // Ordered athlete arrays (resolved with full objects)
  startOrderAthletes: Array<{
    ...athleteFields,
    classname: string,
    isSpacer?: boolean             // Category spacer flag
  }>,
  liftingOrderAthletes: Array<{
    ...athleteFields,
    classname: string,
    isSpacer?: boolean             // Snatch/C&J spacer flag
  }>,
  
  // Key-based ordering (lightweight references)
  startOrderKeys: Array<string | {isSpacer: true, ...}>,
  liftingOrderKeys: Array<string | {isSpacer: true, ...}>,
  
  // Timer state (athlete clock)
  athleteTimerEventType: "StartTime" | "StopTime" | "SetTime",
  athleteMillisRemaining: number,
  athleteStartTimeMillis: number,
  timeAllowed: number,
  
  // Break timer state
  breakTimerEventType: "StartTime" | "StopTime" | "SetTime" | "Pause",
  breakMillisRemaining: number,
  breakStartTimeMillis: number,
  
  // Decision state
  decisionEventType: string,
  decisionsVisible: "true" | "false",
  d1: "true" | "false" | null,
  d2: "true" | "false" | null,
  d3: "true" | "false" | null,
  down: "true" | "false",
  
  // Break/ceremony state
  break: "true" | "false",
  breakType: string,
  ceremonyType: string,
  
  // Records
  records: Array<{ ... }>,       // Same structure as database.records
  
  // Metadata
  lastUpdate: number,
  lastDataUpdate: number,
  uiEvent: string
}
```

---

### Session Athlete (Display-Ready)

Athletes in `sessionAthletes`, `startOrderAthletes`, `liftingOrderAthletes` have these display fields:

```javascript
{
  // Identity
  key: string,
  fullName: "DOE, John",
  firstName: "John",
  lastName: "DOE",
  
  // Team & Category
  teamName: "USA Weightlifting",
  categoryName: "M89 Senior",
  gender: "M",
  
  // Attempts (precomputed by OWLCMS)
  sattempts: [
    { value: 100, status: "good" },
    { value: 105, status: "bad" },
    { value: 105, status: "request" }
  ],
  cattempts: [
    { value: 120, status: "current" },  // Current attempt
    { value: null, status: null },
    { value: null, status: null }
  ],
  
  // Best lifts
  bestSnatch: "100",
  bestCleanJerk: "120",
  total: "220",
  
  // Rankings
  snatchRank: "2",
  cleanJerkRank: "1",
  totalRank: "1",
  sinclair: "285.432",
  sinclairRank: "1",
  
  // Visual state
  classname: "current blink",  // "current blink" | "next" | "good-lift" | "no-lift" | ""
  
  // Flags & branding
  flagURL: "/local/flags/USA Weightlifting.svg",
  flagClass: "longTeam",  // "shortTeam" | "longTeam"
  teamLength: 16
}
```

---

## Complete Usage Example

```javascript
import express from 'express';
import { createServer } from 'http';
import { 
  competitionHub, 
  EVENT_TYPES,
  attachWebSocketToServer 
} from '@owlcms/tracker-core';

const app = express();
const httpServer = createServer(app);

// Wait for hub to be ready
competitionHub.once(EVENT_TYPES.HUB_READY, () => {
  console.log('✓ Hub ready - database and translations loaded');
});

// React to decisions
competitionHub.on(EVENT_TYPES.DECISION, (fopName, payload) => {
  if (payload.decisionEventType === 'FULL_DECISION') {
    const goodCount = [payload.d1, payload.d2, payload.d3]
      .filter(d => d === 'true').length;
    
    console.log(`Decision on ${fopName}: ${goodCount >= 2 ? 'GOOD LIFT' : 'NO LIFT'}`);
  }
});

// REST API endpoints
app.get('/api/lifting-order/:fop', (req, res) => {
  const liftingOrder = competitionHub.getLiftingOrderEntries(req.params.fop, {
    includeSpacer: true
  });
  
  res.json({
    fop: req.params.fop,
    athletes: liftingOrder,
    timestamp: Date.now()
  });
});

app.get('/api/athletes', (req, res) => {
  const db = competitionHub.getDatabaseState();
  res.json(db?.athletes || []);
});

// Attach WebSocket handler
attachWebSocketToServer({
  server: httpServer,
  path: '/ws',
  hub: competitionHub,
  onConnect: () => console.log('OWLCMS connected'),
  onDisconnect: () => console.log('OWLCMS disconnected')
});

httpServer.listen(8095, () => {
  console.log('Server ready: http://localhost:8095');
  console.log('Configure OWLCMS: ws://localhost:8095/ws');
});
```

---

## See Also

- [DEVELOPER_USAGE.md](./DEVELOPER_USAGE.md) - Installation and quick start guides
- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) - Package development plan
- [API_ANALYSIS.md](./API_ANALYSIS.md) - Detailed analysis of current plugin patterns
