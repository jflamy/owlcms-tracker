/**
 * Server-side scoreboard helpers - these run on the server and access the competition hub directly
 */

import { competitionHub } from '$lib/server/competition-hub.js';

/**
 * Plugin-specific cache to avoid recomputing team data on every browser request
 * Structure: { 'fopName-lastUpdate-gender-topN-sortBy': { teams, allAthletes, ... } }
 */
const teamScoreboardCache = new Map();

/**
 * Parse a formatted number that may be a string with decimal comma or point
 * Handles: "96.520", "96,520", "-", null, undefined, 0
 * @param {*} value - Value to parse (can be string, number, null, undefined)
 * @returns {number} Parsed number or 0 if invalid
 */
function parseFormattedNumber(value) {
	if (value === null || value === undefined || value === '' || value === '-') {
		return 0;
	}
	if (typeof value === 'number') {
		return value;
	}
	// Convert string: replace comma with period, then parse
	const normalized = String(value).replace(',', '.');
	const parsed = parseFloat(normalized);
	return isNaN(parsed) ? 0 : parsed;
}

/**
 * Get score from athlete (tries globalScore first, then sinclair)
 * @param {Object} athlete - Athlete object
 * @returns {number} Score value or 0
 */
function getAthleteScore(athlete) {
	if (!athlete) return 0;
	const globalScore = parseFormattedNumber(athlete.globalScore);
	if (globalScore > 0) return globalScore;
	return parseFormattedNumber(athlete.sinclair);
}

/**
 * Get the full database state (raw athlete data) - SERVER-SIDE ONLY
 * @returns {Object|null} Raw database state from OWLCMS
 */
export function getDatabaseState() {
	return competitionHub.getDatabaseState();
}

/**
 * Get the latest UPDATE message for a specific FOP - SERVER-SIDE ONLY
 * This contains precomputed presentation data like liftingOrderAthletes, groupAthletes, etc.
 * @param {string} fopName - FOP name (default: 'A')
 * @returns {Object|null} Latest UPDATE message with precomputed data
 */
export function getFopUpdate(fopName = 'A') {
	return competitionHub.getFopUpdate(fopName);
}

/**
 * Get formatted scoreboard data for SSR/API (SERVER-SIDE ONLY)
 * For team scoreboard: combines current session athletes with all other athletes from database
 * Groups by team and adds spacers between teams
 * Note: Session athletes are stored in the groupAthletes key (historical name)
 * @param {string} fopName - FOP name (default: 'A')
 * @param {Object} options - User preferences (e.g., { showRecords: true, sortBy: 'total' })
 * @returns {Object} Formatted data ready for browser consumption
 */
export function getScoreboardData(fopName = 'A', options = {}) {
	const fopUpdate = getFopUpdate(fopName);
	const databaseState = getDatabaseState();
	
	// Extract options with defaults
	const showRecords = options.showRecords ?? false;
	const sortBy = options.sortBy ?? 'total';
	const gender = options.gender ?? 'MF';
	const currentAttemptInfo = options.currentAttemptInfo ?? false;
	const topN = options.topN ?? 0;
	
	// Get learning mode from environment
	const learningMode = process.env.LEARNING_MODE === 'true' ? 'enabled' : 'disabled';
	
	if (!fopUpdate && !databaseState) {
		return {
			competition: { name: 'No Competition Data', fop: 'unknown' },
			currentAthlete: null,
			timer: { state: 'stopped', timeRemaining: 0 },
			sessionStatus: { isDone: false, groupName: '', lastActivity: 0 },  // Include default sessionStatus
			teams: [],
			status: 'waiting',
			learningMode
		};
	}

	// Get session status early (before cache check, so it's always fresh)
	const sessionStatus = competitionHub.getSessionStatus(fopName);

	// Check cache first - cache key based on athlete data, NOT timer events
	// Use a hash of groupAthletes to detect when athlete data actually changes
	// groupAthletes is now a parsed object, so stringify it first for hashing
	const groupAthletesHash = fopUpdate?.groupAthletes ? 
		JSON.stringify(fopUpdate.groupAthletes).substring(0, 100) : ''; // First 100 chars as quick hash
	const cacheKey = `${fopName}-${groupAthletesHash}-${gender}-${topN}-${sortBy}`;
	
	if (teamScoreboardCache.has(cacheKey)) {
		const cached = teamScoreboardCache.get(cacheKey);
		console.log(`[Team Scoreboard] ✓ Cache hit for ${fopName} (${teamScoreboardCache.size} entries cached)`);
		
		// Compute sessionStatusMessage from current fopUpdate (even on cache hit)
		let sessionStatusMessage = null;
		if (sessionStatus.isDone && fopUpdate?.fullName) {
			sessionStatusMessage = (fopUpdate.fullName || '').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—');
		}
		
		// Return cached data with current timer state, session status, and status message
		return {
			...cached,
			timer: extractTimerState(fopUpdate),
			sessionStatus,  // Fresh session status
			sessionStatusMessage,  // Fresh status message
			learningMode
		};
	}
	
	console.log(`[Team Scoreboard] Cache miss for ${fopName}, computing team data...`);

	// Extract basic competition info
	const competition = {
		name: fopUpdate?.competitionName || databaseState?.competition?.name || 'Competition',
		fop: fopName,
		state: fopUpdate?.fopState || 'INACTIVE',
		session: fopUpdate?.groupName || 'A',
		// Replace HTML entities with Unicode characters
		groupInfo: (fopUpdate?.groupInfo || '').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—')
	};

	// Extract current athlete info from UPDATE message
	let currentAttempt = null;
	let sessionStatusMessage = null;  // For displaying when session is done
	
	if (fopUpdate?.fullName) {
		// Clean up HTML entities in fullName (OWLCMS sends session status here when done)
		const cleanFullName = (fopUpdate.fullName || '').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—');
		
		currentAttempt = {
			fullName: cleanFullName,
			name: cleanFullName,
			teamName: fopUpdate.teamName,
			team: fopUpdate.teamName,
			startNumber: fopUpdate.startNumber,
			categoryName: fopUpdate.categoryName,
			category: fopUpdate.categoryName,
			attempt: fopUpdate.attempt,
			attemptNumber: fopUpdate.attemptNumber,
			weight: fopUpdate.weight,
			timeAllowed: fopUpdate.timeAllowed,
			startTime: fopUpdate.athleteTimerEventType === 'Start' ? Date.now() - (fopUpdate.timeAllowed - (fopUpdate.athleteMillisRemaining || 0)) : null
		};
		
		// If session is done, save the cleaned message separately
		if (sessionStatus.isDone) {
			sessionStatusMessage = cleanFullName;
		}
	}

	// Extract timer info from UPDATE message or keep previous timer state
	const timer = {
		state: fopUpdate?.athleteTimerEventType === 'StartTime' ? 'running' : 
		       fopUpdate?.athleteTimerEventType === 'StopTime' ? 'stopped' : 
		       fopUpdate?.athleteTimerEventType === 'SetTime' ? 'set' :
		       fopUpdate?.athleteTimerEventType ? fopUpdate.athleteTimerEventType.toLowerCase() : 'stopped',
		timeRemaining: fopUpdate?.athleteMillisRemaining ? parseInt(fopUpdate.athleteMillisRemaining) : 0,
		duration: fopUpdate?.timeAllowed ? parseInt(fopUpdate.timeAllowed) : 60000,
		startTime: null // Client will compute this
	};

	// Get precomputed session athletes from UPDATE message (stored in groupAthletes key)
	// Note: groupAthletes is already a parsed object (nested JSON from WebSocket)
	let sessionAthletes = [];
	if (fopUpdate?.groupAthletes) {
		sessionAthletes = fopUpdate.groupAthletes;
		
		// Find the current athlete (has 'current' in classname)
		const currentAthlete = sessionAthletes.find(a => a.classname && a.classname.includes('current'));
		if (currentAthlete) {
			console.log(`[Team] ✓ Found current athlete: ${currentAthlete.fullName} (lot ${currentAthlete.lotNumber}, start ${currentAthlete.startNumber})`);
		} else if (sessionAthletes.length > 0) {
			console.log(`[Team] Have ${sessionAthletes.length} athletes in current session, but no current athlete lifting`);
		}
	}
	
	// Get all athletes from database
	let allAthletes = [];
	if (databaseState?.athletes && Array.isArray(databaseState.athletes)) {
		// Extract lot numbers from current session to identify who's in the session
		// Note: sessionAthletes now has lotNumber field (as of latest OWLCMS version)
		// IMPORTANT: Convert to strings for comparison - sessionAthletes has strings, database has numbers
		const currentSessionLotNumbers = new Set(sessionAthletes.map(a => String(a.lotNumber)).filter(Boolean));
		
		// STRATEGY: Use session athletes data FIRST (they have computed fields), 
		// then add database-only athletes (those not in current session)
		
		// Step 1: Start with all session athletes (they have all the computed OWLCMS data)
		allAthletes = sessionAthletes.map(sa => sa);
		
		// Step 2: Add athletes from database that are NOT in the current session
		const databaseOnlyAthletes = databaseState.athletes
			.filter(dbAthlete => !currentSessionLotNumbers.has(String(dbAthlete.lotNumber)))
			.map(dbAthlete => {
				// Format database athlete to match session athlete structure
				const categoryName = dbAthlete.categoryName || getCategoryName(dbAthlete.category, databaseState);
				
				return {
					fullName: `${dbAthlete.firstName || ''} ${dbAthlete.lastName || ''}`.trim(),
					firstName: dbAthlete.firstName,
					lastName: dbAthlete.lastName,
					teamName: dbAthlete.team || dbAthlete.club,
					team: dbAthlete.team || dbAthlete.club,
					startNumber: dbAthlete.startNumber,
					lotNumber: dbAthlete.lotNumber,
					categoryName: categoryName,
					category: categoryName,
					gender: dbAthlete.gender,
					bodyWeight: dbAthlete.bodyWeight,
					yearOfBirth: dbAthlete.fullBirthDate?.[0] || '',
					
					// Format snatch attempts in OWLCMS display format
					sattempts: [
						formatAttempt(dbAthlete.snatch1Declaration, dbAthlete.snatch1Change1, dbAthlete.snatch1Change2, dbAthlete.snatch1ActualLift, dbAthlete.snatch1AutomaticProgression),
						formatAttempt(dbAthlete.snatch2Declaration, dbAthlete.snatch2Change1, dbAthlete.snatch2Change2, dbAthlete.snatch2ActualLift, dbAthlete.snatch2AutomaticProgression),
						formatAttempt(dbAthlete.snatch3Declaration, dbAthlete.snatch3Change1, dbAthlete.snatch3Change2, dbAthlete.snatch3ActualLift, dbAthlete.snatch3AutomaticProgression)
					],
					
					// Format clean & jerk attempts in OWLCMS display format
					cattempts: [
						formatAttempt(dbAthlete.cleanJerk1Declaration, dbAthlete.cleanJerk1Change1, dbAthlete.cleanJerk1Change2, dbAthlete.cleanJerk1ActualLift, dbAthlete.cleanJerk1AutomaticProgression),
						formatAttempt(dbAthlete.cleanJerk2Declaration, dbAthlete.cleanJerk2Change1, dbAthlete.cleanJerk2Change2, dbAthlete.cleanJerk2ActualLift, dbAthlete.cleanJerk2AutomaticProgression),
						formatAttempt(dbAthlete.cleanJerk3Declaration, dbAthlete.cleanJerk3Change1, dbAthlete.cleanJerk3Change2, dbAthlete.cleanJerk3ActualLift, dbAthlete.cleanJerk3AutomaticProgression)
					],
					
					// Totals
					total: dbAthlete.total || 0,
					bestSnatch: computeBestLift([
						dbAthlete.snatch1ActualLift,
						dbAthlete.snatch2ActualLift,
						dbAthlete.snatch3ActualLift
					]),
					bestCleanJerk: computeBestLift([
						dbAthlete.cleanJerk1ActualLift,
						dbAthlete.cleanJerk2ActualLift,
						dbAthlete.cleanJerk3ActualLift
					]),
					
					// Scoring fields from OWLCMS
					totalRank: 0,
					sinclair: dbAthlete.sinclair || 0,
					globalScore: dbAthlete.globalScore || null,
					
					// No classname (not in current session)
					inCurrentSession: false
				};
			});
		
		// Step 3: Combine session athletes + database-only athletes
		allAthletes = [...allAthletes, ...databaseOnlyAthletes];
		
	} else {
		// No database available, use only session athletes
		allAthletes = sessionAthletes.map(a => ({ ...a, inCurrentSession: true }));
	}
	
	// Filter athletes by gender if not 'MF'
	if (gender !== 'MF') {
		allAthletes = allAthletes.filter(athlete => athlete.gender === gender);
	}
	
	// Group athletes by team
	const teamMap = new Map();
	allAthletes.forEach(athlete => {
		const teamName = athlete.teamName || athlete.team || 'No Team';
		if (!teamMap.has(teamName)) {
			teamMap.set(teamName, []);
		}
		teamMap.get(teamName).push(athlete);
	});
	
	// Convert to array and sort teams
	let teams = Array.from(teamMap.entries()).map(([teamName, athletes]) => {
		// Apply Top N filter per team if specified (keep top N men and top N women per team)
		if (topN > 0) {
			// Separate by gender within this team
			const maleAthletes = athletes.filter(a => a.gender === 'M');
			const femaleAthletes = athletes.filter(a => a.gender === 'F');
			
			// Sort each by score (globalScore or sinclair)
			maleAthletes.sort((a, b) => {
				const scoreA = getAthleteScore(a);
				const scoreB = getAthleteScore(b);
				return scoreB - scoreA;
			});
			
			femaleAthletes.sort((a, b) => {
				const scoreA = getAthleteScore(a);
				const scoreB = getAthleteScore(b);
				return scoreB - scoreA;
			});
			
			// Take top N from each gender in this team
			const topMales = maleAthletes.slice(0, topN);
			const topFemales = femaleAthletes.slice(0, topN);
			
			// Combine back together
			athletes = [...topMales, ...topFemales];
		}
		
		// Sort athletes within team
		// If topN is active, sort by score (already done above, just preserve it)
		// Otherwise, sort by total
		if (topN === 0) {
			athletes.sort((a, b) => (b.total || 0) - (a.total || 0));
		} else {
			// Re-sort the combined list by score (since we combined males and females)
			athletes.sort((a, b) => {
				const scoreA = getAthleteScore(a);
				const scoreB = getAthleteScore(b);
				return scoreB - scoreA;
			});
		}
		
		// Calculate team total (sum of all athlete totals)
		const teamTotal = athletes.reduce((sum, a) => sum + (a.total || 0), 0);
		
		// Calculate team score (sum of all athlete scores - globalScore or sinclair)
		const teamScore = athletes.reduce((sum, a) => sum + getAthleteScore(a), 0);
		
		return {
			teamName,
			athletes,
			teamTotal,
			teamScore,
			athleteCount: athletes.length
		};
	});
	
	// Sort teams by total score or name
	if (sortBy === 'total') {
		teams.sort((a, b) => b.teamTotal - a.teamTotal);
	} else {
		teams.sort((a, b) => a.teamName.localeCompare(b.teamName));
	}
	
	// Get competition stats
	const stats = getCompetitionStats(databaseState);

	const result = {
		competition,
		currentAttempt,
		competition,
		currentAttempt,
		timer,
		sessionStatusMessage,  // Cleaned message for when session is done
		teams, // Array of team objects with athletes
		allAthletes, // Flat list if needed
		stats,
		displaySettings: fopUpdate?.showTotalRank || fopUpdate?.showSinclair ? {
			showTotalRank: fopUpdate.showTotalRank === 'true',
			showSinclair: fopUpdate.showSinclair === 'true',
			showLiftRanks: fopUpdate.showLiftRanks === 'true',
			showSinclairRank: fopUpdate.showSinclairRank === 'true'
		} : {},
		isBreak: fopUpdate?.break === 'true' || false,
		breakType: fopUpdate?.breakType,
		sessionStatus,  // Include session status (isDone, groupName, lastActivity)
		status: (fopUpdate || databaseState) ? 'ready' : 'waiting',
		lastUpdate: fopUpdate?.lastUpdate || Date.now(),
		options: { showRecords, sortBy, gender, currentAttemptInfo, topN } // Echo back the options used
	};
	
	// Cache the result (excluding timer, learningMode, sessionStatus, and sessionStatusMessage which change frequently)
	teamScoreboardCache.set(cacheKey, {
		competition: result.competition,
		currentAttempt: result.currentAttempt,
		teams: result.teams,
		allAthletes: result.allAthletes,
		stats: result.stats,
		displaySettings: result.displaySettings,
		isBreak: result.isBreak,
		breakType: result.breakType,
		status: result.status,
		lastUpdate: result.lastUpdate,
		options: result.options
	});
	
	// Cleanup old cache entries (keep last 20)
	if (teamScoreboardCache.size > 20) {
		const firstKey = teamScoreboardCache.keys().next().value;
		teamScoreboardCache.delete(firstKey);
	}
	
	console.log(`[Team Scoreboard] Cached result for ${cacheKey} (${teamScoreboardCache.size} entries)`);

	return {
		...result,
		sessionStatus,  // Always include fresh session status
		learningMode
	};
}

/**
 * Extract timer state from FOP update (called separately since timer changes frequently)
 * @param {Object} fopUpdate - FOP update data
 * @returns {Object} Timer state
 */
function extractTimerState(fopUpdate) {
	return {
		state: fopUpdate?.athleteTimerEventType === 'StartTime' ? 'running' : 
		       fopUpdate?.athleteTimerEventType === 'StopTime' ? 'stopped' : 
		       fopUpdate?.athleteTimerEventType === 'SetTime' ? 'set' :
		       fopUpdate?.athleteTimerEventType ? fopUpdate.athleteTimerEventType.toLowerCase() : 'stopped',
		timeRemaining: fopUpdate?.athleteMillisRemaining ? parseInt(fopUpdate.athleteMillisRemaining) : 0,
		duration: fopUpdate?.timeAllowed ? parseInt(fopUpdate.timeAllowed) : 60000,
		startTime: null // Client will compute this
	};
}

/**
 * Get category name by ID from database state
 * @param {number} categoryId - Category ID
 * @param {Object} databaseState - Database state
 * @returns {string} Category name
 */
function getCategoryName(categoryId, databaseState) {
	if (!categoryId || !databaseState?.ageGroups) {
		return '';
	}
	
	for (const ageGroup of databaseState.ageGroups) {
		if (ageGroup.categories) {
			const category = ageGroup.categories.find(c => c.id === categoryId);
			if (category) {
				return category.name || category.code || '';
			}
		}
	}
	return '';
}

/**
 * Compute best lift from attempt strings
 * @param {Array<string>} attempts - Array of attempt strings (e.g., "120", "-125", "")
 * @returns {number} Best successful lift or 0
 */
function computeBestLift(attempts) {
	let best = 0;
	attempts.forEach(attempt => {
		if (attempt && !attempt.startsWith('-')) {
			const weight = parseInt(attempt);
			if (!isNaN(weight) && weight > best) {
				best = weight;
			}
		}
	});
	return best;
}

/**
 * Format attempt for display in OWLCMS style
 * @param {string} declaration - Declared weight (e.g., "120")
 * @param {string} actualLift - Actual lift result (e.g., "120", "-120", "")
 * @returns {Object} Formatted attempt object with liftStatus and stringValue
 */
/**
 * Format attempt for display using OWLCMS priority order
 * Priority: actualLift > change2 > change1 > declaration > automaticProgression
 * @param {string} declaration - Initial declared weight
 * @param {string} change1 - First change
 * @param {string} change2 - Second change  
 * @param {string} actualLift - Actual lift result (with '-' prefix for fails)
 * @param {string} automaticProgression - Calculated automatic progression weight
 * @returns {Object} { liftStatus: 'empty'|'request'|'fail'|'good', stringValue: '120' }
 */
function formatAttempt(declaration, change1, change2, actualLift, automaticProgression) {
	// Determine the displayed weight using OWLCMS priority order
	let displayWeight = null;
	
	// Priority 1: actualLift (if lift has been attempted)
	if (actualLift && actualLift !== '' && actualLift !== '0') {
		if (actualLift.startsWith('-')) {
			// Failed lift
			const weight = actualLift.substring(1);
			return { liftStatus: 'fail', stringValue: `(${weight})` };
		} else {
			// Good lift
			return { liftStatus: 'good', stringValue: actualLift };
		}
	}
	
	// Priority 2: change2 (most recent change)
	if (change2 && change2 !== '' && change2 !== '0') {
		displayWeight = change2;
	}
	// Priority 3: change1 (earlier change)
	else if (change1 && change1 !== '' && change1 !== '0') {
		displayWeight = change1;
	}
	// Priority 4: declaration (original weight)
	else if (declaration && declaration !== '' && declaration !== '0') {
		displayWeight = declaration;
	}
	// Priority 5: automaticProgression (calculated default)
	else if (automaticProgression && automaticProgression !== '' && automaticProgression !== '0' && automaticProgression !== '-') {
		displayWeight = automaticProgression;
	}
	
	// If we have a display weight (request not yet attempted)
	if (displayWeight) {
		return { liftStatus: 'request', stringValue: displayWeight };
	}
	
	// No weight declared or attempted = empty
	return { liftStatus: 'empty', stringValue: '' };
}

/**
 * Compute Sinclair coefficient (simplified version - should match OWLCMS)
 * Note: This is a basic approximation. OWLCMS has the authoritative calculation.
 * @param {number} total - Total lifted
 * @param {number} bodyWeight - Body weight in kg
 * @param {string} gender - "M" or "F"
 * @returns {number} Sinclair score
 */
function computeSinclair(total, bodyWeight, gender) {
	if (!total || total === 0 || !bodyWeight) return 0;
	
	// Simplified Sinclair calculation using 2020+ coefficients
	// For accurate results, should use OWLCMS precomputed values
	const maxBodyWeight = gender === 'M' ? 175.508 : 153.757;
	const coeffA = gender === 'M' ? 0.751945030 : 0.783497476;
	const coeffB = gender === 'M' ? 175.508 : 153.757;
	
	if (bodyWeight >= maxBodyWeight) {
		return total; // No coefficient for super-heavyweights
	}
	
	const sinclairCoeff = Math.pow(10, coeffA * Math.pow(Math.log10(bodyWeight / coeffB), 2));
	return total * sinclairCoeff;
}

/**
 * Get top athletes from the competition state (SERVER-SIDE ONLY)
 * @param {Object} competitionState - Full competition state
 * @param {number} limit - Number of athletes to return
 * @returns {Array} Top athletes sorted by total
 */
export function getTopAthletes(competitionState, limit = 10) {
	if (!competitionState?.athletes || !Array.isArray(competitionState.athletes)) {
		return [];
	}

	return competitionState.athletes
		.filter(athlete => athlete && (athlete.total > 0 || athlete.bestSnatch > 0 || athlete.bestCleanJerk > 0))
		.sort((a, b) => {
			// Sort by total first, then by Sinclair, then by best snatch
			const totalA = a.total || 0;
			const totalB = b.total || 0;
			if (totalA !== totalB) return totalB - totalA;
			
			const sinclairA = a.sinclair || 0;
			const sinclairB = b.sinclair || 0;
			if (sinclairA !== sinclairB) return sinclairB - sinclairA;
			
			const snatchA = a.bestSnatch || 0;
			const snatchB = b.bestSnatch || 0;
			return snatchB - snatchA;
		})
		.slice(0, limit);
}

/**
 * Get team rankings computed from the hub (SERVER-SIDE ONLY)
 * @returns {Array} Team rankings with scores
 */
export function getTeamRankings() {
	return competitionHub.getTeamRankings();
}

/**
 * Get athletes by weight class (SERVER-SIDE ONLY)
 * @param {string} weightClass - Weight class to filter by (e.g., "73kg")
 * @param {string} gender - Gender to filter by ("M" or "F")
 * @returns {Array} Athletes in the specified category
 */
export function getAthletesByCategory(weightClass = null, gender = null) {
	const state = getCompetitionState();
	if (!state?.athletes) return [];

	return state.athletes.filter(athlete => {
		if (weightClass && athlete.category !== weightClass) return false;
		if (gender && athlete.gender !== gender) return false;
		return true;
	});
}

/**
 * Get lifting order from the competition state (SERVER-SIDE ONLY)
 * @returns {Array} Current lifting order
 */
export function getLiftingOrder() {
	const state = getCompetitionState();
	return state?.liftingOrder || [];
}

/**
 * Get competition metrics and statistics (SERVER-SIDE ONLY)
 * @param {Object} competitionState - Competition state (optional, will fetch if not provided)
 * @returns {Object} Competition statistics
 */
export function getCompetitionStats(competitionState = null) {
	if (!competitionState) {
		competitionState = getCompetitionState();
	}
	
	if (!competitionState?.athletes) {
		return {
			totalAthletes: 0,
			activeAthletes: 0,
			completedAthletes: 0,
			categories: [],
			teams: []
		};
	}

	const athletes = competitionState.athletes;
	const categories = [...new Set(athletes.map(a => a.categoryName || a.category).filter(Boolean))];
	const teams = [...new Set(athletes.map(a => a.teamName || a.team).filter(Boolean))];

	return {
		totalAthletes: athletes.length,
		activeAthletes: athletes.filter(a => a.total > 0 || a.bestSnatch > 0 || a.bestCleanJerk > 0).length,
		completedAthletes: athletes.filter(a => a.total > 0).length,
		categories,
		teams,
		averageTotal: athletes.filter(a => a.total > 0).reduce((sum, a, _, arr) => sum + a.total / arr.length, 0) || 0
	};
}