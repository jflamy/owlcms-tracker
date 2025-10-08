<script>
	import { onMount, onDestroy } from 'svelte';
	
	// Props
	export let timerData = null; // { state: 'running'|'stopped'|'set', timeRemaining: ms, duration: ms }
	export let onTimerUpdate = null; // Optional callback when timer changes
	
	// Timer state
	let timerSeconds = 0;
	let timerInterval;
	let timerStartTime = null; // When timer was started (client time)
	let timerInitialRemaining = 0; // Initial time remaining from server
	let lastTimerState = null; // Track last known timer state to detect changes
	
	// Derived state for styling
	export let isRunning = false;
	export let isWarning = false;
	export let timerDisplay = '0:00';
	
	// Update timer display - countdown from start time
	function updateTimer() {
		if (!timerData) {
			timerSeconds = 0;
			isRunning = false;
			isWarning = false;
			timerDisplay = '0:00';
			return;
		}
		
		// If timer is stopped, show the time without counting down
		if (timerData.state === 'stopped') {
			timerSeconds = Math.ceil((timerData.timeRemaining || 0) / 1000);
			isRunning = false;
		}
		// If timer is set (but not running), show the time without counting down
		else if (timerData.state === 'set') {
			timerSeconds = Math.ceil((timerData.timeRemaining || 0) / 1000);
			isRunning = false;
		}
		// Timer is running - count down
		else if (timerData.state === 'running') {
			// If timer just started, record the start time
			if (timerStartTime === null) {
				timerStartTime = Date.now();
				timerInitialRemaining = timerData.timeRemaining || 60000;
			}
			
			// Calculate elapsed time and remaining time (client-side only, no server needed)
			const elapsed = Date.now() - timerStartTime;
			const remaining = Math.max(0, timerInitialRemaining - elapsed);
			timerSeconds = Math.ceil(remaining / 1000);
			isRunning = timerSeconds > 0;
		}
		
		// Update derived state
		isWarning = timerSeconds > 0 && timerSeconds <= 30;
		timerDisplay = Math.floor(timerSeconds / 60) + ':' + String(timerSeconds % 60).padStart(2, '0');
		
		// Call optional callback
		if (onTimerUpdate) {
			onTimerUpdate({ seconds: timerSeconds, isRunning, isWarning, display: timerDisplay });
		}
	}
	
	// Watch for timer state changes
	$: if (timerData) {
		const currentState = `${timerData.state}-${timerData.timeRemaining}`;
		if (currentState !== lastTimerState) {
			lastTimerState = currentState;
			
			// Timer state changed - reset start time to force sync with server
			timerStartTime = null; // Always reset to resync with server time
			
			updateTimer();
		}
	}
	
	onMount(() => {
		// Update timer every 100ms
		timerInterval = setInterval(updateTimer, 100);
		updateTimer(); // Initial update
	});
	
	onDestroy(() => {
		if (timerInterval) clearInterval(timerInterval);
	});
</script>

<slot {timerSeconds} {isRunning} {isWarning} {timerDisplay} />
