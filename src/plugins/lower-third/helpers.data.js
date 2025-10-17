import { competitionHub } from '$lib/server/competition-hub.js';
import { getFlagUrl } from '$lib/server/flag-resolver.js';

/**
 * Lower Third Minimal Status Scoreboard - Server-side data processing
 * 
 * Provides minimal overlay data for live video streaming:
 * - Current athlete name and requested weight
 * - Timer countdown (only when running)
 * - Decision lights (when visible)
 * 
 * @param {string} fopName - Field of Play name (e.g., 'A', 'Platform_A')
 * @param {Object} options - Display options from URL query parameters
 * @returns {Object} Processed scoreboard data
 */

/**
 * Extract timer state from FOP update
 * Timer visibility rules:
 * - Show when SetTime or StartTime is received
 * - Hide ONLY when StopTime is received while timer is running
 * - SetTime after StopTime makes timer visible again
 * - On page load, initialize from current timer event type
 */
let isTimerActive = null; // null = uninitialized, true = visible, false = hidden
let isTimerRunning = false; // Track if timer is counting down

function extractTimerState(fopUpdate) {
	const eventType = fopUpdate?.athleteTimerEventType;
	const timeRemaining = parseInt(fopUpdate?.athleteMillisRemaining || 0);
	
	// Initialize state on first call from current fopUpdate data
	if (isTimerActive === null) {
		if (eventType === 'StartTime') {
			isTimerActive = true;
			isTimerRunning = true;
		} else if (eventType === 'SetTime') {
			isTimerActive = true;
			isTimerRunning = false;
		} else if (eventType === 'StopTime') {
			isTimerActive = false;
			isTimerRunning = false;
		} else if (timeRemaining > 0) {
			// Has time but no event - assume timer is set
			isTimerActive = true;
			isTimerRunning = false;
		} else {
			// No timer data at all
			isTimerActive = false;
			isTimerRunning = false;
		}
	}
	
	// State machine for timer visibility and running state
	if (eventType === 'SetTime') {
		// Timer loaded - make it active (even after being stopped)
		isTimerActive = true;
		isTimerRunning = false;
	} else if (eventType === 'StartTime') {
		// Timer started - active and running
		isTimerActive = true;
		isTimerRunning = true;
	} else if (eventType === 'StopTime' && isTimerRunning) {
		// StopTime while running - hide timer (lift completed)
		isTimerActive = false;
		isTimerRunning = false;
	} else if (eventType === 'StopTime' && !isTimerRunning) {
		// StopTime while not running - acts like SetTime (OWLCMS uses this to set timer)
		isTimerActive = true;
		isTimerRunning = false;
	}
	// If no event, preserve state
	
	// Determine display state
	let state = 'stopped';
	if (isTimerActive && isTimerRunning) {
		state = 'running';
	} else if (isTimerActive) {
		state = 'set';
	}
	
	return {
		state,
		timeRemaining,
		duration: parseInt(fopUpdate?.timeAllowed || 60000)
	};
}

/**
 * Extract decision state from FOP update
 */
function extractDecisionState(fopUpdate) {
	// Decision is visible when decisionsVisible is true or decisionEventType indicates display
	const isVisible = fopUpdate?.decisionsVisible === 'true' || 
	                  fopUpdate?.decisionEventType === 'FULL_DECISION';
	
	// Check for explicit single-referee flag from OWLCMS
	const isSingleReferee = fopUpdate?.singleReferee === 'true' || 
	                        fopUpdate?.singleReferee === true;
	
	return {
		visible: isVisible,
		type: fopUpdate?.decisionEventType || null,
		isSingleReferee,
		ref1: fopUpdate?.d1 === 'true' ? 'good' : fopUpdate?.d1 === 'false' ? 'bad' : null,
		ref2: fopUpdate?.d2 === 'true' ? 'good' : fopUpdate?.d2 === 'false' ? 'bad' : null,
		ref3: fopUpdate?.d3 === 'true' ? 'good' : fopUpdate?.d3 === 'false' ? 'bad' : null,
		down: fopUpdate?.down === 'true'
	};
}

export function getScoreboardData(fopName = 'A', options = {}) {
	const fopUpdate = competitionHub.getFopUpdate(fopName);
	const databaseState = competitionHub.getDatabaseState();
	const sessionStatus = competitionHub.getSessionStatus(fopName);
	const learningMode = process.env.LEARNING_MODE === 'true';

	// Parse options
	const position = options.position || 'bottom-right';
	const fontSize = options.fontSize || 'medium';

	// If no data yet, return waiting state
	if (!fopUpdate && !databaseState) {
		return {
			competition: { name: 'Waiting for data...', fop: fopName },
			currentAthleteInfo: null,
			timer: { state: 'stopped', timeRemaining: 0 },
			decision: { visible: false },
			sessionStatus: { isDone: false, groupName: '', lastActivity: 0 },
			status: 'waiting',
			options: { position, fontSize }
		};
	}

	// Extract competition info
	const competition = {
		name: fopUpdate?.competitionName || databaseState?.competition?.name || 'Competition',
		fop: fopName
	};

	// Extract current athlete info
	let currentAthleteInfo = null;
	if (fopUpdate?.fullName && !sessionStatus.isDone) {
		// Clean HTML entities
		const cleanFullName = (fopUpdate.fullName || '').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—');
		
		currentAthleteInfo = {
			fullName: cleanFullName,
			teamName: fopUpdate.teamName || '',
			flagUrl: getFlagUrl(fopUpdate.teamName),
			weight: fopUpdate.weight || '',
			attemptNumber: fopUpdate.attemptNumber || '',
			liftType: fopUpdate.attemptNumber ? 
			          (parseInt(fopUpdate.attemptNumber) <= 3 ? 'Snatch' : 'Clean & Jerk') : ''
		};
	}

	// Extract timer and decision states
	const timer = extractTimerState(fopUpdate);
	const decision = extractDecisionState(fopUpdate);

	return {
		competition,
		currentAthleteInfo,
		timer,
		decision,
		sessionStatus,
		status: 'ready',
		options: { position, fontSize }
	};
}
