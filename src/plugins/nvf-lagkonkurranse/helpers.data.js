/**
 * Server-side scoreboard helpers - these run on the server and access the competition hub directly
 */

import { competitionHub } from '$lib/server/competition-hub.js';
import { getFlagUrl } from '$lib/server/flag-resolver.js';
import { calculatePredictedSinclair } from '$lib/sinclair-coefficients.js';

/**
 * Plugin-specific cache to avoid recomputing team data on every browser request
 * Structure: { 'fopName-lastUpdate-gender-topN-sortBy': { teams, allAthletes, ... } }
 */
const nvfScoreboardCache = new Map();

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

function normalizeLotNumber(value) {
	if (value === undefined || value === null) return '';
	const normalized = String(value).trim();
	return normalized;
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
 * Extract the next requested weight from an attempt array
 * Finds the first attempt with liftStatus === 'request' and returns its weight
 * @param {Array} attempts - Array of attempt objects [{liftStatus, stringValue, className}, ...]
 * @returns {number} Next requested weight or 0 if no more requests
 */
function getNextRequestedWeight(attempts) {
	if (!Array.isArray(attempts)) return 0;
	const nextAttempt = attempts.find(a => a?.liftStatus === 'request');
	if (!nextAttempt) return 0;
	
	// Parse the weight from stringValue (should be a number string)
	const weight = parseInt(nextAttempt.stringValue, 10);
	return isNaN(weight) ? 0 : weight;
}

/**
 * Check if any attempts have been taken (good or failed)
 * @param {Array} attempts - Array of attempt objects [{liftStatus, stringValue}, ...]
 * @returns {boolean} True if any attempt has liftStatus 'success' or 'failed'
 */
function hasAttemptBeenTaken(attempts) {
	if (!Array.isArray(attempts)) return false;
	return attempts.some(a => a?.liftStatus === 'success' || a?.liftStatus === 'failed');
}

/**
 * Get the predicted best lift for a lift type
 * PRIORITY: Requested weight (if any) > Best achieved weight
 * @param {Array} attempts - Array of attempt objects for one lift type
 * @param {number} bestAchieved - Best weight already achieved
 * @returns {number} Predicted best weight or 0
 */
function getPredictedBestLift(attempts, bestAchieved) {
	// HIGHEST PRIORITY: If there's a requested weight, use it
	const nextRequested = getNextRequestedWeight(attempts);
	if (nextRequested > 0) {
		return nextRequested;
	}
	
	// FALLBACK: Use best achieved weight (what they've already successfully lifted)
	if (bestAchieved && bestAchieved > 0) {
		return bestAchieved;
	}
	
	// No prediction possible
	return 0;
}

/**
 * Calculate the predicted total (best possible outcome)
 * For snatch: if none done yet, use requested weight; if some done, use best achieved
 * For C&J: same logic
 * @param {Object} athlete - Athlete object with sattempts, cattempts, bestSnatch, bestCleanJerk
 * @returns {number} Predicted total or 0 if no prediction possible
 */
function calculatePredictedTotal(athlete) {
	if (!athlete) return 0;
	
	const bestSnatch = parseFormattedNumber(athlete.bestSnatch) || 0;
	const bestCJ = parseFormattedNumber(athlete.bestCleanJerk) || 0;
	
	// Get predicted best snatch: if best exists, use it; else use first requested
	const predictedSnatch = getPredictedBestLift(athlete.sattempts || [], bestSnatch);
	// Get predicted best C&J: if best exists, use it; else use first requested
	const predictedCJ = getPredictedBestLift(athlete.cattempts || [], bestCJ);
	
	// Only return a prediction if we have at least one predictable value
	if (predictedSnatch === 0 && predictedCJ === 0) return 0;
	
	return predictedSnatch + predictedCJ;
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
 * For NVF team scoreboard: combines current session athletes with all other athletes from database
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
	// Always sort teams by total score (sum of athlete scores: globalScore→sinclair)
	const sortBy = 'score';
	
	// Determine gender: 
	// - If 'gender' option is true (Mixed checkbox), use 'MF' to show both genders
	// - Otherwise, auto-detect from current athlete (if available) to show only their gender
	let gender = 'MF';  // Default to mixed
	if (options.gender !== true) {
		// Mixed checkbox is not checked, so auto-detect from current athlete
		if (fopUpdate?.gender) {
			gender = fopUpdate.gender;
		}
	}
	
	const currentAttemptInfo = options.currentAttemptInfo ?? false;
	const topN = options.topN ?? 0;
	
	// Get language preference from options (default: 'no')
	// Accept both 'lang' (URL param) and 'language' (config option)
	const language = options.lang || options.language || 'no';
	
	// Fetch translations from hub for the selected language
	const translations = competitionHub.getTranslations(language);
	
	// Build header labels from translations with fallbacks
	const headers = {
		order: language === 'no' ? 'Ordre' : (translations.Start || translations.Order || 'Order'),
		name: translations.Name || 'Name',
		category: translations.Category || 'Cat.',
		birth: translations['Scoreboard.Birth'] || translations.Birth || 'Born',
		team: translations.Team || 'Team',
		snatch: translations.Snatch || 'Snatch',
		cleanJerk: translations.Clean_and_Jerk || 'Clean & Jerk',
		total: translations['Scoreboard.Total'] || translations.TOTAL || 'Total',
		score: translations.Score || 'Score',
		best: translations.Best || '✔',
		rank: translations.Rank || 'Rank',
		session: translations.Session || 'Session',
		top4scores: language === 'no' ? 'topp 4 poengsummer' : 'top 4 scores',
		totalNextS: language === 'no' ? 'Total Neste S' : 'Total Next S',
		scoreNextS: language === 'no' ? 'Poeng Neste S' : 'Score Next S'
	};
	console.log(`[NVF helpers] Built headers:`, headers);
	
	// Get learning mode from environment
	const learningMode = process.env.LEARNING_MODE === 'true' ? 'enabled' : 'disabled';
	
	if (!fopUpdate && !databaseState) {
		return {
			competition: { name: 'No Competition Data', fop: 'unknown' },
			currentAthlete: null,
			timer: { state: 'stopped', timeRemaining: 0 },
			sessionStatus: { isDone: false, groupName: '', lastActivity: 0 },  // Include default sessionStatus
			teams: [],
			headers,
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
		JSON.stringify(fopUpdate.groupAthletes) : ''; // Full JSON string as hash
	const cacheKey = `${fopName}-${groupAthletesHash}-${gender}-${topN}-${sortBy}-${currentAttemptInfo}-${language}`;
	
	if (nvfScoreboardCache.has(cacheKey)) {
		const cached = nvfScoreboardCache.get(cacheKey);
		
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

	// Determine current lift type from OWLCMS liftTypeKey field
	const liftTypeKey = fopUpdate?.liftTypeKey || 'Snatch';
	const liftType = liftTypeKey === 'Snatch' ? 'snatch' : 'cleanJerk';
	const liftTypeLabel = liftType === 'snatch' ? 
		(translations.Snatch || 'Snatch') : 
		(translations.Clean_and_Jerk || 'Clean & Jerk');
	
	// Extract basic competition info
	const competition = {
		name: fopUpdate?.competitionName || databaseState?.competition?.name || 'Competition',
		fop: fopName,
		state: fopUpdate?.fopState || 'INACTIVE',
		session: fopUpdate?.groupName || 'A',
		liftType: liftType,
		// Always build custom groupInfo with translations (ignore OWLCMS groupInfo)
		groupInfo: `${translations.Session || 'Session'} ${fopUpdate?.groupName || 'A'} - ${liftTypeLabel}`
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
	}

	const liftingOrderMap = new Map();
	if (Array.isArray(fopUpdate?.liftingOrderAthletes)) {
		let orderPosition = 1;
		for (const orderEntry of fopUpdate.liftingOrderAthletes) {
			if (!orderEntry || orderEntry.isSpacer) continue;
			const lotKey = normalizeLotNumber(orderEntry.lotNumber ?? orderEntry.startNumber);
			if (!lotKey) continue;
			if (!liftingOrderMap.has(lotKey)) {
				liftingOrderMap.set(lotKey, orderPosition);
			}
			orderPosition += 1;
		}
	}
	
	// Get all athletes from database
	let allAthletes = [];
	if (databaseState?.athletes && Array.isArray(databaseState.athletes)) {
		// Build a map of database athletes by lot number for quick lookup
		const databaseAthletesByLot = new Map();
		databaseState.athletes.forEach(dbAthlete => {
			const lotKey = normalizeLotNumber(dbAthlete.lotNumber);
			if (lotKey) {
				databaseAthletesByLot.set(lotKey, dbAthlete);
			}
		});
		
		// Extract lot numbers from current session to identify who's in the session
		// Note: sessionAthletes now has lotNumber field (as of latest OWLCMS version)
		const currentSessionLotNumbers = new Set(
			sessionAthletes.map(a => normalizeLotNumber(a.lotNumber)).filter(Boolean)
		);
		
		// STRATEGY: Use session athletes data FIRST (they have computed fields), 
		// then add database-only athletes (those not in current session)
		
		// Step 1: Start with all session athletes (they have all the computed OWLCMS data)
		// IMPORTANT: Merge in bodyWeight from database so we can calculate Sinclair
		allAthletes = sessionAthletes.map(sa => {
			const lotKey = normalizeLotNumber(sa.lotNumber ?? sa.startNumber);
			const dbAthlete = lotKey ? databaseAthletesByLot.get(lotKey) : null;
			return {
				...sa,
				bodyWeight: dbAthlete?.bodyWeight || 0,
				inCurrentSession: true,
				liftingOrder: lotKey ? liftingOrderMap.get(lotKey) ?? null : null
			};
		});
		
		// Step 2: Add athletes from database that are NOT in the current session
		const databaseOnlyAthletes = databaseState.athletes
			.filter(dbAthlete => !currentSessionLotNumbers.has(normalizeLotNumber(dbAthlete.lotNumber)))
			.map(dbAthlete => {
				// Format database athlete to match session athlete structure
				const categoryName = dbAthlete.categoryName || getCategoryName(dbAthlete.category, databaseState);
				const lotKey = normalizeLotNumber(dbAthlete.lotNumber);
				
				// Format name as "LASTNAME, Firstname" to match OWLCMS format
				const lastName = (dbAthlete.lastName || '').toUpperCase();
				const firstName = dbAthlete.firstName || '';
				const fullName = lastName && firstName ? `${lastName}, ${firstName}` : 
				                 lastName || firstName || '';
				
				return {
					fullName,
					firstName: dbAthlete.firstName,
					lastName: dbAthlete.lastName,
					teamName: dbAthlete.team || dbAthlete.club,
					team: dbAthlete.team || dbAthlete.club,
					flagUrl: getFlagUrl(dbAthlete.team || dbAthlete.club, true),
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
					inCurrentSession: false,
					liftingOrder: lotKey ? liftingOrderMap.get(lotKey) ?? null : null
				};
			});
		
		// Step 3: Combine session athletes + database-only athletes
		allAthletes = [...allAthletes, ...databaseOnlyAthletes];
		
	} else {
		// No database available, use only session athletes
		allAthletes = sessionAthletes.map(a => {
			const lotKey = normalizeLotNumber(a.lotNumber ?? a.startNumber);
			return {
				...a,
				inCurrentSession: true,
				liftingOrder: lotKey ? liftingOrderMap.get(lotKey) ?? null : null
			};
		});
	}
	
	// Filter athletes by gender if not 'MF'
	if (gender !== 'MF') {
		allAthletes = allAthletes.filter(athlete => athlete.gender === gender);
	}

	// Always ignore athletes with no team (drop before grouping)
	allAthletes = allAthletes.filter((athlete) => {
		const teamRaw = (athlete.teamName ?? athlete.team ?? '').toString().trim();
		return teamRaw.length > 0;
	});
	
	// Calculate nextTotal and nextScore for each athlete (session athletes have attempt data from groupAthletes,
	// database athletes have computed bestSnatch/bestCleanJerk from their raw lift records)
	allAthletes = allAthletes.map(athlete => {
		const nextTotal = calculatePredictedTotal(athlete);
		const nextScore = nextTotal > 0 ? calculatePredictedSinclair(nextTotal, athlete.bodyWeight, athlete.gender) : 0;
		const bestSnatchValue = parseFormattedNumber(athlete.bestSnatch);
		const bestCleanJerkValue = parseFormattedNumber(athlete.bestCleanJerk);
		const hasBest = bestSnatchValue > 0 || bestCleanJerkValue > 0;
		const combinedBest = bestSnatchValue + bestCleanJerkValue;
		const displayTotal = hasBest ? combinedBest : '-';
		return {
			...athlete,
			nextTotal,
			nextScore,
			displayTotal
		};
	});
	
	// Group athletes by team
	const teamMap = new Map();
	allAthletes.forEach(athlete => {
		const teamName = (athlete.teamName ?? athlete.team ?? '').toString().trim();
		if (!teamName) return; // skip empty teams entirely
		if (!teamMap.has(teamName)) {
			teamMap.set(teamName, []);
		}
		teamMap.get(teamName).push(athlete);
	});
	
	// Convert to array and sort teams
	let teams = Array.from(teamMap.entries()).map(([teamName, allTeamAthletesRaw]) => {
		// IMPORTANT: Filter out spacer athletes (isSpacer === true) before any processing
		const allTeamAthletes = allTeamAthletesRaw.filter(a => !a.isSpacer);
		
		// Calculate team scores using the BEST 4 athletes from the FULL team
		// This happens BEFORE any topN filtering is applied to the display
		// IMPORTANT: Select top 4 SEPARATELY for current score vs predicted score
		
		// Top 4 by CURRENT score (for teamScore)
		const athletesByCurrentScore = [...allTeamAthletes].sort((a, b) => getAthleteScore(b) - getAthleteScore(a));
		const top4ByCurrentScore = athletesByCurrentScore.slice(0, 4);
		
		// Top 4 by PREDICTED score (for teamNextScore)
		const athletesByPredictedScore = [...allTeamAthletes].sort((a, b) => (b.nextScore || 0) - (a.nextScore || 0));
		const top4ByPredictedScore = athletesByPredictedScore.slice(0, 4);
		
		// Now apply Top N filter per team if specified (for DISPLAY only)
		let athletes = allTeamAthletes;
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
		const teamTotal = allTeamAthletes.reduce((sum, a) => sum + (a.total || 0), 0);
		
		// Calculate team score (sum of TOP 4 by CURRENT score)
		const teamScore = top4ByCurrentScore.reduce((sum, a) => sum + getAthleteScore(a), 0);
		
		// Calculate team next score (sum of TOP 4 by PREDICTED score)
		const numericValue = (value) => {
			const num = Number(value);
			return Number.isFinite(num) ? num : 0;
		};
		const teamNextScore = top4ByPredictedScore.reduce((sum, a) => sum + numericValue(a.nextScore), 0);
		const teamNextTotal = top4ByPredictedScore.reduce((sum, a) => sum + numericValue(a.nextTotal), 0);
		
		// Track which athletes contribute to each score for highlighting
		const normalizeLotNumber = (value) => {
			if (value === undefined || value === null) return null;
			const strValue = String(value).trim();
			return strValue === '' ? null : strValue;
		};
		const top4CurrentLotNumbers = top4ByCurrentScore
			.map((athlete) => normalizeLotNumber(athlete.lotNumber))
			.filter(Boolean);
		const top4PredictedLotNumbers = top4ByPredictedScore
			.map((athlete) => normalizeLotNumber(athlete.lotNumber))
			.filter(Boolean);
		
		return {
			teamName,
			flagUrl: getFlagUrl(teamName, true),
			athletes,
			teamTotal,
			teamScore,
			teamNextScore,
			teamNextTotal,
			athleteCount: headers.top4scores,
			top4CurrentLotNumbers,
			top4PredictedLotNumbers
		};
	});
	
	// Sort teams by total score (highest first)
	teams.sort((a, b) => b.teamScore - a.teamScore);
	
	// Calculate max team name length (for responsive layout)
	// Narrow team column if longest team name is short (< 7 characters)
	const maxTeamNameLength = Math.max(0, ...teams.map(t => (t.teamName || '').length));
	const compactTeamColumn = maxTeamNameLength < 7; // Narrow team column if max name length < 7
	
	// Get competition stats
	const stats = getCompetitionStats(databaseState);

	const result = {
		competition,
		currentAttempt,
		timer,
		sessionStatusMessage,  // Cleaned message for when session is done
		teams, // Array of team objects with athletes
		allAthletes, // Flat list if needed
		stats,
		headers,  // Translated header labels
		displaySettings: fopUpdate?.showTotalRank || fopUpdate?.showSinclair ? {
			showTotalRank: fopUpdate.showTotalRank === 'true',
			showSinclair: fopUpdate.showSinclair === 'true',
			showLiftRanks: fopUpdate.showLiftRanks === 'true',
			showSinclairRank: fopUpdate.showSinclairRank === 'true'
		} : {},
		isBreak: fopUpdate?.break === 'true' || false,
		breakType: fopUpdate?.breakType,
		sessionStatus,  // Include session status (isDone, groupName, lastActivity)
		compactTeamColumn,  // Narrow team column if max team size < 7
		status: (fopUpdate || databaseState) ? 'ready' : 'waiting',
		lastUpdate: fopUpdate?.lastUpdate || Date.now(),
		options: { showRecords, sortBy, gender, currentAttemptInfo, topN } // Echo back the options used
	};
	
	// Cache the result (excluding timer, learningMode, sessionStatus, and sessionStatusMessage which change frequently)
	nvfScoreboardCache.set(cacheKey, {
		competition: result.competition,
		currentAttempt: result.currentAttempt,
		teams: result.teams,
		allAthletes: result.allAthletes,
		stats: result.stats,
		displaySettings: result.displaySettings,
		headers: result.headers,
		isBreak: result.isBreak,
		breakType: result.breakType,
		status: result.status,
		lastUpdate: result.lastUpdate,
		options: result.options
	});
	console.log(`[NVF] Cache now has ${nvfScoreboardCache.size} entries`);
	
	// Cleanup old cache entries (keep last 3 - with 6 FOPs max and 2-3 options = ~18 entries worst case)
	// Reducing from 20 to 3 to avoid memory bloat when multiple scoreboards/FOPs loaded
	if (nvfScoreboardCache.size > 3) {
		const firstKey = nvfScoreboardCache.keys().next().value;
		nvfScoreboardCache.delete(firstKey);
	}

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
