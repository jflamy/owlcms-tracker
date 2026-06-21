/**
 * Reusable timer logic for scoreboards
 * Handles client-side countdown with server sync
 */

function parseTimerMillis(value) {
	if (value === undefined || value === null || value === '') {
		return null;
	}
	const parsed = parseInt(value, 10);
	return Number.isNaN(parsed) ? null : parsed;
}

export function getAthleteWarningThresholds(timerData) {
	const duration = parseTimerMillis(timerData?.duration ?? timerData?.timeAllowed);
	const explicitInitial = parseTimerMillis(timerData?.initialWarningMillis ?? timerData?.athleteInitialWarningMillis);
	const explicitFinal = parseTimerMillis(timerData?.finalWarningMillis ?? timerData?.athleteFinalWarningMillis);

	if (explicitInitial !== null || explicitFinal !== null) {
		return {
			initialWarningMillis: explicitInitial ?? -1,
			finalWarningMillis: explicitFinal ?? -1
		};
	}

	if (duration === 120000) {
		return { initialWarningMillis: 90000, finalWarningMillis: 30000 };
	}

	if (duration === 60000) {
		return { initialWarningMillis: -1, finalWarningMillis: 30000 };
	}

	return { initialWarningMillis: -1, finalWarningMillis: -1 };
}

export function getTimerWarningThresholdMillis(timerData, defaultMillis = 30000) {
	const explicitFinal = parseTimerMillis(timerData?.finalWarningMillis ?? timerData?.athleteFinalWarningMillis);
	if (explicitFinal !== null) {
		return explicitFinal;
	}

	const athleteThresholds = getAthleteWarningThresholds(timerData);
	if (athleteThresholds.finalWarningMillis >= 0) {
		return athleteThresholds.finalWarningMillis;
	}

	return defaultMillis;
}

export function isTimerInWarning(timerData, remainingMillis, defaultMillis = 30000) {
	const warningThresholdMillis = getTimerWarningThresholdMillis(timerData, defaultMillis);
	return warningThresholdMillis >= 0 && remainingMillis > 0 && remainingMillis <= warningThresholdMillis;
}

/**
 * Creates a timer state manager
 * @returns {Object} Timer manager with state and methods
 */
export function createTimer() {
	let timerSeconds = 0;
	let timerInterval = null;
	let timerStartTime = null; // When timer was started (client time)
	let timerInitialRemaining = 0; // Initial time remaining from server
	let currentTimerData = null;
	let lastTimerState = null; // Track last known timer state to detect changes
	let subscribers = [];

	/**
	 * Update timer display - countdown from start time
	 * @param {Object} timerData - { state: 'running'|'stopped'|'set', timeRemaining: ms }
	 */
	function updateTimer(timerData) {
		if (!timerData) {
			currentTimerData = null;
			timerStartTime = null;
			timerInitialRemaining = 0;
			timerSeconds = 0;
			notifySubscribers();
			return;
		}

		currentTimerData = timerData;

		// If timer is stopped, show the time without counting down
		if (timerData.state === 'stopped') {
			timerStartTime = null;
			timerInitialRemaining = 0;
			// Clamp negative values to 0 (time expired)
			timerSeconds = Math.max(0, Math.ceil((timerData.timeRemaining || 0) / 1000));
			notifySubscribers();
			return;
		}

		// If timer is set (but not running), show the time without counting down
		if (timerData.state === 'set') {
			timerStartTime = null;
			timerInitialRemaining = 0;
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
				timerInitialRemaining = Math.max(0, timerData.timeRemaining || timerData.duration || 0);
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

		const currentState = `${timerData.state}-${timerData.timeRemaining}-${timerData.duration ?? timerData.timeAllowed ?? ''}-${timerData.initialWarningMillis ?? timerData.athleteInitialWarningMillis ?? ''}-${timerData.finalWarningMillis ?? timerData.athleteFinalWarningMillis ?? ''}`;
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
		currentTimerData = null;
		timerStartTime = null;
		timerInitialRemaining = 0;
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
		subscribers.forEach(callback => callback(state));
	}

	/**
	 * Get current timer state
	 * @returns {Object} Current state
	 */
	function getState() {
		const isRunning = timerStartTime !== null && timerSeconds > 0;
		const remainingMillis = timerSeconds > 0 ? timerSeconds * 1000 : 0;
		const isWarning = isTimerInWarning(currentTimerData, remainingMillis);
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
