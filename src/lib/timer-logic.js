/**
 * Reusable timer logic for scoreboards
 * Handles client-side countdown with server sync
 */

/**
 * Creates a timer state manager
 * @returns {Object} Timer manager with state and methods
 */
export function createTimer() {
	let timerSeconds = 0;
	let timerInterval = null;
	let timerStartTime = null; // When timer was started (client time)
	let timerInitialRemaining = 0; // Initial time remaining from server
	let lastTimerState = null; // Track last known timer state to detect changes
	let lastNotifiedState = null; // Track last notified state to avoid duplicate updates
	let subscribers = [];

	/**
	 * Update timer display - countdown from start time
	 * @param {Object} timerData - { state: 'running'|'stopped'|'set', timeRemaining: ms }
	 */
	function updateTimer(timerData) {
		if (!timerData) {
			timerSeconds = 0;
			notifySubscribers();
			return;
		}

		// If timer is stopped, show the time without counting down
		if (timerData.state === 'stopped') {
			// Clamp negative values to 0 (time expired)
			timerSeconds = Math.max(0, Math.ceil((timerData.timeRemaining || 0) / 1000));
			notifySubscribers();
			return;
		}

		// If timer is set (but not running), show the time without counting down
		if (timerData.state === 'set') {
			// Clamp negative values to 0 (time expired)
			timerSeconds = Math.max(0, Math.ceil((timerData.timeRemaining || 0) / 1000));
			notifySubscribers();
			return;
		}

		// Timer is running - count down
		if (timerData.state === 'running') {
			// If timer just started, record the start time
			if (timerStartTime === null) {
				timerStartTime = Date.now();
				timerInitialRemaining = Math.max(0, timerData.timeRemaining || 60000);
			}

			// Calculate elapsed time and remaining time (client-side only, no server needed)
			const elapsed = Date.now() - timerStartTime;
			const remaining = Math.max(0, timerInitialRemaining - elapsed);
			timerSeconds = Math.ceil(remaining / 1000);
			notifySubscribers();
		}
	}

	/**
	 * Check if timer state has changed and sync with server
	 * @param {Object} timerData - New timer data from server
	 */
	function syncWithServer(timerData) {
		if (!timerData) return;

		const currentState = `${timerData.state}-${timerData.timeRemaining}`;
		if (currentState !== lastTimerState) {
			lastTimerState = currentState;

			// Timer state changed - reset start time to force sync with server
			timerStartTime = null; // Always reset to resync with server time

			console.log(`[Timer] Syncing with server: state=${timerData.state}, timeRemaining=${timerData.timeRemaining}ms`);
			updateTimer(timerData);
		}
	}

	/**
	 * Start the timer interval (call from onMount)
	 * @param {Object} initialTimerData - Initial timer data
	 * @param {number} intervalMs - Update interval in milliseconds (default: 100)
	 */
	function start(initialTimerData, intervalMs = 100) {
		if (timerInterval) return; // Already started

		// Set initial state
		if (initialTimerData) {
			syncWithServer(initialTimerData);
		}

		// Update timer every 100ms
		timerInterval = setInterval(() => {
			if (timerStartTime !== null) {
				// Recalculate during countdown
				const elapsed = Date.now() - timerStartTime;
				const remaining = Math.max(0, timerInitialRemaining - elapsed);
				timerSeconds = Math.ceil(remaining / 1000);
				notifySubscribers();
			}
		}, intervalMs);
	}

	/**
	 * Stop the timer interval (call from onDestroy)
	 */
	function stop() {
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
	}

	/**
	 * Subscribe to timer updates
	 * @param {Function} callback - Called with timer state on updates
	 * @returns {Function} Unsubscribe function
	 */
	function subscribe(callback) {
		subscribers.push(callback);
		// Immediately call with current state
		callback(getState());

		// Return unsubscribe function
		return () => {
			subscribers = subscribers.filter(cb => cb !== callback);
		};
	}

	/**
	 * Notify all subscribers of state change
	 */
	function notifySubscribers() {
		const state = getState();
		
		// Only notify if state actually changed
		const stateKey = `${state.seconds}-${state.isRunning}`;
		const lastKey = lastNotifiedState ? `${lastNotifiedState.seconds}-${lastNotifiedState.isRunning}` : null;
		
		if (stateKey !== lastKey) {
			lastNotifiedState = state;
			subscribers.forEach(callback => callback(state));
		}
	}

	/**
	 * Get current timer state
	 * @returns {Object} Current state
	 */
	function getState() {
		const isRunning = timerStartTime !== null && timerSeconds > 0;
		const isWarning = timerSeconds > 0 && timerSeconds <= 30;
		const timerDisplay = Math.floor(timerSeconds / 60) + ':' + String(timerSeconds % 60).padStart(2, '0');

		return {
			seconds: timerSeconds,
			isRunning,
			isWarning,
			display: timerDisplay
		};
	}

	return {
		start,
		stop,
		syncWithServer,
		subscribe,
		getState
	};
}
