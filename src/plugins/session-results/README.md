# Session Scoreboard

This scoreboard displays all athletes in the session sorted by standard order (category, lot number). It features:

- **18-column OWLCMS-style layout** with vertical and horizontal spacers
- **Green highlight for current lifter**, orange for next lifter (based on OWLCMS `classname` field)
- **Client-side countdown timer** for scalability (supports hundreds of browsers)
- **Responsive design** using rem/em units (except fixed 8px spacers)
- **Compact inline header** showing current athlete, team, attempt, weight, and timer
- **Attempt tracking** with symbols: ✓ (good), ✗ (failed), − (not lifted)
- **Category separators** (horizontal spacer rows when `athlete.isSpacer === true`)
- **Standard order sorting** - Athletes sorted by category and lot number (not lifting order)

## Current Implementation Summary

### Visual Layout

**Table Structure (18 columns):**
- 5 athlete info columns: Start #, Name, Category, Born, Team
- 3 vertical spacer columns (8px black bars)
- 8 attempt columns: Snatch 1-3 + Best, Clean&Jerk 1-3 + Best
- 2 result columns: Total, Rank

**Header (Compact Inline):**
- Start # (red square, 1.5rem) - Athlete Name (1.5rem) - Team (1.5rem) - Attempt Label (1.5rem) - Weight - Timer

**Highlighting:**
- Current lifter: Green background (#22c55e) - via `classname.includes('current')`
- Next lifter: Orange background (#f97316) - via `classname.includes('next')`

**Spacers:**
- Vertical: 8px black columns between sections
- Horizontal: 8px black rows when `athlete.isSpacer === true` (category separators)

### Timer Implementation

**Client-Side Countdown:**
- Timer states: `running` (counts down), `stopped` (shows time), `set` (shows time)
- Uses `Date.now() - timerStartTime` for local calculation
- No SSE traffic during countdown (supports hundreds of browsers)
- Updates every 100ms via `setInterval`

### Font Sizing

- Base table text: 1.1rem (HD-optimized)
- Header elements: 1.5rem (athlete name, team, attempt label, start number)
- Responsive: All units in rem/em except fixed 8px spacers and 1px borders

## Files

- **config.js** - Metadata and user-configurable options
- **helpers.data.js** - Server-side data processing (extracts sessionAthletes in standard order)
- **page.svelte** - Display component (18-column table with OWLCMS styling, client-side timer)

## URL Parameters

- `fop` (required) - FOP name (e.g., `Platform_A`)
- `showRecords` (optional) - Show competition records (true/false, default: false) *(not yet implemented)*

Example: `/session-results?fop=Platform_A`

## Key Features to Replicate for Variations

### 1. OWLCMS-Style Layout
```svelte
<!-- 18-column table structure -->
<table class="scoreboard-table">
  <thead>
    <tr>
      <th>Start</th>
      <th>Name</th>
      <th>Cat.</th>
      <th>Born</th>
      <th>Team</th>
      <th class="v-spacer"></th>  <!-- 8px vertical spacer -->
      <th colspan="4">Snatch</th>
      <!-- ... more columns -->
    </tr>
  </thead>
  <tbody>
    {#each athletes as athlete}
      {#if athlete.isSpacer}
        <tr class="spacer"></tr>  <!-- 8px horizontal spacer -->
      {:else}
        <tr class:current={athlete.classname?.includes('current')}
            class:next={athlete.classname?.includes('next')}>
          <!-- athlete row -->
        </tr>
      {/if}
    {/each}
  </tbody>
</table>
```

### 2. Client-Side Timer Countdown
```javascript
let timerStartTime = null;
let timerInitialRemaining = 0;
let lastTimerState = null;

// Detect timer state changes
$: if (data.timer) {
  const currentState = `${data.timer.state}-${data.timer.timeRemaining}`;
  if (currentState !== lastTimerState) {
    lastTimerState = currentState;
    if (data.timer.state === 'running') {
      timerStartTime = null; // Reset to capture new start time
    }
    updateTimer();
  }
}

function updateTimer() {
  if (data.timer.state === 'running') {
    if (timerStartTime === null) {
      timerStartTime = Date.now();
      timerInitialRemaining = data.timer.timeRemaining;
    }
    const elapsed = Date.now() - timerStartTime;
    const remaining = Math.max(0, timerInitialRemaining - elapsed);
    timerSeconds = Math.ceil(remaining / 1000);
  } else {
    timerSeconds = Math.ceil((data.timer.timeRemaining || 0) / 1000);
  }
}

onMount(() => {
  timerInterval = setInterval(updateTimer, 100); // Update every 100ms
});
```

### 3. Compact Inline Header
```svelte
<header class="header">
  <div class="lifter-info">
    <span class="start-number">{currentAttempt?.startNumber || '-'}</span>
    <span class="lifter-name">{currentAttempt?.fullName || 'No athlete'}</span>
    <span class="team">{currentAttempt?.teamName || ''}</span>
    <span class="attempt-label">{@html currentAttempt?.attempt || ''}</span>
    <span class="weight">{currentAttempt?.weight || '-'} kg</span>
    <span class="timer">{timerDisplay}</span>
  </div>
</header>

<style>
  .start-number {
    background: #dc2626;  /* Red square */
    font-size: 1.5rem;
    padding: 0.5rem 1rem;
  }
  .lifter-name, .team, .attempt-label {
    font-size: 1.5rem;
    font-weight: bold;
  }
</style>
```

### 4. Attempt Rendering with Symbols
```javascript
function formatAttempt(attempt) {
  if (!attempt || !attempt.stringValue) return '−';
  // Extract weight: "123(✓)" → "123"
  const weight = attempt.stringValue.replace(/[()✓✗]/g, '').trim();
  // Symbol: "(✓)" or "(✗)"
  const symbol = attempt.stringValue.includes('✓') ? '✓' : 
                 attempt.stringValue.includes('✗') ? '✗' : '';
  return weight && symbol ? `${weight}${symbol}` : (weight || '−');
}
```

### 5. Responsive Styling
```css
/* Base font size for HD displays */
.scoreboard-table {
  font-size: 1.1rem;
}

/* Fixed spacers (only use px for 8px spacers and 1px borders) */
.v-spacer {
  width: 8px;
  background: black;
}

.spacer {
  height: 8px;
  background: black;
}

/* Current/Next highlighting */
tr.current {
  background-color: #22c55e;  /* Green */
}

tr.next {
  background-color: #f97316;  /* Orange */
}
```

## Data Structure (from helpers.data.js)

The `helpers.data.js` function receives OWLCMS data and extracts:

### Input (from Competition Hub)
```javascript
fopUpdate = {
  sessionAthletes: '[ {...}, {...} ]',       // JSON string (standard order: category, lot)
  fullName: 'John Doe',
  teamName: 'Team ABC',
  startNumber: 123,
  attempt: 'SNATCH 1',
  weight: 120,
  athleteTimerEventType: 'StartTime',
  athleteMillisRemaining: 60000,
  timeAllowed: 60000,
  // ... more fields
}
```

### Output (to page.svelte)
```javascript
{
  competition: {
    name: string,
    fop: string,
    groupInfo: string
  },
  currentAttempt: {
    fullName: string,
    teamName: string,
    startNumber: number,
    attempt: string,       // e.g., "SNATCH 1"
    weight: number
  },
  timer: {
    state: 'running' | 'stopped' | 'set',
    timeRemaining: number,  // milliseconds
    duration: number        // milliseconds
  },
  liftingOrderAthletes: [  // All athletes in standard order (from sessionAthletes)
    {
      fullName: string,
      teamName: string,
      startNumber: number,
      categoryName: string,
      classname: string,     // 'current', 'next', or empty
      isSpacer: boolean,     // true for category separators
      snatch1: { stringValue: '120(✓)' },
      snatch2: { stringValue: '125(✗)' },
      snatch3: { stringValue: null },
      bestSnatch: { stringValue: '120' },
      cleanJerk1: { stringValue: '150(✓)' },
      // ... etc
      total: number,
      rank: number
    }
  ],
  status: 'ready' | 'waiting'
}
```

## Creating Variations (Copy This Plugin)

This scoreboard is designed to be copied and modified for different display styles.

### Example: Create "Lifting Order" Variation

```bash
# Copy the entire plugin folder
cp -r src/plugins/session-results src/plugins/lifting-order

# Modify the new variation:
# 1. Edit config.js - change name to "Lifting Order"
# 2. Edit helpers.data.js - use liftingOrderAthletes instead of sessionAthletes
# 3. Edit page.svelte - adjust layout/styling as needed
```

### Common Variations to Create

**Lifting Order (Upcoming Lifters):**
- Use liftingOrderAthletes instead of sessionAthletes
- Show only next N lifters (not full session)
- Emphasize current and next lifter

**Results Board:**
- Remove timer
- Show only athletes who have completed all lifts
- Sort by rank/total
- Larger font for top 3

**Warmup Room Display:**
- Show next 3 lifters only
- Very large fonts
- No attempt history

## Modifying This Scoreboard

### To Add a New Display Option

1. Update `config.js` to add the option:
```javascript
options: [
  {
    key: 'highlightLeaders',
    label: 'Highlight Leaders',
    type: 'boolean',
    default: false,
    description: 'Highlight athletes in medal positions'
  }
]
```

2. Use the option in `helpers.data.js`:
```javascript
export function getScoreboardData(fopName, options = {}) {
  const highlightLeaders = options.highlightLeaders ?? false;
  // ... use it in processing
}
```

3. Display it in `page.svelte`:
```svelte
<script>
  $: highlightLeaders = scoreboardData?.options?.highlightLeaders;
</script>

<div class:highlight={highlightLeaders && athlete.rank <= 3}>
  {athlete.fullName}
</div>
```

### To Change the Layout

Edit `page.svelte` - all data is already in `scoreboardData`, just map it to different positions/styles.

### To Change Data Processing

Edit `helpers.data.js` - this is where you extract and format data from OWLCMS. The browser just displays what you send.

## AI Prompts for Modifications

### Add a Feature
> "Add an option to show athlete photos next to their names. The photo URL is in the athlete data as `photoUrl`."

### Change Layout
> "Remove the vertical spacers and make the table more compact. Keep the green/orange highlighting."

### Simplify Display
> "Show only the next 5 lifters in a simple list format. Remove all attempt history, just show: name, team, attempt, weight."

### Custom Sorting
> "Sort the lifting order by team name first, then by weight. Add a team name header row before each team group."

## Implementation Notes

### Why Client-Side Timer?
- **Scalability**: One SSE broadcast → hundreds of browsers count down independently
- **Efficiency**: Zero server load during 60-second countdown
- **Accuracy**: Uses `Date.now()` for precise client-side calculation

### Why 18 Columns?
- Matches OWLCMS official layout exactly
- Vertical spacers (3 columns) separate logical sections
- Professional competition appearance

### Why Separate isSpacer Rows?
- OWLCMS sends category separators as special athlete entries
- Allows flexible grouping by category, session, etc.
- Easy to toggle on/off in CSS

### Data Flow Summary
1. **OWLCMS** → `/update` → Competition Hub stores `fopUpdates[fopName]`
2. **Hub** → Broadcasts SSE → "Platform_A updated"
3. **Browser** → Fetches `/api/scoreboard?type=lifting-order&fop=Platform_A`
4. **helpers.data.js** → Processes once → Returns formatted data
5. **page.svelte** → Displays data → Starts client-side timer countdown

## Architecture Notes

- **Server processes once** → Hundreds of browsers display
- **No business logic in browser** → Only mapping data → screen positions
- **All options via URL** → Easy to bookmark, share, control from OWLCMS
- **Modular** → Each scoreboard is self-contained in its folder
