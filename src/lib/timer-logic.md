# Timer Logic Module

Reusable timer logic for all scoreboards. Handles client-side countdown with server synchronization.

## Usage

```javascript
import { createTimer } from '$lib/timer-logic.js';
import { onMount, onDestroy } from 'svelte';

let timerState = { seconds: 0, isRunning: false, isWarning: false, display: '0:00' };

// Create timer instance
const timer = createTimer();

// Subscribe to timer updates
const unsubscribe = timer.subscribe(state => {
	timerState = state;
});

// Start timer on mount
onMount(() => {
	timer.start(data.timer); // Pass initial timer data
});

// Clean up on destroy
onDestroy(() => {
	timer.stop();
	unsubscribe();
});

// Sync with server when data changes
$: if (data.timer) {
	timer.syncWithServer(data.timer);
}
```

## Timer State Object

The timer manager provides this state object:

```javascript
{
	seconds: 45,           // Time remaining in seconds
	isRunning: true,       // Whether timer is actively counting down
	isWarning: false,      // True when ≤ 30 seconds remaining
	display: '0:45'        // Formatted display string (M:SS)
}
```

## API

### `createTimer()`

Creates a new timer instance.

**Returns:** Timer manager object

### `timer.start(initialTimerData, intervalMs = 100)`

Start the timer interval. Call this in `onMount()`.

**Parameters:**
- `initialTimerData` - Initial timer data from server: `{ state, timeRemaining, duration }`
- `intervalMs` - Update interval in milliseconds (default: 100)

### `timer.stop()`

Stop the timer interval. Call this in `onDestroy()`.

### `timer.syncWithServer(timerData)`

Sync timer with new data from server. Call this when `data.timer` changes.

**Parameters:**
- `timerData` - Timer data from server: `{ state: 'running'|'stopped'|'set', timeRemaining: ms }`

**Behavior:**
- Detects state changes
- Resets client timer to match server time
- Prevents drift during long countdowns

### `timer.subscribe(callback)`

Subscribe to timer state updates.

**Parameters:**
- `callback` - Function called with timer state on each update

**Returns:** Unsubscribe function

### `timer.getState()`

Get current timer state snapshot.

**Returns:** Timer state object

## How It Works

1. **Server sends timer state** via `/timer` endpoint (StartTime, StopTime, SetTime)
2. **Competition Hub** stores timer data in FOP updates
3. **Scoreboard receives timer data** in `data.timer`
4. **Timer logic syncs with server** on state changes
5. **Client-side countdown** runs independently (no SSE spam)
6. **Subscribers receive updates** every 100ms during countdown

## Benefits

- ✅ **Consistent behavior** across all scoreboards
- ✅ **No code duplication** - timer logic in one place
- ✅ **Server sync** - resets on state changes
- ✅ **Efficient** - client-side countdown, minimal server load
- ✅ **Flexible** - subscribe pattern allows any UI styling

## Example: Lifting Order Scoreboard

```svelte
<script>
	import { createTimer } from '$lib/timer-logic.js';
	import { onMount, onDestroy } from 'svelte';
	
	export let data = {};
	
	let timerState = { display: '0:00', isRunning: false, isWarning: false };
	
	const timer = createTimer();
	const unsubscribe = timer.subscribe(state => { timerState = state; });
	
	onMount(() => timer.start(data.timer));
	onDestroy(() => { timer.stop(); unsubscribe(); });
	
	$: if (data.timer) timer.syncWithServer(data.timer);
</script>

<div class="timer" class:running={timerState.isRunning} class:warning={timerState.isWarning}>
	{timerState.display}
</div>
```

## Future: Decision Logic

Similar pattern can be used for referee decisions:

```javascript
// src/lib/decision-logic.js
export function createDecisionHandler() {
	// Logic for processing referee decisions
	// Unified across all scoreboards
}
```
