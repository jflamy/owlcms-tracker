/**
 * Display Switcher - Server-side State Machine & SSE Emitter
 * 
 * Listens to tracker-core events and emits display commands via SSE.
 * 
 * Event Flow:
 * 1. tracker-core emits DECISION/TIMER/BREAK events
 * 2. helpers.data.js processes events, updates state machine
 * 3. Emits SSE commands to display page (showIframe/showVideo)
 * 4. Display page reacts immediately (no API calls)
 * 
 * State Machine:
 * - SCOREBOARD: Showing OWLCMS scoreboard via iframe
 * - GOOD_LIFT_VIDEO: Playing good lift celebration video
 * - BAD_LIFT_VIDEO: Playing bad lift video
 * - REPLAY: Showing replay from replay server
 * - BREAK_VIDEO: Playing break playlist video
 * - MANUAL: Operator has taken manual control
 */

import pluginConfig from './config.js';
import { competitionHub } from '$lib/server/competition-hub.js';
import { sseBroker } from '$lib/server/sse-broker.js';

// Display states
export const DisplayState = {
	SCOREBOARD: 'scoreboard',
	GOOD_LIFT_VIDEO: 'good_lift_video',
	BAD_LIFT_VIDEO: 'bad_lift_video',
	REPLAY: 'replay',
	BREAK_VIDEO: 'break_video',
	MANUAL: 'manual'
};

// Per-FOP state storage
const fopStates = new Map();

/**
 * Get or create state for a FOP
 */
function getFopState(fopName) {
	if (!fopStates.has(fopName)) {
		// Build default config from plugin config.js
		const defaultConfig = {};
		for (const option of pluginConfig.options) {
			defaultConfig[option.key] = option.default;
		}
		
		fopStates.set(fopName, {
			currentState: DisplayState.SCOREBOARD,
			automationEnabled: true,
			currentUrl: null,
			currentType: 'iframe', // 'iframe' or 'video'
			pendingTimeout: null,
			config: defaultConfig,
			breakPlaylistIndex: 0,
			lastDecision: null,
			lastUpdate: Date.now()
		});
	}
	return fopStates.get(fopName);
}

/**
 * Emit a display command via SSE
 */
function emitDisplayCommand(fopName, command) {
	const message = {
		type: 'display_command',
		fop: fopName,
		command: command.type, // 'showIframe' or 'showVideo'
		url: command.url,
		state: command.state,
		timestamp: Date.now()
	};
	
	console.log(`[DisplaySwitcher] Emitting ${command.type} for FOP ${fopName}: ${command.url}`);
	sseBroker.broadcast(message);
}

/**
 * Emit current display state via SSE (for control mode only)
 */
function emitDisplayState(fopName) {
	const state = getFopState(fopName);
	sseBroker.broadcast({
		type: 'display_state',
		fop: fopName,
		automationEnabled: state.automationEnabled,
		currentState: state.currentState,
		currentType: state.currentType,
		currentUrl: state.currentUrl,
		lastUpdate: state.lastUpdate,
		timestamp: Date.now()
	});
}

/**
 * Normalize a configured scoreboard path to a clean /path?query form
 * - Strips protocol/host if a full URL is provided
 * - Strips leading /proxy if present
 * - Ensures leading slash
 */
function normalizeScoreboardPath(rawPath) {
	let path = rawPath || '';

	// Convert full URL to path if needed
	if (/^https?:\/\//i.test(path)) {
		try {
			const url = new URL(path);
			path = `${url.pathname}${url.search}${url.hash}`;
		} catch (err) {
			// If URL parsing fails, keep original
		}
	}

	// Strip any leading /proxy to avoid double prefix
	if (path.startsWith('/proxy')) {
		path = path.replace(/^\/proxy\/?/, '/');
	}

	// Ensure leading slash
	if (!path.startsWith('/')) {
		path = `/${path}`;
	}

	return path;
}

/**
 * Switch to scoreboard (iframe)
 */
function showScoreboard(fopName) {
	const state = getFopState(fopName);
	clearTimeout(state.pendingTimeout);
	
	let scoreboardPath = normalizeScoreboardPath(state.config.scoreboardPage);
	
	// Replace {FOP} placeholder if present, otherwise append fop parameter
	if (scoreboardPath.includes('{FOP}')) {
		scoreboardPath = scoreboardPath.replace(/\{FOP\}/g, encodeURIComponent(fopName));
	} else {
		// Add fop parameter using & if there are already query params
		const separator = scoreboardPath.includes('?') ? '&' : '?';
		scoreboardPath = `${scoreboardPath}${separator}fop=${encodeURIComponent(fopName)}`;
	}
	
	const scoreboardUrl = `/proxy${scoreboardPath}`;
	
	state.currentState = DisplayState.SCOREBOARD;
	state.currentType = 'iframe';
	state.currentUrl = scoreboardUrl;
	state.lastUpdate = Date.now();
	
	emitDisplayCommand(fopName, {
		type: 'showIframe',
		url: scoreboardUrl,
		state: DisplayState.SCOREBOARD
	});

	emitDisplayState(fopName);
}

/**
 * Show a video, then optionally transition to next state
 */
function showVideo(fopName, videoUrl, nextState, duration) {
	const state = getFopState(fopName);
	clearTimeout(state.pendingTimeout);
	
	if (!videoUrl) {
		// No video configured, skip to next state
		handleNextState(fopName, nextState);
		return;
	}
	
	state.currentType = 'video';
	state.currentUrl = videoUrl;
	state.lastUpdate = Date.now();
	
	emitDisplayCommand(fopName, {
		type: 'showVideo',
		url: videoUrl,
		state: state.currentState
	});

	emitDisplayState(fopName);
	
	// Schedule transition to next state
	if (nextState && duration > 0) {
		state.pendingTimeout = setTimeout(() => {
			handleNextState(fopName, nextState);
		}, duration * 1000);
	}
}

/**
 * Handle transition to next state after video
 */
function handleNextState(fopName, nextState) {
	const state = getFopState(fopName);
	
	switch (nextState) {
		case 'replay':
			if (state.config.replayUrl) {
				state.currentState = DisplayState.REPLAY;
				showVideo(fopName, state.config.replayUrl, 'scoreboard', state.config.replayDuration);
			} else {
				showScoreboard(fopName);
			}
			break;
		case 'scoreboard':
			showScoreboard(fopName);
			break;
		default:
			showScoreboard(fopName);
	}
}

/**
 * Handle DECISION event from tracker-core
 */
function handleDecision(fopName, decision) {
	const state = getFopState(fopName);
	
	// Skip if automation is disabled
	if (!state.automationEnabled) {
		console.log(`[DisplaySwitcher] Automation disabled for FOP ${fopName}, ignoring decision`);
		return;
	}
	
	// Determine if good or bad lift based on referee decisions
	// decision.d1, d2, d3 are "true" or "false" strings
	const refs = [decision.d1, decision.d2, decision.d3];
	const goodCount = refs.filter(d => d === 'true').length;
	const isGoodLift = goodCount >= 2;
	
	state.lastDecision = { isGoodLift, timestamp: Date.now() };
	
	console.log(`[DisplaySwitcher] Decision on FOP ${fopName}: ${isGoodLift ? 'GOOD' : 'BAD'} lift`);
	
	if (isGoodLift) {
		state.currentState = DisplayState.GOOD_LIFT_VIDEO;
		showVideo(fopName, state.config.goodLiftVideo, 'replay', state.config.goodLiftDuration);
	} else {
		state.currentState = DisplayState.BAD_LIFT_VIDEO;
		showVideo(fopName, state.config.badLiftVideo, 'replay', state.config.badLiftDuration);
	}
}

/**
 * Handle TIMER event from tracker-core
 */
function handleTimer(fopName, timer) {
	const state = getFopState(fopName);
	
	// Skip if automation is disabled
	if (!state.automationEnabled) {
		return;
	}
	
	// Timer start → switch to scoreboard immediately
	if (timer.athleteTimerEventType === 'StartTime') {
		console.log(`[DisplaySwitcher] Timer started on FOP ${fopName}, switching to scoreboard`);
		showScoreboard(fopName);
	}
}

/**
 * Handle break start
 */
function handleBreakStart(fopName, breakInfo) {
	const state = getFopState(fopName);
	
	// Skip if automation is disabled
	if (!state.automationEnabled) {
		return;
	}
	
	console.log(`[DisplaySwitcher] Break started on FOP ${fopName}`);
	state.currentState = DisplayState.BREAK_VIDEO;
	state.breakPlaylistIndex = 0;
	
	// Start playing break playlist
	playNextBreakVideo(fopName);
}

/**
 * Play next video in break playlist
 */
function playNextBreakVideo(fopName) {
	const state = getFopState(fopName);
	
	if (state.currentState !== DisplayState.BREAK_VIDEO) {
		return;
	}
	
	const videos = state.config.breakVideos;
	if (!videos || videos.length === 0) {
		// No break videos configured, show scoreboard
		showScoreboard(fopName);
		return;
	}
	
	const videoUrl = videos[state.breakPlaylistIndex];
	state.breakPlaylistIndex = (state.breakPlaylistIndex + 1) % videos.length;
	
	emitDisplayCommand(fopName, {
		type: 'showVideo',
		url: videoUrl,
		state: DisplayState.BREAK_VIDEO
	});
	
	// Note: The display page will notify when video ends to play next
}

// ============================================
// Public API for control UI
// ============================================

/**
 * Pause automation (manual override)
 */
export function pauseAutomation(fopName) {
	const state = getFopState(fopName);
	clearTimeout(state.pendingTimeout);
	state.automationEnabled = false;
	state.currentState = DisplayState.MANUAL;
	state.lastUpdate = Date.now();
	
	console.log(`[DisplaySwitcher] Automation PAUSED for FOP ${fopName}`);
	
	// Notify clients of state change
	emitDisplayState(fopName);
	
	return { success: true, automationEnabled: false };
}

/**
 * Resume automation
 */
export function resumeAutomation(fopName) {
	const state = getFopState(fopName);
	state.automationEnabled = true;
	state.lastUpdate = Date.now();
	
	console.log(`[DisplaySwitcher] Automation RESUMED for FOP ${fopName}`);
	
	// Return to scoreboard
	showScoreboard(fopName);
	
	// Notify clients of state change
	emitDisplayState(fopName);
	
	return { success: true, automationEnabled: true };
}

/**
 * Manually show an iframe (pauses automation)
 */
export function manualShowIframe(fopName, url) {
	const state = getFopState(fopName);
	clearTimeout(state.pendingTimeout);
	state.automationEnabled = false;
	state.currentState = DisplayState.MANUAL;
	state.currentType = 'iframe';
	state.currentUrl = url;
	state.lastUpdate = Date.now();
	
	console.log(`[DisplaySwitcher] Manual iframe for FOP ${fopName}: ${url}`);
	
	emitDisplayCommand(fopName, {
		type: 'showIframe',
		url: url,
		state: DisplayState.MANUAL
	});

	emitDisplayState(fopName);
	
	return { success: true, type: 'iframe', url };
}

/**
 * Manually show a video (pauses automation)
 */
export function manualShowVideo(fopName, url) {
	const state = getFopState(fopName);
	clearTimeout(state.pendingTimeout);
	state.automationEnabled = false;
	state.currentState = DisplayState.MANUAL;
	state.currentType = 'video';
	state.currentUrl = url;
	state.lastUpdate = Date.now();
	
	console.log(`[DisplaySwitcher] Manual video for FOP ${fopName}: ${url}`);
	
	emitDisplayCommand(fopName, {
		type: 'showVideo',
		url: url,
		state: DisplayState.MANUAL
	});

	emitDisplayState(fopName);
	
	return { success: true, type: 'video', url };
}

/**
 * Update configuration for a FOP
 */
export function updateConfig(fopName, newConfig) {
	const state = getFopState(fopName);
	Object.assign(state.config, newConfig);
	state.lastUpdate = Date.now();
	
	console.log(`[DisplaySwitcher] Config updated for FOP ${fopName}`);
	emitDisplayState(fopName);
	
	return { success: true, config: state.config };
}

/**
 * Get current state for a FOP
 */
export function getState(fopName) {
	const state = getFopState(fopName);
	return {
		fopName,
		currentState: state.currentState,
		automationEnabled: state.automationEnabled,
		currentType: state.currentType,
		currentUrl: state.currentUrl,
		config: state.config,
		lastDecision: state.lastDecision,
		lastUpdate: state.lastUpdate
	};
}

/**
 * Get scoreboard data for the page (required by plugin pattern)
 * For display-switcher, this returns minimal data since display is SSE-driven
 */
export function getScoreboardData(fopName = 'A', options = {}) {
	const state = getFopState(fopName);
	
	// Apply any options to config
	if (options.scoreboardPage) state.config.scoreboardPage = options.scoreboardPage;
	if (options.replayUrl) state.config.replayUrl = options.replayUrl;
	if (options.goodLiftVideo) state.config.goodLiftVideo = options.goodLiftVideo;
	if (options.badLiftVideo) state.config.badLiftVideo = options.badLiftVideo;
	if (options.goodLiftDuration) state.config.goodLiftDuration = parseInt(options.goodLiftDuration);
	if (options.badLiftDuration) state.config.badLiftDuration = parseInt(options.badLiftDuration);
	if (options.replayDuration) state.config.replayDuration = parseInt(options.replayDuration);
	
	// Build initial scoreboard URL (normalize path, add FOP param, prepend /proxy)
	let scoreboardPath = normalizeScoreboardPath(state.config.scoreboardPage);
	const separator = scoreboardPath.includes('?') ? '&' : '?';
	const scoreboardUrl = `/proxy${scoreboardPath}${separator}fop=${encodeURIComponent(fopName)}`;
	
	return {
		fopName,
		currentState: state.currentState,
		automationEnabled: state.automationEnabled,
		currentType: state.currentType,
		currentUrl: state.currentUrl || scoreboardUrl,
		initialUrl: scoreboardUrl,
		config: state.config
	};
}

// ============================================
// Attach to tracker-core events
// ============================================

let listenersAttached = false;

export function attachEventListeners() {
	if (listenersAttached) return;
	listenersAttached = true;
	
	console.log('[DisplaySwitcher] Attaching tracker-core event listeners');
	
	// Listen for decision events
	competitionHub.on('decision', (eventData) => {
		const fopName = eventData.fop;
		const decision = eventData.decision;
		
		// Only process FULL_DECISION (when all refs have voted)
		if (decision?.decisionEventType === 'FULL_DECISION') {
			handleDecision(fopName, decision);
		}
	});
	
	// Listen for timer events
	competitionHub.on('timer', (eventData) => {
		const fopName = eventData.fop;
		const timer = eventData.timer;
		handleTimer(fopName, timer);
	});
	
	// Listen for FOP updates (to detect breaks)
	competitionHub.on('fop_update', (eventData) => {
		const fopName = eventData.fop;
		const data = eventData.data;
		
		// Check if break started
		if (data?.break === 'true' && data?.breakType) {
			const state = getFopState(fopName);
			if (state.currentState !== DisplayState.BREAK_VIDEO) {
				handleBreakStart(fopName, { breakType: data.breakType });
			}
		}
	});
}

// Auto-attach listeners when module loads
attachEventListeners();
