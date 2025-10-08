# Scoreboard Architecture - Multi-FOP, Multi-Type System

## Overview

This system supports **15+ different scoreboard types** with **up to 6 simultaneous FOPs** for each scoreboard type. 

**OWLCMS Integration:**
- OWLCMS sends data to existing endpoints: `/database`, `/update`, `/timer`, `/decision`
- **No changes needed to OWLCMS** - it already sends to the correct endpoints
- Competition Hub stores per-FOP data from these endpoints
- Scoreboards pull processed data via `/api/scoreboard?type=...&fop=...`

**Key Design Principles:**
1. **Modular** - Each scoreboard type is self-contained in its folder
2. **Server-side processing** - Process data once, serve hundreds of browsers
3. **URL-based configuration** - FOP selection and options via query parameters
4. **AI-assisted development** - Easy for novices to create/modify scoreboards
5. **No OWLCMS changes required** - Works with existing data flow

## Architecture

### High-Level Data Flow

```
OWLCMS → /database (full competition data - athletes, categories, FOPs)
       → /update (lifting order changes, athlete switches)
         ↓
    Competition Hub (stores per-FOP data)
         ↓
         ↓ Broadcasts SSE on state changes
         ↓
Browser: Subscribes to /api/client-stream (receives "data updated" notification)
         ↓
         Fetches: /api/scoreboard?type=lifting-order&fop=Platform_A (gets fresh data)
         ↓
    Displays updated scoreboard immediately

⚠️ Note: Timer and Decision events have specialized flows
```

### Update Event Flow (Standard Path)

1. **OWLCMS sends /update event** (LiftingOrderUpdated, SwitchGroup, etc.)
   - Contains precomputed data: `liftingOrderAthletes`, `groupAthletes`
   - Current athlete info: `fullName`, `teamName`, `weight`, `attempt`, etc.
   - FOP identifier: `fopName`

2. **Competition Hub processes update**
   - Merges new data with existing FOP state
   - Preserves data from previous updates (e.g., timer state during athlete changes)
   - Stores in `fopUpdates[fopName]`

3. **Hub broadcasts SSE message**
   - Simple notification: "FOP Platform_A has new data"
   - No payload - just a trigger

4. **All connected browsers receive SSE**
   - Triggers API fetch: `/api/scoreboard?type=lifting-order&fop=Platform_A`
   - Receives complete processed data for display

5. **Scoreboard updates immediately**
   - New lifting order rendered
   - Current athlete highlighted
   - Attempt numbers updated

**Benefits:**
- ✅ **OWLCMS does all business logic** (rankings, sinclair, totals)
- ✅ **Hub processes once** → Hundreds of browsers fetch same result
- ✅ **SSE is lightweight** → Only triggers, no large payloads
- ✅ **Browsers always get fresh data** → No stale cache issues

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

## OWLCMS Endpoints (Existing - No Changes Needed)

OWLCMS already sends data to these endpoints:

**Status Codes:**
- `200 OK` - Data accepted and stored
- `428 Precondition Required` - Hub needs database before accepting updates
- `412 Precondition Failed` - Hub needs icons/pictures/configuration *(reserved for future use)*
- `500 Internal Server Error` - Processing error

### POST /database
Receives full competition database (athletes, categories, FOPs, etc.)

**OWLCMS sends:**
- Full competition data (JSON or form-encoded)
- Complete athlete list
- FOP configurations
- Categories and weight classes

**Competition Hub stores this as:** `databaseState`

### POST /update
Receives UI event updates (lifting order changes, athlete switches, etc.)

**OWLCMS sends:**
- `uiEvent`: Event type (e.g., "LiftingOrderUpdated", "SwitchGroup")
- `fopName` or `fop`: FOP identifier
- `liftingOrderAthletes`: JSON string with precomputed lifting order
- `groupAthletes`: JSON string with all athletes in current group
- Current athlete info: `fullName`, `teamName`, `startNumber`, `weight`, `attempt`, etc.

**Competition Hub stores this as:** `fopUpdates[fopName]`

### POST /timer
Receives timer start/stop/set events

**OWLCMS sends:**
- `athleteTimerEventType`: "StartTime", "StopTime", or "SetTime"
- `fopName`: FOP identifier
- `athleteMillisRemaining`: Time remaining in milliseconds
- `timeAllowed`: Total time allowed (usually 60000ms)

**Competition Hub stores this as:** `fopUpdates[fopName]`

**Note:** Timer events use a specialized client-side countdown flow for efficiency. See **Timer Event Flow** in Implementation Details below.

### POST /decision
Receives referee decisions

**OWLCMS sends:**
- `decisionEventType`: Decision type
- `fopName`: FOP identifier
- Decision details

**Competition Hub stores this as:** `fopUpdates[fopName]`

**Note:** Decision events have specialized processing (to be documented).

## Creating a New Scoreboard (AI-Assisted)

### Step 1: Create Plugin Folder

```bash
mkdir src/plugins/results
```

### Step 2: Create config.js

```javascript
export default {
	name: 'Results Board',
	description: 'Shows final results sorted by rank',
	options: [
		{
			key: 'sortBy',
			label: 'Sort By',
			type: 'select',
			options: ['total', 'sinclair', 'bodyweight'],
			default: 'total',
			description: 'How to sort the results'
		},
		{
			key: 'showTop',
			label: 'Show Top N',
			type: 'number',
			default: 10,
			min: 3,
			max: 50
		}
	],
	requiredFields: ['fullName', 'total', 'sinclair', 'rank']
};
```

### Step 3: Create helpers.data.js

```javascript
import { competitionHub } from '$lib/server/competition-hub.js';

export function getScoreboardData(fopName, options = {}) {
	const fopUpdate = competitionHub.getFopUpdate(fopName);
	const databaseState = competitionHub.getDatabaseState();
	
	// Extract options
	const sortBy = options.sortBy || 'total';
	const showTop = options.showTop || 10;
	
	// Parse group athletes
	let athletes = [];
	if (fopUpdate?.groupAthletes) {
		athletes = JSON.parse(fopUpdate.groupAthletes);
	}
	
	// Sort athletes
	athletes.sort((a, b) => {
		if (sortBy === 'sinclair') return (b.sinclair || 0) - (a.sinclair || 0);
		if (sortBy === 'bodyweight') return a.bodyweight - b.bodyweight;
		return (b.total || 0) - (a.total || 0);
	});
	
	// Limit to top N
	athletes = athletes.slice(0, showTop);
	
	return {
		competition: {
			name: fopUpdate?.competitionName || 'Competition',
			fop: fopName
		},
		athletes,
		sortBy,
		showTop,
		status: athletes.length > 0 ? 'ready' : 'waiting'
	};
}
```

### Step 4: Create page.svelte

```svelte
<script>
	export let data = {};
	export let options = {};
</script>

<div class="results">
	<h1>{data.competition?.name} - Results</h1>
	<p>Sorted by: {data.sortBy}</p>
	
	<table>
		<thead>
			<tr>
				<th>Rank</th>
				<th>Name</th>
				<th>Total</th>
				<th>Sinclair</th>
			</tr>
		</thead>
		<tbody>
			{#each data.athletes || [] as athlete}
				<tr>
					<td>{athlete.rank}</td>
					<td>{athlete.fullName}</td>
					<td>{athlete.total}</td>
					<td>{athlete.sinclair?.toFixed(2)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
```

### Step 5: Use It

Navigate to: `/results?fop=Platform_A&sortBy=sinclair&showTop=15`

That's it! The registry will auto-discover your scoreboard.

## URL Structure

### Format
```
/{type}?fop={fop_name}&{option1}={value1}&{option2}={value2}
```

### Examples

```
# Lifting order for Platform A, show 8 lifters
/lifting-order?fop=Platform_A&maxLifters=8

# Results for Platform B, sorted by Sinclair, top 15
/results?fop=Platform_B&sortBy=sinclair&showTop=15

# Team rankings for Platform C, show team logos
/team-rankings?fop=Platform_C&showLogos=true
```

## API Endpoints

### GET /api/scoreboard

Get processed data for any scoreboard type.

**Parameters:**
- `type` - Scoreboard type (e.g., `lifting-order`)
- `fop` - FOP name (required)
- Any other options defined in the scoreboard's config

**Example:**
```
GET /api/scoreboard?type=lifting-order&fop=Platform_A&maxLifters=10
```

**Response:**
```json
{
  "success": true,
  "type": "lifting-order",
  "fop": "Platform_A",
  "options": { "maxLifters": 10 },
  "data": {
    "competition": {...},
    "currentAttempt": {...},
    "liftingOrder": [...]
  },
  "timestamp": 1696704123456
}
```

### POST /api/scoreboard

Get metadata about available scoreboards and FOPs.

**Actions:**
- `list_scoreboards` - Get all registered scoreboard types
- `list_fops` - Get available FOP names from current competition

**Example:**
```javascript
POST /api/scoreboard
{
  "action": "list_scoreboards"
}
```

**Response:**
```json
{
  "success": true,
  "scoreboards": [
    {
      "type": "lifting-order",
      "name": "Lifting Order",
      "description": "Shows current lifter and upcoming order",
      "options": [...]
    }
  ]
}
```

## FOP Name Discovery

FOP names are **dynamically discovered** from:

1. **Database state** - `competition.fops` array
2. **Received updates** - Keys in `fopUpdates` map
3. **Fallback** - Default FOP 'A'

Example database structure:
```json
{
  "competition": {
    "name": "Provincial Championship",
    "fops": ["Platform_A", "Platform_B", "Platform_C"]
  },
  "athletes": [...]
}
```

## Multi-FOP Support

Each scoreboard can be displayed **simultaneously** for multiple FOPs:

```html
<!-- Different browser tabs/windows -->
Tab 1: /lifting-order?fop=Platform_A
Tab 2: /lifting-order?fop=Platform_B
Tab 3: /lifting-order?fop=Platform_C
```

The competition hub stores **separate state** for each FOP:

```javascript
{
  fopUpdates: {
    'Platform_A': { fullName: 'John Doe', weight: 120, athleteTimerEventType: 'StartTime', ... },
    'Platform_B': { fullName: 'Jane Smith', weight: 105, athleteTimerEventType: 'SetTime', ... },
    'Platform_C': { fullName: 'Bob Johnson', weight: 95, athleteTimerEventType: 'StopTime', ... }
  }
}
```

**Important:** Timer events are **per-FOP independent**. Each FOP can have its own timer running simultaneously without conflicts.

## Development Mode - Data Persistence

The competition hub uses **globalThis persistence** to survive Vite HMR (Hot Module Reload):

```javascript
// Export singleton instance
// Use globalThis to persist across HMR (Vite hot reload)
if (!globalThis.__competitionHub) {
  globalThis.__competitionHub = new CompetitionHub();
  console.log('[Hub] Creating new CompetitionHub instance');
} else {
  console.log('[Hub] Reusing existing CompetitionHub instance (HMR)');
}

export const competitionHub = globalThis.__competitionHub;
```

**Benefits:**
- ✅ **Competition data persists** when editing code during development
- ✅ **No need to resend** database/update messages after code changes
- ✅ **Faster development** cycle - see changes immediately without losing state
- ✅ **Production-ready** - globalThis has no impact in production (no HMR)

## AI Development Workflow

### For a Novice Developer with AI Assistant

1. **Describe what you want:**

   > "Create a scoreboard that shows team rankings. Teams score based on their top 3 athletes' totals. Display team name, total score, and list of contributing athletes."

2. **AI generates the 3 files:**
   - `config.js` - Metadata
   - `helpers.data.js` - Processing logic
   - `page.svelte` - Display

3. **Test it:**
   ```
   /team-rankings?fop=Platform_A
   ```

4. **Iterate:**

   > "Add an option to show only teams with 3+ athletes" 
   > "Highlight the winning team in gold"
   > "Show each athlete's contribution percentage"

## Best Practices

### Server-Side (helpers.data.js)

✅ **DO:**
- Parse JSON strings from OWLCMS
- Filter/sort data
- Compute custom rankings
- Extract specific fields
- Apply user options

❌ **DON'T:**
- Make HTTP requests
- Access external APIs
- Perform async operations (keep it synchronous)

### Client-Side (page.svelte)

✅ **DO:**
- Map data to screen positions
- Apply CSS styles
- Handle timer countdowns
- Show/hide elements based on options

❌ **DON'T:**
- Parse JSON
- Sort/filter data
- Compute rankings
- Implement business logic

## Performance Considerations

- **Server processes once** → Hundreds of browsers benefit
- **SSE push notifications** → Instant updates on decisions, timer events
- **Precomputed data from OWLCMS** → Minimal server processing
- **Static asset caching** → Fast page loads
- **Efficient broadcasting** → One SSE message reaches all connected browsers

## Debugging

### Check Available Scoreboards

```javascript
POST /api/scoreboard
{ "action": "list_scoreboards" }
```

### Check Available FOPs

```javascript
POST /api/scoreboard
{ "action": "list_fops" }
```

### Check Raw FOP Data

```javascript
// In competition-hub.js
console.log(competitionHub.getFopUpdate('Platform_A'));
```

### Browser Console

```javascript
// Check what data the component received
console.log('[Scoreboard] data:', data);
```

## Migration from Old System

If you have an existing scoreboard in `src/plugins/scoreboard/`:

1. Rename folder: `scoreboard` → `lifting-order`
2. Add `config.js`
3. Update `helpers.data.js` to accept `(fopName, options)`
4. Create simplified `page.svelte`
5. Test with `/lifting-order?fop=A`

## Future Enhancements

- **SSE per FOP** - Dedicated stream for each FOP to reduce bandwidth
- **WebSocket option** - For ultra-low latency
- **Browser-side caching** - Service worker for offline support
- **Plugin marketplace** - Share scoreboard configs with community

---

## Implementation Details

### Timer Event Flow (Client-Side Countdown)

**Key Innovation:** Timer countdown is **fully client-side** to support hundreds of concurrent viewers.

**Flow:**
1. **OWLCMS sends timer event** (StartTime, StopTime, SetTime) → `/timer` endpoint
2. **Competition Hub** stores timer state and broadcasts **one SSE message**
3. **All connected browsers** receive SSE notification
4. **Each browser fetches** updated scoreboard data with timer state
5. **Client-side countdown** begins using `Date.now() - startTime` calculation
6. **No further server communication** needed during 60-second countdown

**Result:** One timer start message from OWLCMS → One SSE broadcast → Hundreds of browsers count down independently

**Timer Event Types:**
- **StartTime** - Timer starts counting down (state: "running")
- **StopTime** - Timer stops but displays time (state: "stopped")
- **SetTime** - Timer is set but not running (state: "set")

**Example Timeline:**
```
T=0s:   OWLCMS sends StartTime (60000ms) → Hub broadcasts SSE
        → 200 browsers receive notification
        → Each browser starts local countdown from 60 seconds
T=1s:   Each browser displays 59 (no server communication)
T=2s:   Each browser displays 58 (no server communication)
...
T=60s:  Each browser displays 0 (no server communication)

Total SSE messages: 1 (start event only)
Total server load: Minimal (one broadcast, 200 API fetches at T=0)
```

**Server-Side Processing (helpers.data.js):**
```javascript
// Timer state detection
const timer = {
  state: fopUpdate?.athleteTimerEventType === 'StartTime' ? 'running' : 
         fopUpdate?.athleteTimerEventType === 'StopTime' ? 'stopped' : 
         fopUpdate?.athleteTimerEventType === 'SetTime' ? 'set' : 'stopped',
  timeRemaining: parseInt(fopUpdate?.athleteMillisRemaining || 0),
  duration: parseInt(fopUpdate?.timeAllowed || 60000)
};
```

**Client-Side Countdown (page.svelte):**
```javascript
// Browser calculates elapsed time locally (no SSE spam)
if (data.timer.state === 'running') {
  if (timerStartTime === null) {
    timerStartTime = Date.now();
    timerInitialRemaining = data.timer.timeRemaining;
  }
  const elapsed = Date.now() - timerStartTime;
  const remaining = Math.max(0, timerInitialRemaining - elapsed);
  timerSeconds = Math.ceil(remaining / 1000);
}
```

**Benefits:**
- ✅ **One SSE message** per timer state change
- ✅ **Zero server load** during countdown
- ✅ **Supports hundreds of browsers** with minimal traffic
- ✅ **Accurate countdown** using client system time
