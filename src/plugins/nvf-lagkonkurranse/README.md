# NVF Lagkonkurranse Scoreboard

This scoreboard displays Norwegian team league competition (NVF Lagkonkurranse) results with athletes grouped by team. It is a team-based competition ranking system designed for Norwegian weightlifting leagues.

## Features

- **18-column OWLCMS-style layout** with vertical and horizontal spacers
- **Green highlight for current lifter**, orange for next lifter (based on OWLCMS `classname` field)
- **Client-side countdown timer** for scalability (supports hundreds of browsers)
- **Team grouping and scoring** - Athletes grouped by team with team totals
- **Responsive design** using rem/em units (except fixed 8px spacers)
- **Compact inline header** showing current athlete, team, attempt, weight, and timer
- **Attempt tracking** with symbols: ✓ (good), ✗ (failed), − (not lifted)
- **Team separators** (horizontal spacer rows between teams)
- **Gender filtering** - Option to filter by gender (M/F/MF)

## Current Implementation Summary

### Visual Layout

**Table Structure (18 columns):**
- 5 athlete info columns: Start #, Name, Category, Born, Team
- 3 vertical spacer columns (8px black bars)
- 8 attempt columns: Snatch 1-3 + Best, Clean&Jerk 1-3 + Best
- 2 result columns: Total, Score

**Header (Compact Inline):**
- Start # (red square, 1.5rem) - Athlete Name (1.5rem) - Team (1.5rem) - Attempt Label (1.5rem) - Weight - Timer

**Team Headers:**
- Team name with optional flag image
- Athlete count for the team
- Team total score

**Highlighting:**
- Current lifter: Amber/gold text (#fbbf24) - via `classname.includes('current')`
- Next lifter: Orange text (#f97316) - via `classname.includes('next')`

**Spacers:**
- Vertical: 8px black columns between sections
- Horizontal: 8px black rows between teams

### Timer Implementation

**Client-Side Countdown:**
- Timer states: `running` (counts down), `stopped` (shows time), `set` (shows time)
- Uses `Date.now() - timerStartTime` for local calculation
- No SSE traffic during countdown (supports hundreds of browsers)
- Updates every 100ms via `setInterval`

### Font Sizing

- Base table text: 1.1rem (HD-optimized)
- Team header: 1.6rem
- Header elements: 1.5rem (athlete name, team, attempt label, start number)
- Responsive: All units in rem/em except fixed 8px spacers and 1px borders

## Files

- **config.js** - Metadata and user-configurable options
- **helpers.data.js** - Server-side data processing (groups athletes by team, calculates team scores)
- **page.svelte** - Display component (18-column table with team grouping, client-side timer)

## URL Parameters

- `fop` (required) - FOP name (e.g., `Platform_A`)
- `gender` (optional) - Filter by gender: `M`, `F`, or `MF` (default: `MF`)
- `topN` (optional) - Show only top N men and top N women per team (default: 0 = show all)
- `currentAttemptInfo` (optional) - Show current attempt info bar (true/false, default: false)

Examples:
```
/nvf-lagkonkurranse?fop=Platform_A
/nvf-lagkonkurranse?fop=Platform_A&gender=M
/nvf-lagkonkurranse?fop=Platform_A&topN=3
```

## Data Processing

### Team Scoring

Teams are ranked by total score (sum of athlete scores):
1. If athlete has `globalScore`, use that
2. Otherwise, use `sinclair` coefficient score
3. Sum all athlete scores in team to get team score

### Team Sorting

Teams are sorted by team score (highest first).

### Data Sources

**Session Athletes** (current lifting group):
- From OWLCMS WebSocket `type="update"` message
- Contains precomputed data: attempts with `liftStatus` and `stringValue`
- Includes `classname` field for highlighting ("current", "next", "NONE")

**Database Athletes** (all competition athletes):
- From OWLCMS WebSocket `type="database"` message
- Includes athletes from all sessions
- Raw attempt data (declaration/change/actualLift)
- Used for athletes NOT in current session

### Merging Strategy

1. Start with all session athletes (they have computed fields)
2. Add database athletes that are NOT in current session
3. Filter by gender if specified
4. Group by team
5. Calculate team totals and scores
6. Sort teams by score

## Key Features to Replicate for Variations

### 1. Team Grouping (OWLCMS-Style)
```svelte
{#each teams as team}
  <div class="team-header">
    {team.teamName} ({team.athleteCount} athletes) - Score: {team.teamScore}
  </div>
  {#each team.athletes as athlete}
    <!-- athlete row -->
  {/each}
{/each}
```

### 2. Client-Side Timer Countdown
```javascript
let timerStartTime = null;
let timerInitialRemaining = 0;
let lastTimerState = null;

function syncTimer(timerData) {
  if (timerData.state !== lastTimerState) {
    timerStartTime = null;
    lastTimerState = timerData.state;
  }
}

function updateTimer() {
  if (timerStartTime === null && timerData.state === 'running') {
    timerStartTime = Date.now();
    timerInitialRemaining = timerData.timeRemaining;
  }
  
  const elapsed = Date.now() - timerStartTime;
  const remaining = Math.max(0, timerInitialRemaining - elapsed);
  const seconds = Math.ceil(remaining / 1000);
  
  return seconds;
}
```

### 3. Team Header Styling
```svelte
<!-- Team header row with flag and stats -->
<div class="team-header">
  <img src={team.flagUrl} alt={team.teamName} class="team-flag" />
  <span class="team-name">{team.teamName}</span>
  <span class="team-stats">{team.athleteCount} athletes</span>
  <span class="team-score">{team.teamScore.toFixed(2)}</span>
</div>
```

## Customization

To modify this scoreboard for different competition types:

1. **Update config.js** to add new options (e.g., number of counting athletes, scoring method)
2. **Update helpers.data.js** to change team scoring logic or data processing
3. **Update page.svelte** to change the display layout or styling

## Cache Performance

The scoreboard implements plugin-level caching to avoid recomputing team data on every browser request:

- **Cache key**: FOP name + athlete data hash + gender + topN + sortBy
- **Cache hit**: Same FOP/gender/options → instant response
- **Cache miss**: New athlete data → recompute once, serve hundreds of browsers
- **Timer events**: Hit cache (data unchanged) → very fast
- **Automatic cleanup**: Keeps last 3 cache entries to prevent memory bloat

## Related Scoreboards

- **team-scoreboard** - Generic team scoreboard (same layout, different configuration)
- **session-results** - Current session athletes in standard order
- **lifting-order** - Future lifting order

## License

Same as parent OWLCMS Tracker project.
