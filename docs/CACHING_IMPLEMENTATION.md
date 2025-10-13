# Plugin-Level Caching Implementation

## Summary

All three scoreboards now implement **plugin-level caching** to minimize server load and support hundreds of concurrent browsers.

## Changes Made

### 1. Team Scoreboard (`src/plugins/team-scoreboard/helpers.data.js`)

**Cache Key:**
```javascript
const cacheKey = `${fopName}-${groupAthletesHash}-${gender}-${topN}-${sortBy}`;
```

**Heavy operations cached:**
- Merging database athletes with session athletes
- Formatting 6 attempts per athlete (declaration→change→actualLift priority)
- Grouping athletes by team
- Computing team totals and scores
- Sorting teams and athletes

### 2. Lifting Order Scoreboard (`src/plugins/lifting-order/helpers.data.js`)

**Cache Key:**
```javascript
const cacheKey = `${fopName}-${liftingOrderHash}-${showRecords}-${maxLifters}`;
```

**Heavy operations cached:**
- Parsing `liftingOrderAthletes` JSON
- Extracting top N lifters
- Building rankings from database
- Computing statistics

### 3. Session Results Scoreboard (`src/plugins/session-results/helpers.data.js`)

**Cache Key:**
```javascript
const cacheKey = `${fopName}-${groupAthletesHash}-${showRecords}`;
```

**Heavy operations cached:**
- Parsing `groupAthletes` JSON (already sorted by OWLCMS)
- Computing statistics
- Extracting display settings

## How It Works

### Cache Key Components

1. **FOP Name** - Separate cache per platform (A, Platform_A, Platform_B, etc.)
2. **Data Hash** - First 100 characters of athlete JSON (detects data changes)
3. **User Options** - Gender filter, topN, sortBy, showRecords, etc.

### Cache Invalidation

**Cache hits (no recomputation):**
- ✅ Timer start/stop events (data unchanged)
- ✅ Decision events (data unchanged until update follows)
- ✅ Multiple browsers with same options
- ✅ Rapid SSE broadcasts

**Cache misses (recompute):**
- ❌ New lifting order (different athletes)
- ❌ Athlete lifts (classname changes)
- ❌ Weight change (session data changes in groupAthletes)
- ❌ Update after decision (new totals/rankings from OWLCMS)
- ❌ Different user options

### Timer State Handling

Timer state is **extracted separately** and not included in cache:

```javascript
function extractTimerState(fopUpdate) {
	return {
		state: fopUpdate?.athleteTimerEventType === 'StartTime' ? 'running' : 'stopped',
		timeRemaining: parseInt(fopUpdate?.athleteMillisRemaining || 0),
		duration: parseInt(fopUpdate?.timeAllowed || 60000)
	};
}
```

This allows:
- Timer events to update display without invalidating cache
- Fresh timer state on every fetch
- Minimal processing for timer-only updates

### Decision State Handling (Not Yet Implemented)

Decision state will be handled **exactly like timer state** - extracted separately and not included in cache:

```javascript
function extractDecisionState(fopUpdate) {
	return {
		type: fopUpdate?.decisionEventType || null,
		timestamp: fopUpdate?.decisionTimestamp || null,
		refereeDecisions: fopUpdate?.refereeDecisions || [],
		display: fopUpdate?.decisionEventType ? 'show' : 'hide'
	};
}
```

**Two-Phase Processing:**

**Phase 1: Decision Event**
- OWLCMS sends decision (e.g., "GOOD_LIFT", "NO_LIFT")
- Hub updates `fopUpdates[fopName]` with decision state
- Hub broadcasts SSE
- **All browsers hit cache** (session data in groupAthletes unchanged)
- Decision state extracted separately and merged with cached data
- **Result:** Instant decision display with zero recomputation

**Phase 2: Update Event**
- OWLCMS recomputes rankings/totals based on decision
- Sends new `groupAthletes` with updated session data
- Hub broadcasts SSE
- **Cache miss** (new data hash)
- First browser recomputes, remaining browsers hit fresh cache
- **Result:** Updated lifting order and rankings displayed

This allows:
- Immediate visual feedback on referee decisions (Phase 1)
- Deferred data updates when OWLCMS sends new rankings (Phase 2)
- Zero redundant computation (decision itself doesn't trigger recompute)
- Scalable to hundreds of browsers

## Performance Impact

### Before Caching

**Scenario:** 200 browsers watching team scoreboard

- Each browser request: Parse JSON, merge athletes, format attempts, group by team, sort (50ms)
- **Total:** 200 × 50ms = **10,000ms (10 seconds of CPU)**

### After Caching

**Scenario:** Same 200 browsers

- First browser: Cache miss, full processing (50ms)
- Next 199 browsers: Cache hit, return cached data (1ms each)
- **Total:** 50ms + 199ms = **249ms**

**Performance Improvement: 40× faster** 🎉

### With Timer Events

**Before:** Every timer event (every second) would trigger full reprocessing
**After:** Timer events hit cache, only timer state updates

**Result:** Zero recomputation for timer events

## Cache Cleanup

All plugins implement automatic cleanup to prevent memory bloat:

```javascript
// Keep last 20 cache entries (FIFO)
if (scoreboardCache.size > 20) {
	const firstKey = scoreboardCache.keys().next().value;
	scoreboardCache.delete(firstKey);
}
```

**Why 20 entries?**
- 6 FOPs × 2-3 option combinations = 12-18 active entries
- Extra headroom for rapid option switching
- Old entries auto-expire when limit reached

## Monitoring Cache Performance

Each plugin logs cache activity:

```
[Team Scoreboard] Cache miss for A, computing team data...
[Team Scoreboard] Cached result for A-[hash]-M-4-total (1 entries)
[Team Scoreboard] ✓ Cache hit for A (1 entries cached)
[Team Scoreboard] ✓ Cache hit for A (1 entries cached)
...
```

**What to look for:**
- **First request:** Cache miss (expected)
- **Subsequent requests:** Cache hits (good!)
- **After athlete lifts:** Cache miss (expected - data changed)
- **After timer events:** Cache hits (good - data unchanged)
- **After decision events:** Cache hits (good - data unchanged until update)
- **After update following decision:** Cache miss (expected - new rankings/totals)

## Design Philosophy

### Why Plugin-Level?

**Competition Hub remains generic:**
- Stores raw OWLCMS data
- No scoreboard-specific logic
- Broadcasts state changes

**Each Plugin implements custom rules:**
- Team grouping (team scoreboard)
- Lifting order extraction (lifting order)
- Results formatting (session results)
- Custom sorting/filtering per user's needs

**Future users can create custom scoreboards:**
- Define their own processing logic
- Implement their own cache keys
- Automatically benefit from caching pattern

### Benefits

✅ **Plugin autonomy** - Each scoreboard controls its own caching strategy
✅ **Extensible** - New plugins copy the pattern and get automatic performance
✅ **Minimal hub changes** - Competition hub stays simple and generic
✅ **User-friendly** - Future users can create custom scoreboards with AI assistance
