/**
 * Attempt Board - Server-side data helpers
 * 
 * Provides data for full-screen attempt board display including:
 * - Current athlete info (name, team, category, weight)
 * - Platform plate configuration for barbell visualization
 * - Timer and decision state
 */

import { competitionHub } from '$lib/server/competition-hub.js';
import { getFlagUrl, getPictureUrl } from '$lib/server/flag-resolver.js';
import { extractTimerAndDecisionState } from '$lib/server/timer-decision-helpers.js';

/**
 * Get the full database state - SERVER-SIDE ONLY
 */
export function getDatabaseState() {
	return competitionHub.getDatabaseState();
}

/**
 * Get the latest UPDATE message for a specific FOP - SERVER-SIDE ONLY
 */
export function getFopUpdate(fopName = 'A') {
	return competitionHub.getFopUpdate(fopName);
}

/**
 * Calculate plates needed to reach target weight
 * Based on OWLCMS PlatesElement.java logic
 * 
 * @param {number} targetWeight - Total weight to load on bar
 * @param {number} barWeight - Weight of the bar (typically 20kg men, 15kg women)
 * @param {Object} platform - Platform configuration with plate counts
 * @returns {Array} Array of plate objects for display
 */
function calculatePlates(targetWeight, barWeight, platform) {
	if (!targetWeight || targetWeight <= 0) return [];
	if (!platform) return [];
	
	const plates = [];
	let remainingWeight = targetWeight - barWeight;
	
	// Check if we should use collar (2.5kg each side = 5kg total)
	const collarAvailable = platform.nbC_2_5 || 0;
	const useCollar = collarAvailable > 0 && remainingWeight >= 5;
	
	if (useCollar) {
		remainingWeight -= 5; // Reserve weight for collars
	}
	
	// Add bar visualization
	plates.push({ type: 'bar', class: 'bar', weight: 0 });
	plates.push({ type: 'barInner', class: 'barInner', weight: 0 });
	
	// Large plates (bumper plates) - pair weights
	const largePlates = [
		{ class: 'L_25', pairWeight: 50, available: platform.nbL_25 || 0 },
		{ class: 'L_20', pairWeight: 40, available: platform.nbL_20 || 0 },
		{ class: 'L_15', pairWeight: 30, available: platform.nbL_15 || 0 },
		{ class: 'L_10', pairWeight: 20, available: platform.nbL_10 || 0 },
		{ class: 'L_5', pairWeight: 10, available: platform.nbL_5 || 0 },
		{ class: 'L_2_5', pairWeight: 5, available: platform.nbL_2_5 || 0 }
	];
	
	// Track if we've used any large plate (for 5kg/2.5kg logic)
	let usedLargePlate = false;
	
	// Add large plates
	for (const plate of largePlates) {
		let count = plate.available;
		while (count > 0 && remainingWeight >= plate.pairWeight) {
			// Special logic: only use L_5 if no larger plate used and weight >= 10
			if (plate.class === 'L_5' && !usedLargePlate && remainingWeight < 10) break;
			// Special logic: only use L_2_5 if no larger plate used and weight >= 5
			if (plate.class === 'L_2_5' && !usedLargePlate && remainingWeight < 5) break;
			
			plates.push({ type: 'large', class: plate.class, weight: plate.pairWeight / 2 });
			remainingWeight -= plate.pairWeight;
			count--;
			usedLargePlate = true;
		}
	}
	
	// Small plates (change plates) - pair weights
	const smallPlates = [
		{ class: 'S_5', pairWeight: 10, available: platform.nbS_5 || 0 },
		{ class: 'S_2_5', pairWeight: 5, available: platform.nbS_2_5 || 0 }
	];
	
	// Add small plates before collar
	for (const plate of smallPlates) {
		let count = plate.available;
		while (count > 0 && remainingWeight >= plate.pairWeight) {
			plates.push({ type: 'small', class: plate.class, weight: plate.pairWeight / 2 });
			remainingWeight -= plate.pairWeight;
			count--;
		}
	}
	
	// Add collar if used
	if (useCollar) {
		plates.push({ type: 'collar', class: 'C_2_5', weight: 2.5 });
		remainingWeight += 5; // We reserved this earlier, add back to check remaining
		remainingWeight -= 5; // And now use it
	}
	
	// Remaining small plates after collar
	const remainingSmallPlates = [
		{ class: 'S_2', pairWeight: 4, available: platform.nbS_2 || 0 },
		{ class: 'S_1_5', pairWeight: 3, available: platform.nbS_1_5 || 0 },
		{ class: 'S_1', pairWeight: 2, available: platform.nbS_1 || 0 },
		{ class: 'S_0_5', pairWeight: 1, available: platform.nbS_0_5 || 0 }
	];
	
	for (const plate of remainingSmallPlates) {
		let count = plate.available;
		while (count > 0 && remainingWeight >= plate.pairWeight) {
			plates.push({ type: 'small', class: plate.class, weight: plate.pairWeight / 2 });
			remainingWeight -= plate.pairWeight;
			count--;
		}
	}
	
	// Add bar outer end
	plates.push({ type: 'barOuter', class: 'barOuter', weight: 0 });
	
	return plates;
}

/**
 * Get bar weight based on gender (20kg men, 15kg women)
 */
function getBarWeight(gender, platform) {
	// Check for non-standard bar first
	if (platform?.nonStandardBarWeight && platform.nonStandardBarWeight > 0) {
		return platform.nonStandardBarWeight;
	}
	// Standard bars: 20kg for men, 15kg for women
	return gender === 'F' ? 15 : 20;
}

/**
 * Get formatted scoreboard data for SSR/API (SERVER-SIDE ONLY)
 */
export function getScoreboardData(fopName = 'A', options = {}) {
	const fopUpdate = getFopUpdate(fopName);
	const databaseState = getDatabaseState();
	
	const showPlates = options.showPlates !== 'false';
	const showTimer = options.showTimer !== 'false';
	const showDecisions = options.showDecisions !== 'false';
	
	// Get learning mode from environment
	const learningMode = process.env.LEARNING_MODE === 'true' ? 'enabled' : 'disabled';
	
	// Extract timer, breakTimer, decision, and displayMode using shared helpers
	const { timer, breakTimer, decision, displayMode } = extractTimerAndDecisionState(fopUpdate, fopName);
	
	if (!fopUpdate && !databaseState) {
		return {
			scoreboardName: 'Attempt Board',
			competition: { name: '', fop: fopName },
			currentAttempt: null,
			plates: [],
			timer,
			breakTimer,
			decision,
			displayMode,
			sessionStatus: { isDone: false },
			options: { showPlates, showTimer, showDecisions, showFlag: false, showPicture: false },
			status: 'waiting',
			message: '',
			learningMode
		};
	}

	// Get session status
	const sessionStatus = competitionHub.getSessionStatus(fopName);

	// Extract basic competition info
	const competition = {
		name: fopUpdate?.competitionName || databaseState?.competition?.name || 'Competition',
		fop: fopName,
		state: fopUpdate?.fopState || 'INACTIVE',
		session: fopUpdate?.sessionName || '',
		sessionInfo: (fopUpdate?.sessionInfo || '').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—'),
		liftsDone: fopUpdate?.liftsDone || ''
	};

	// Get platform configuration for plates
	let platform = null;
	if (databaseState?.platforms) {
		// Find platform matching this FOP name
		platform = databaseState.platforms.find(p => p.name === fopName) 
			|| databaseState.platforms[0];
		console.log(`[Attempt Board] Platform found: ${platform?.name}, fopName: ${fopName}, nbL_25: ${platform?.nbL_25}`);
	} else {
		console.log(`[Attempt Board] No platforms in database. databaseState exists: ${!!databaseState}`);
	}
	
	// Extract current athlete from session athletes
	let currentAttempt = null;
	let plates = [];
	let barWeight = 20;
	
	// Get session athletes from competition hub
	const sessionAthletes = competitionHub.getSessionAthletes(fopName) || [];
	
	const currentAthlete = sessionAthletes.find(a => 
		a.classname && a.classname.includes('current')
	);
	
	if (currentAthlete) {
		// Parse names - fullName is "LASTNAME, FirstName"
		const fullName = currentAthlete.fullName || '';
		let lastName = '';
		let firstName = '';
		
		if (fullName.includes(',')) {
			const parts = fullName.split(',');
			lastName = parts[0].trim();
			firstName = parts.slice(1).join(',').trim();
		} else {
			lastName = fullName;
		}
		
		// Determine gender for bar weight
		const gender = currentAthlete.gender || fopUpdate?.gender || 'M';
		barWeight = getBarWeight(gender, platform);
		
		// Get weight from fopUpdate (current requested weight)
		const weight = parseInt(fopUpdate?.weight) || 0;
		
		// Get picture and flag URLs using unified resolver
		const pictureUrl = getPictureUrl(currentAthlete.membership, true);
		const flagUrl = getFlagUrl(currentAthlete.teamName, true);
		
		currentAttempt = {
			fullName,
			lastName,
			firstName,
			teamName: currentAthlete.teamName || '',
			flagUrl,
			pictureUrl,
			startNumber: currentAthlete.startNumber || fopUpdate?.startNumber || '',
			categoryName: currentAthlete.category || fopUpdate?.categoryName || '',
			attempt: fopUpdate?.attempt || '',
			attemptNumber: fopUpdate?.attemptNumber || '',
			weight,
			gender,
			barWeight
		};
		
		// Calculate plates for barbell display
		if (showPlates && weight > 0 && platform) {
			plates = calculatePlates(weight, barWeight, platform);
		}
	}
	
	// Session status message for breaks
	let sessionStatusMessage = null;
	if (sessionStatus?.isDone && fopUpdate?.fullName) {
		sessionStatusMessage = (fopUpdate.fullName || '').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—');
	}

	// Determine overall status
	const hasData = !!(fopUpdate || databaseState);
	const status = hasData ? 'ready' : 'waiting';
	const message = hasData ? null : '';

	return {
		scoreboardName: 'Attempt Board',
		competition,
		currentAttempt,
		plates,
		barWeight,
		platform: platform ? {
			name: platform.name,
			hasCollar: (platform.nbC_2_5 || 0) > 0
		} : null,
		// Full platform plate configuration for PlatesElement component
		platformPlates: platform,
		timer,
		breakTimer,
		decision,
		displayMode,
		sessionStatus,
		sessionStatusMessage,
		isBreak: fopUpdate?.break === 'true' || false,
		breakType: fopUpdate?.breakType,
		options: { 
			showPlates, 
			showTimer, 
			showDecisions, 
			showFlag: !!currentAttempt?.flagUrl, 
			showPicture: !!currentAttempt?.pictureUrl 
		},
		status,
		message,
		lastUpdate: fopUpdate?.lastUpdate || Date.now(),
		learningMode
	};
}
