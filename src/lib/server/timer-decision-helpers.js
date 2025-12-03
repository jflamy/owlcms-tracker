/**
 * Shared timer and decision state extraction helpers
 * Used by all scoreboards for consistent timer/break/decision handling
 */

// =============================================================================
// TIMER AND DECISION EXTRACTION
// =============================================================================

/**
 * Extract both athlete and break timers from a FOP update.
 * Returns { timer, breakTimer } where each object contains:
 * { type: 'athlete'|'break', state: 'running'|'set'|'stopped', isActive, visible, timeRemaining, duration, startTime, displayText }
 * 
 * @param {Object} fopUpdate - The FOP update object from competition hub
 * @param {string} language - Language code for break text (e.g., 'nb' for Norwegian Bokmål)
 * @returns {Object} { timer, breakTimer }
 */
export function extractTimers(fopUpdate, language = 'en') {
	const athleteEvent = fopUpdate?.athleteTimerEventType;
	const athleteTimeRemaining = parseInt(fopUpdate?.athleteMillisRemaining || 0);

	// Athlete timer state - simple mapping
	const athleteState = athleteEvent === 'StartTime' ? 'running' : 
	                     athleteEvent === 'StopTime' ? 'stopped' : 
	                     athleteEvent === 'SetTime' ? 'set' : 
	                     (athleteEvent ? String(athleteEvent).toLowerCase() : 'stopped');
	
	const athleteTimer = {
		type: 'athlete',
		state: athleteState,
		isActive: Boolean(athleteEvent || athleteTimeRemaining > 0),
		visible: Boolean(athleteEvent || athleteTimeRemaining > 0),
		timeRemaining: athleteTimeRemaining,
		duration: fopUpdate?.timeAllowed ? parseInt(fopUpdate.timeAllowed) : 60000,
		startTime: null
	};

	// Break timer state
	const breakEvent = fopUpdate?.breakTimerEventType;
	const breakRemainingReported = parseInt(fopUpdate?.breakMillisRemaining || 0);
	const breakStartMillisReported = parseInt(fopUpdate?.breakStartTimeMillis || fopUpdate?.breakStartTime || 0);
	const decisionEvent = Boolean(fopUpdate?.decisionEventType || fopUpdate?.decisionsVisible === 'true' || fopUpdate?.down === 'true');
	const fopState = String(fopUpdate?.fopState || '').toUpperCase();
	const mode = String(fopUpdate?.mode || '').toUpperCase();

	const normBreakEvent = (breakEvent || '').toString().toLowerCase();
	const breakPaused = normBreakEvent.includes('pause') || normBreakEvent === 'breakpaused';

	// If athlete timer starts, we exit break state
	const athleteTimerStarting = athleteEvent === 'StartTime';

	// Determine if we're in a break state:
	// - fopState === 'BREAK' means we're in a break
	// - breakTimerEventType with 'start' or 'breakstarted' means break started
	// - If explicitly paused, we're NOT in break state
	// - If athlete timer starts, we're NOT in break state anymore
	// - During SESSION_DONE, we're always in break state (ignore athlete timer)
	const isSessionDone = mode === 'SESSION_DONE';
	const inBreakState = !breakPaused && !athleteTimerStarting && (fopState === 'BREAK' || normBreakEvent.includes('start') || normBreakEvent === 'breakstarted' || isSessionDone);

	// Compute remaining milliseconds using reported timing data
	let computedBreakRemaining = 0;
	let breakDisplayText = null;  // Text to display instead of time (e.g., "STOP" / "STOPP")

	// Check if this is an INTERRUPTION mode break
	if (mode === 'INTERRUPTION' && inBreakState) {
		// Compute display text based on language
		breakDisplayText = language === 'no' ? 'STOPP' : 'STOP';
	} else if (inBreakState) {
		// Normal break with countdown
		if (breakRemainingReported > 0 && breakStartMillisReported > 0) {
			// We have current timing: compute remaining based on start + duration
			const expectedEnd = breakStartMillisReported + breakRemainingReported;
			const now = Date.now();
			computedBreakRemaining = Math.max(0, expectedEnd - now);
		} else if (!breakRemainingReported && breakStartMillisReported > 0) {
			// We have persisted start time but no remaining duration reported
			// Estimate: assume 600000ms (10 minutes) duration
			const now = Date.now();
			const elapsed = now - breakStartMillisReported;
			const assumedDuration = 600000;
			computedBreakRemaining = Math.max(0, assumedDuration - elapsed);
		}
		// Otherwise computedBreakRemaining stays 0 (no timing data available)
	}

	const breakTimer = {
		type: 'break',
		state: inBreakState ? 'running' : 'stopped',
		isActive: inBreakState,
		visible: isSessionDone ? false : (inBreakState && !decisionEvent),  // During SESSION_DONE, show nothing
		timeRemaining: computedBreakRemaining,    // 0 if no timing data
		duration: breakRemainingReported || parseInt(fopUpdate?.breakTimeAllowed || fopUpdate?.timeAllowed || 600000),
		startTime: breakStartMillisReported || null,
		displayText: breakDisplayText  // "STOP"/"STOPP" for INTERRUPTION mode, null otherwise
	};

	// Update athlete timer visibility: hide during break, show when not in break
	// During SESSION_DONE, also hide athlete timer
	athleteTimer.visible = !isSessionDone && !inBreakState && athleteTimer.isActive;

	return { timer: athleteTimer, breakTimer };
}

/**
 * Compute what should be displayed: decision lights, break timer, athlete timer, or nothing.
 * Returns { displayMode, displayClass, activeTimer } where:
 * - displayMode: 'decision' | 'break' | 'athlete' | 'none'
 * - displayClass: CSS class like 'show-decision', 'show-break', etc.
 * - activeTimer: the timer object that should be displayed (either timer or breakTimer)
 * 
 * @param {Object} timer - Athlete timer from extractTimers()
 * @param {Object} breakTimer - Break timer from extractTimers()
 * @param {Object} decision - Decision state from extractDecisionState()
 * @returns {Object} { displayMode, displayClass, activeTimer }
 */
export function computeDisplayMode(timer, breakTimer, decision) {
	const decisionPresent = Boolean(decision?.visible);
	
	// Priority: decision > break timer > athlete timer > nothing
	let displayMode = decisionPresent ? 'decision' : 
	                  (breakTimer?.visible ? 'break' : 
	                  (timer?.visible ? 'athlete' : 'none'));
	
	// Defensive rule: if break timer is actively running and there's no visible decision,
	// prefer the break display even if other flags are inconsistent (protect against stale flags)
	if (!decisionPresent && breakTimer && breakTimer.state === 'running') {
		displayMode = 'break';
		// Ensure visibility flags align with forced display mode
		try {
			if (breakTimer) breakTimer.visible = true;
			if (timer) timer.visible = false;
		} catch (e) {
			// ignore immaterial errors modifying timer objects
		}
	}
	
	const displayClass = `show-${displayMode}`;
	const activeTimer = displayMode === 'break' ? breakTimer : timer;
	
	return { displayMode, displayClass, activeTimer };
}

/**
 * Extract decision state from FOP update
 * 
 * @param {Object} fopUpdate - The FOP update object from competition hub
 * @returns {Object} Decision state with visible, type, referee decisions, etc.
 */
export function extractDecisionState(fopUpdate) {
	const eventType = fopUpdate?.athleteTimerEventType;
	const mode = String(fopUpdate?.mode || '').toUpperCase();
	const isSessionDone = mode === 'SESSION_DONE';
	
	if (eventType === 'StartTime' || isSessionDone) {
		return {
			visible: false, type: null, isSingleReferee: false,
			ref1: null, ref2: null, ref3: null, down: false
		};
	}

	const isVisible = fopUpdate?.decisionsVisible === 'true' ||
					  fopUpdate?.decisionEventType === 'FULL_DECISION' ||
					  fopUpdate?.down === 'true';
	const isSingleReferee = fopUpdate?.singleReferee === 'true' || fopUpdate?.singleReferee === true;

	const mapDecision = (value) => {
		if (value === 'true') return 'good';
		if (value === 'false') return 'bad';
		return null;
	};

	const isDownOnly = fopUpdate?.down === 'true' && fopUpdate?.decisionEventType !== 'FULL_DECISION';

	return {
		visible: Boolean(isVisible),
		type: fopUpdate?.decisionEventType || null,
		isSingleReferee,
		ref1: isDownOnly ? null : mapDecision(fopUpdate?.d1),
		ref2: isDownOnly ? null : mapDecision(fopUpdate?.d2),
		ref3: isDownOnly ? null : mapDecision(fopUpdate?.d3),
		down: fopUpdate?.down === 'true'
	};
}

/**
 * Convenience function to extract all timer/decision state at once
 * 
 * @param {Object} fopUpdate - The FOP update object from competition hub
 * @param {string} language - Language code for break text
 * @returns {Object} { timer, breakTimer, decision, displayMode, activeTimer }
 */
export function extractTimerAndDecisionState(fopUpdate, language = 'en') {
	const { timer, breakTimer } = extractTimers(fopUpdate, language);
	const decision = extractDecisionState(fopUpdate);
	const { displayMode, displayClass, activeTimer } = computeDisplayMode(timer, breakTimer, decision);
	
	return {
		timer,
		breakTimer,
		decision,
		displayMode,
		displayClass,
		activeTimer
	};
}
