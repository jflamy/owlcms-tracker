import { competitionHub } from '$lib/server/competition-hub.js';
import { getFlagUrl } from '$lib/server/flag-resolver.js';
import { extractTimerAndDecisionState, computeDisplayMode } from '$lib/server/timer-decision-helpers.js';
import { buildCacheKey, registerCache } from '$lib/server/cache-utils.js';

// Plugin cache for lower-third
const lowerThirdCache = new Map();
registerCache(lowerThirdCache);

export function getScoreboardData(fopName = 'A', options = {}) {
	const fopUpdate = competitionHub.getFopUpdate(fopName);
	const databaseState = competitionHub.getDatabaseState();
	const sessionStatus = competitionHub.getSessionStatus(fopName);
	const learningMode = process.env.LEARNING_MODE === 'true';

	// Parse options
	const position = options.position || 'bottom-right';
	const fontSize = options.fontSize || 'medium';

	// Build cache key based on competition data
	const cacheKey = buildCacheKey({ fopName, includeFop: true, opts: { position, fontSize } });

	if (lowerThirdCache.has(cacheKey)) {
		const cached = lowerThirdCache.get(cacheKey);
		// Always compute volatile fields (timer/decision/displayMode) fresh
		const { timer, breakTimer, decision, displayMode } = extractTimerAndDecisionState(fopUpdate, fopName);
		return {
			...cached,
			timer,
			breakTimer,
			decision,
			displayMode,
			sessionStatus,
			learningMode
		};
	}

	// If no data yet, return waiting state
	if (!fopUpdate && !databaseState) {
		return {
		competition: { name: 'Waiting for data...', fop: fopName },
		currentAthleteInfo: null,
		timer: { state: 'stopped', timeRemaining: 0, duration: 60000 },
		breakTimer: { state: 'stopped', timeRemaining: 0, duration: 300000 },
		decision: { visible: false, isSingleReferee: false, ref1: null, ref2: null, ref3: null },
		displayMode: 'none',
		sessionStatus: { isDone: false, sessionName: '', lastActivity: 0 },
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
	
	// During interruption: use the break message from fullName
	if (fopUpdate?.mode === 'INTERRUPTION' && fopUpdate?.fullName) {
		let displayName = fopUpdate.fullName || '';
		// Extract just the message after the ndash (handles both &ndash; and – unicode)
		// First decode HTML entities
		displayName = displayName.replace(/&ndash;/g, '–').replace(/&mdash;/g, '—');
		// Then split on ndash or mdash and take the last part
		const parts = displayName.split(/\s*[–—]\s*/);
		if (parts.length > 1) {
			displayName = parts[parts.length - 1];
		}
		currentAthleteInfo = {
			fullName: displayName,
			teamName: '',
			flagUrl: null,
			weight: '',
			attemptNumber: '',
			liftType: ''
		};
	} else if (fopUpdate?.fullName && !sessionStatus.isDone && fopUpdate?.mode !== 'INTERRUPTION') {
		// Normal mode: use fullName from fopUpdate (athlete info)
		// Only use fullName if mode is NOT interruption (avoid stale jury deliberation text)
		currentAthleteInfo = {
			fullName: fopUpdate.fullName || '',
			teamName: fopUpdate.teamName || '',
			flagUrl: getFlagUrl(fopUpdate.teamName),
			weight: fopUpdate.weight || '',
			attemptNumber: fopUpdate.attemptNumber || '',
			liftType: fopUpdate.attemptNumber ? 
			          (parseInt(fopUpdate.attemptNumber) <= 3 ? 'Snatch' : 'Clean & Jerk') : ''
		};
	}

	// Extract timer, break timer, decision, and display mode using shared helper
	const { timer, breakTimer, decision, displayMode } = extractTimerAndDecisionState(fopUpdate, fopName);

	const result = {
		competition,
		currentAthleteInfo,
		timer,
		breakTimer,
		decision,
		displayMode,
		sessionStatus,
		status: 'ready',
		options: { position, fontSize }
	};

	// Cache result (exclude volatile fields)
	lowerThirdCache.set(cacheKey, {
		competition,
		currentAthleteInfo,
		sessionStatus,
		status: 'ready',
		options: { position, fontSize }
	});

	if (lowerThirdCache.size > 3) {
		const firstKey = lowerThirdCache.keys().next().value;
		const expiredEntry = lowerThirdCache.get(firstKey);
		if (expiredEntry) {
			if (expiredEntry.currentAthleteInfo) expiredEntry.currentAthleteInfo = null;
		}
		lowerThirdCache.delete(firstKey);
	}

	return result;
}
