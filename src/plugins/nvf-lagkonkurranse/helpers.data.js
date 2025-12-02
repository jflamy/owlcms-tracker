/**
 * Server-side scoreboard helpers for NVF Lagkonkurranse
 * 
 * ARCHITECTURE: Layered data processing
 * 
 * Layer 1: Raw DTOs (unmodified from source)
 *   - Session athletes: from competitionHub.getStartOrderEntries() - already flattened by hub
 *   - Database athletes: from competitionHub.getDatabaseState().athletes (future)
 * 
 * Layer 2: TeamAthlete creation (enriched for team scoring)
 *   - teamAthleteFromSession(): creates TeamAthlete from session data
 *   - teamAthleteFromDatabase(): creates TeamAthlete from database data
 * 
 * Layer 3: Team grouping and scoring
 *   - Groups wrapped athletes by team
 *   - Computes team totals, top contributors, etc.
 */

import { competitionHub } from '$lib/server/competition-hub.js';
import { getFlagUrl } from '$lib/server/flag-resolver.js';
import { CalculateSinclair2024 } from '$lib/sinclair-coefficients.js';
import { buildCacheKey } from '$lib/server/cache-utils.js';

// =============================================================================
// CACHE
// =============================================================================

/**
 * Plugin-specific cache to avoid recomputing team data on every browser request
 */
const nvfScoreboardCache = new Map();

/**
 * Track last known session gender per FOP
 * When no session is active, we use the previous session's gender (default: 'M')
 */
const lastKnownGenderByFop = new Map();

// NOTE: cache key construction uses the shared `buildCacheKey` helper
// to centralize hub/fop version lookup and consistent key formatting.

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Parse a formatted number that may be a string with decimal comma or point
 * @param {*} value - Value to parse
 * @returns {number} Parsed number or 0 if invalid
 */
function parseFormattedNumber(value) {
	if (value === null || value === undefined || value === '' || value === '-') {
		return 0;
	}
	if (typeof value === 'number') {
		return value;
	}
	const normalized = String(value).replace(',', '.');
	const parsed = parseFloat(normalized);
	return isNaN(parsed) ? 0 : parsed;
}

/**
 * Normalize athlete key to string for consistent lookups
 * Keys can be negative numbers in OWLCMS
 */
function normalizeKey(value) {
	if (value === undefined || value === null) return '';
	return String(value).trim();
}

/**
 * Extract year of birth from fullBirthDate
 * Database format can be array [2001, 1, 18] or string "2001-01-18"
 * @param {Array|string} fullBirthDate - Birth date in database format
 * @returns {string} Year as string (e.g., "2001") or empty string
 */
function extractYearOfBirth(fullBirthDate) {
	if (!fullBirthDate) return '';
	// Array format: [2001, 1, 18]
	if (Array.isArray(fullBirthDate) && fullBirthDate.length > 0) {
		return String(fullBirthDate[0]);
	}
	// String format: "2001-01-18"
	if (typeof fullBirthDate === 'string') {
		return fullBirthDate.substring(0, 4);
	}
	return '';
}

/**
 * Normalize lot number to string for consistent lookups
 * @deprecated Use normalizeKey() with athlete.key instead
 */
function normalizeLotNumber(value) {
	if (value === undefined || value === null) return '';
	return String(value).trim();
}

/**
 * Normalize gender values to 'M' or 'F'
 * @param {string} g - Gender string
 * @returns {'M'|'F'|null}
 */
function normalizeGender(g) {
	if (g === undefined || g === null) return null;
	const s = String(g).trim().toLowerCase();
	if (s === 'm' || s === 'male' || s === 'men') return 'M';
	if (s === 'f' || s === 'female' || s === 'women') return 'F';
	return null;
}

// =============================================================================
// LAYER 1: RAW DTO ACCESS
// =============================================================================

/**
 * Get the full database state - SERVER-SIDE ONLY
 * @returns {Object|null} Raw database state from OWLCMS
 */
export function getDatabaseState() {
	return competitionHub.getDatabaseState();
}

/**
 * Get the latest UPDATE message for a specific FOP - SERVER-SIDE ONLY
 * @param {string} fopName - FOP name (default: 'A')
 * @returns {Object|null} Latest UPDATE message with precomputed data
 */
export function getFopUpdate(fopName = 'A') {
	return competitionHub.getFopUpdate(fopName);
}

/**
 * Get session athletes (already flattened by hub)
 * These are athletes in the current lifting session with OWLCMS-computed display values
 * @param {string} fopName - FOP name
 * @returns {Array} Array of flat athlete objects (no spacers)
 */
function getSessionAthletes(fopName) {
	return competitionHub.getSessionAthletes(fopName) || [];
}

/**
 * Get session entries including spacers (for order preservation)
 * @param {string} fopName - FOP name
 * @returns {Array} Array of athlete objects and spacer markers
 */
function getSessionEntries(fopName) {
	return competitionHub.getStartOrderEntries(fopName, { includeSpacers: true }) || [];
}

// =============================================================================
// LAYER 2: ATHLETE ENRICHMENT (WRAPPING)
// =============================================================================

/**
 * Extract next requested weight from attempts array
 * @param {Array} attempts - Array of attempt objects [{liftStatus, stringValue}, ...]
 * @returns {number} Next requested weight or 0
 */
function getNextRequestedWeight(attempts) {
	if (!Array.isArray(attempts)) return 0;
	// V2 format: attempts have { value, status } structure
	// Hub-normalized format: attempts have { stringValue, liftStatus } structure
	const nextAttempt = attempts.find(a => {
		if (!a) return false;
		const status = a.liftStatus || a.status;
		return status === 'request' || status === 'current' || status === 'next';
	});
	if (!nextAttempt) return 0;
	
	// Parse weight from value (V2) or stringValue (hub-normalized)
	const weight = parseInt(nextAttempt.value ?? nextAttempt.stringValue, 10);
	return isNaN(weight) ? 0 : weight;
}

/**
 * Count how many snatch attempts have been completed (good or bad) for this athlete
 * @param {Object} athlete - Athlete with sattempts array
 * @returns {number} Number of completed snatch attempts (0-3)
 */
function countCompletedSnatches(athlete) {
	if (!athlete?.sattempts || !Array.isArray(athlete.sattempts)) return 0;
	let count = 0;
	for (const a of athlete.sattempts) {
		if (!a) continue;
		const status = (a.liftStatus || a.status || '').toString().toLowerCase();
		if (status === 'good' || status === 'bad') count++;
	}
	return count;
}

/**
 * Count how many clean & jerk attempts have been completed (good or bad) for this athlete
 * @param {Object} athlete - Athlete with cattempts array
 * @returns {number} Number of completed C&J attempts (0-3)
 */
function countCompletedCleanJerks(athlete) {
	if (!athlete?.cattempts || !Array.isArray(athlete.cattempts)) return 0;
	let count = 0;
	for (const a of athlete.cattempts) {
		if (!a) continue;
		const status = (a.liftStatus || a.status || '').toString().toLowerCase();
		if (status === 'good' || status === 'bad') count++;
	}
	return count;
}

/**
 * Get the next requested weight from an attempts array (first attempt with pending status)
 * @param {Array} attempts - Array of attempt objects
 * @returns {number} Next requested weight or 0
 */
function getNextRequest(attempts) {
	if (!Array.isArray(attempts)) return 0;
	for (const a of attempts) {
		if (!a) continue;
		const status = (a.liftStatus || a.status || '').toString().toLowerCase();
		if (status === 'request' || status === 'current' || status === 'next') {
			const weight = parseInt(a.value ?? a.stringValue, 10);
			return isNaN(weight) ? 0 : weight;
		}
	}
	return 0;
}

/**
 * Calculate predicted total IF the next lift succeeds (for THIS athlete)
 * 
 * Rules - "if next lift succeeds":
 * - 0 attempts done (no lifts): first declared snatch (snatch only, no CJ)
 * - 1-2 attempts done (in snatch): next requested snatch (snatch only, no CJ)
 * - 3 attempts done (snatch complete): best snatch + first requested C&J  
 * - 4-5 attempts done (in C&J): best snatch + next requested C&J
 * - 6 attempts done (complete): best snatch + best C&J (actual final total)
 * 
 * @param {Object} athlete - Athlete with sattempts, cattempts, bestSnatch, bestCleanJerk
 * @returns {number} Predicted total if next lift succeeds
 */
function calculatePredictedIfNext(athlete) {
	if (!athlete) return 0;
	
	const bestSnatch = parseFormattedNumber(athlete.bestSnatch) || 0;
	const bestCJ = parseFormattedNumber(athlete.bestCleanJerk) || 0;
	
	const snatchesDone = countCompletedSnatches(athlete);
	const cjsDone = countCompletedCleanJerks(athlete);
	const totalAttemptsDone = snatchesDone + cjsDone;
	
	// 6 attempts done - competition complete, return actual total
	if (totalAttemptsDone >= 6) {
		return bestSnatch + bestCJ;
	}
	
	// 4-5 attempts done (in C&J phase) - predict with next C&J request
	if (totalAttemptsDone >= 4 && totalAttemptsDone < 6) {
		const nextCJ = getNextRequest(athlete.cattempts);
		if (nextCJ > 0) {
			// If next C&J succeeds, total = bestSnatch + nextCJ
			return bestSnatch + nextCJ;
		}
		// No next request (shouldn't happen), return current total
		return bestSnatch + bestCJ;
	}
	
	// 3 attempts done (snatch complete, starting C&J) - predict with first C&J request
	if (totalAttemptsDone === 3) {
		const firstCJ = getNextRequest(athlete.cattempts);
		if (firstCJ > 0) {
			return bestSnatch + firstCJ;
		}
		// No C&J request yet
		return bestSnatch;
	}
	
	// 1-2 attempts done (in snatch phase) - predict with next snatch ONLY (no CJ)
	if (totalAttemptsDone >= 1 && totalAttemptsDone < 3) {
		const nextSnatch = getNextRequest(athlete.sattempts);
		if (nextSnatch > 0) {
			// If next snatch succeeds, predicted = nextSnatch (no CJ yet)
			return nextSnatch;
		}
		// No next snatch request (shouldn't happen)
		return bestSnatch;
	}
	
	// 0 attempts done - predict with first snatch ONLY (no CJ)
	if (totalAttemptsDone === 0) {
		const firstSnatch = getNextRequest(athlete.sattempts);
		if (firstSnatch > 0) {
			return firstSnatch;
		}
		return 0; // No declarations yet
	}
	
	// Fallback
	return bestSnatch + bestCJ;
}

/**
 * Calculate predicted total while optionally ignoring the first clean & jerk declaration.
 * When includeCjDeclaration=true: Include C&J declaration in the prediction (during snatch phase, shows snatch + C&J decl)
 * When includeCjDeclaration=false: Only snatch total until first C&J attempt is recorded (during snatch phase, shows snatch only)
 * @param {Object} athlete - Athlete data
 * @param {boolean} includeCjDeclaration - Whether to include the first CJ declaration in the prediction
 * @returns {number}
 */
function calculatePredictedTotal(athlete, includeCjDeclaration = true) {
	if (!athlete) return 0;

	const snatchesDone = countCompletedSnatches(athlete);
	const cjsDone = countCompletedCleanJerks(athlete);
	
	// During snatch phase (< 3 snatches done), special handling for includeCjDeclaration
	if (snatchesDone < 3) {
		const nextSnatch = getNextRequest(athlete.sattempts);
		const bestSnatch = nextSnatch > 0 ? nextSnatch : (parseFormattedNumber(athlete.bestSnatch) || 0);
		
		// If includeCjDeclaration is true, add the first C&J request
		if (includeCjDeclaration) {
			const firstCJ = getNextRequest(athlete.cattempts);
			if (firstCJ > 0) {
				return bestSnatch + firstCJ;
			}
		}
		// If includeCjDeclaration is false, return snatch-only total
		return bestSnatch;
	}

	// If snatch phase is complete (>= 3 snatches done), use standard prediction logic
	return calculatePredictedIfNext(athlete);
}

/**
 * Check if athlete's total is definitively zero (all attempts completed with no successful lifts)
 * @param {Object} athlete - Athlete object
 * @returns {boolean}
 */
function isDefinitiveTotalZero(athlete) {
	if (!athlete) return false;
	const total = parseFormattedNumber(athlete.total ?? athlete.displayTotal ?? 0);
	if (total !== 0) return false;

	const attempts = [];
	if (Array.isArray(athlete.sattempts)) attempts.push(...athlete.sattempts);
	if (Array.isArray(athlete.cattempts)) attempts.push(...athlete.cattempts);

	// If any attempt is still pending, not definitive
	for (const a of attempts) {
		if (!a) return false;
		const status = (a.liftStatus || a.status || '').toString().toLowerCase();
		if (status === 'request' || status === 'empty' || status === 'current' || status === 'next') return false;
	}

	return true;
}

/**
 * Create a TeamAthlete from a session athlete (from OWLCMS UPDATE message)
 * Session athletes already have OWLCMS-computed fields (bestSnatch, bestCleanJerk, sattempts/cattempts with status)
 * Does NOT mutate the original DTO - returns a new TeamAthlete object
 * 
 * @param {Object} sessionAthlete - Raw session athlete from hub (already flattened)
 * @param {Object} context - Context for enrichment
 * @param {number|null} context.liftingOrder - Position in lifting order
 * @param {number|null} context.bodyWeight - Body weight (from database if not in session)
 * @returns {Object} TeamAthlete with uniform structure for team scoring
 */
function teamAthleteFromSession(sessionAthlete, context = {}) {
	const { liftingOrder = null, bodyWeight = null, includeCjDeclaration = true } = context;
	
	// Use body weight from context (merged from database) or from session athlete
	const athleteBodyWeight = bodyWeight ?? sessionAthlete.bodyWeight ?? 0;
	const normalizedGender = normalizeGender(sessionAthlete.gender);
	
	// Calculate actual values from session athlete data
	const bestSnatchValue = parseFormattedNumber(sessionAthlete.bestSnatch);
	const bestCleanJerkValue = parseFormattedNumber(sessionAthlete.bestCleanJerk);
	const actualTotal = bestSnatchValue + bestCleanJerkValue;
	const hasResults = bestSnatchValue > 0 || bestCleanJerkValue > 0;
	
	// Calculate actual score (Sinclair)
	const actualScore = (actualTotal > 0 && normalizedGender && athleteBodyWeight > 0)
		? CalculateSinclair2024(actualTotal, athleteBodyWeight, normalizedGender)
		: 0;
	
	// Calculate predicted total if next lift succeeds
	const predictedTotal = calculatePredictedTotal(sessionAthlete, includeCjDeclaration);
	const predictedScore = (predictedTotal > 0 && normalizedGender && athleteBodyWeight > 0)
		? CalculateSinclair2024(predictedTotal, athleteBodyWeight, normalizedGender)
		: 0;
	
	// Determine if total is definitively zero
	const definitiveZero = isDefinitiveTotalZero(sessionAthlete);
	
	// Format display values
	const displayTotal = hasResults ? actualTotal : '-';
	const displayScore = actualScore > 0 ? actualScore.toFixed(2) : (definitiveZero ? '0.00' : '-');
	const displayPredictedScore = predictedScore > 0 ? predictedScore.toFixed(2) : (definitiveZero ? '0.00' : '-');
	
	// Return wrapped athlete - original DTO is preserved, enrichments are added
	const athleteKey = normalizeKey(sessionAthlete.key ?? sessionAthlete.athleteKey);
	return {
		// Original session athlete data (spread to preserve all fields)
		...sessionAthlete,
		
		// Key for lookups (normalized)
		athleteKey,
		
		// Mark source
		_source: 'session',
		_originalDto: sessionAthlete,
		
		// Body weight (may be enriched from database)
		bodyWeight: athleteBodyWeight,
		
		// Enrichment: actual computed values
		actualTotal,
		actualScore,
		
		// Enrichment: predicted values (if next lift succeeds)
		nextTotal: predictedTotal,
		nextScore: predictedScore,
		
		// Enrichment: display values
		displayTotal,
		displayScore,
		displayNextScore: displayPredictedScore,
		isDefinitiveZero: definitiveZero,
		
		// Enrichment: ordering
		liftingOrder,
		
		// Markers
		inCurrentSession: true
	};
}

/**
 * Compute best lift from raw attempt values (database format)
 * @param {Array<string|number>} attempts - Array of actual lift values (e.g., [100, -105, 105])
 * @returns {number} Best successful lift or 0
 */
function computeBestLift(attempts) {
	let best = 0;
	for (const attempt of attempts) {
		if (attempt === null || attempt === undefined || attempt === '' || attempt === '-') continue;
		const val = parseInt(attempt, 10);
		if (isNaN(val) || val <= 0) continue; // Skip failed lifts (negative) and invalid
		if (val > best) best = val;
	}
	return best;
}

/**
 * Format a single attempt from database raw fields into display format
 * Priority: change2 > change1 > declaration > automaticProgression (last available wins)
 * 
 * @param {string|number} declaration - Initial declared weight
 * @param {string|number} change1 - First change
 * @param {string|number} change2 - Second change
 * @param {string|number} actualLift - Actual lift result (negative = fail)
 * @returns {Object} { stringValue, liftStatus } matching hub normalized format
 */
function formatAttemptFromDatabase(declaration, change1, change2, actualLift, automaticProgression = null) {
	// If actual lift exists (not null), it's been attempted
	// null means not yet attempted; 0 or negative means failed lift
	if (actualLift !== null && actualLift !== undefined) {
		const val = parseInt(actualLift, 10);
		if (!isNaN(val)) {
			if (val > 0) {
				return { stringValue: String(val), liftStatus: 'good' };
			} else {
				// Zero or negative = failed lift (display absolute value)
				const decl = parseInt(declaration, 10) || 0;
				return { stringValue: String(Math.abs(val) || decl || '-'), liftStatus: 'bad' };
			}
		}
	}
	
	// Not yet attempted - find the current request weight (last available wins)
	const requestWeight = getLastRequestWeight({ declaration, change1, change2, automaticProgression });
	if (requestWeight !== null) {
		return { stringValue: String(requestWeight), liftStatus: 'request' };
	}
	
	// No data
	return { stringValue: '-', liftStatus: 'empty' };
}

/**
 * Get the last valid value in the request sequence for an attempt
 * Priority: change2 > change1 > declaration > automaticProgression
 * (last available wins, but "0" or empty values are skipped)
 */
function getLastRequestWeight(attempt) {
	if (!attempt) return null;
	
	// Check in reverse priority order - last available wins
	const candidates = [
		attempt.change2,
		attempt.change1,
		attempt.declaration,
		attempt.automaticProgression
	];
	
	for (const candidate of candidates) {
		if (candidate === null || candidate === undefined || candidate === '') continue;
		const val = parseInt(candidate, 10);
		if (!isNaN(val) && val > 0) {
			return val;
		}
	}
	return null;
}

/**
 * Determine the current requested weight for a lift (snatch or C&J)
 * Finds the first attempt with a request weight that hasn't been attempted
 * @param {Array} attempts - Array of attempt data [{declaration, change1, change2, actualLift, automaticProgression}, ...]
 * @returns {number|null} The requested weight for the current attempt, or null if all attempts are filled or have no requests
 */
function getCurrentRequestedWeight(attempts) {
	if (!Array.isArray(attempts)) return null;
	
	for (const attempt of attempts) {
		if (!attempt) continue;
		
		// If this attempt has no actual lift (not yet attempted), check for request weight
		if (attempt.actualLift === null || attempt.actualLift === undefined) {
			const requestWeight = getLastRequestWeight(attempt);
			if (requestWeight !== null) {
				// Found the first incomplete attempt with a valid request - return it
				return requestWeight;
			}
			// This attempt has no request weight, continue looking at next attempts
		}
	}
	
	// No more incomplete attempts with requests found
	return null;
}

// Unicode non-breaking space for empty attempt cells (matches OWLCMS format)
const NBSP = '\u00A0';

/**
 * Build formatted attempts array for a lift (snatch or C&J)
 * NOTE: Database-only reconstruction should use 'request' status, NOT 'current'.
 * The 'current' and 'next' statuses are session-specific and only come from
 * OWLCMS's displayInfo for session athletes.
 * @param {Array} attemptDtos - Array of attempt data
 * @returns {Array} Formatted attempts with liftStatus: 'good', 'bad', 'request', or 'empty'
 */
function buildFormattedAttempts(attemptDtos) {
	if (!Array.isArray(attemptDtos)) return [];

	let foundFirstRequest = false;

	// Format each attempt - use 'request' for pending weights (not 'current')
	// 'current' and 'next' are session-specific and only set by OWLCMS displayInfo
	return attemptDtos.map((dto) => {
		if (!dto) return { stringValue: NBSP, liftStatus: 'empty' };

		// If actual lift exists, return result status
		if (dto.actualLift !== null && dto.actualLift !== undefined) {
			const val = parseInt(dto.actualLift, 10);
			if (!isNaN(val)) {
				if (val > 0) {
					return { stringValue: String(val), liftStatus: 'good' };
				} else {
					// Zero or negative = failed lift (display absolute value)
					// If value is 0, it's a "not taken" lift - show hyphen with bad status
					const absVal = Math.abs(val);
					const displayVal = absVal === 0 ? '-' : String(absVal || dto.declaration || '-');
					return { stringValue: displayVal, liftStatus: 'bad' };
				}
			}
		}

		// Not yet attempted - find the request weight (last available in sequence)
		const requestWeight = getLastRequestWeight(dto);
		if (requestWeight !== null) {
			// Only show the FIRST request in the sequence as 'request'
			// Subsequent requests are forced empty (no value shown)
			if (!foundFirstRequest) {
				foundFirstRequest = true;
				// Always use 'request' for database reconstruction
				// 'current' and 'next' only come from OWLCMS session data
				return { stringValue: String(requestWeight), liftStatus: 'request' };
			} else {
				// Found a subsequent request - force empty with no value
				return { stringValue: NBSP, liftStatus: 'empty' };
			}
		}

		// No data - use nbsp for empty cell
		return { stringValue: NBSP, liftStatus: 'empty' };
	});
}

function mapAttemptsToDisplayInfo(formattedAttempts) {
	return (formattedAttempts || []).map((attempt) => {
		// Check for empty: no attempt, no stringValue, hyphen, or nbsp
		if (!attempt || !attempt.stringValue || attempt.stringValue === '-' || attempt.stringValue === NBSP) {
			return { value: null, status: null };
		}

		const status = attempt.liftStatus === 'empty' ? null : attempt.liftStatus;
		return {
			value: attempt.stringValue,
			status
		};
	});
}


/**
 * Create a TeamAthlete from a database athlete (from OWLCMS DATABASE message)
 * Database athletes lack OWLCMS-computed fields, so we compute them here
 * Does NOT mutate the original DTO - returns a new TeamAthlete object
 * 
 * @param {Object} dbAthlete - Raw database athlete from databaseState.athletes
 * @param {Object} context - Context for enrichment
 * @param {number|null} context.liftingOrder - Position in lifting order (if known)
 * @returns {Object} TeamAthlete with uniform structure for team scoring (same as teamAthleteFromSession)
 */
function teamAthleteFromDatabase(dbAthlete, context = {}) {
	const { liftingOrder = null, includeCjDeclaration = true } = context;
	
	if (!dbAthlete) return null;
	
	const normalizedGender = normalizeGender(dbAthlete.gender);
	const athleteBodyWeight = parseFormattedNumber(dbAthlete.bodyWeight) || 0;
	
	// Format name as "LASTNAME, Firstname" to match OWLCMS session format
	const lastName = (dbAthlete.lastName || '').toUpperCase();
	const firstName = dbAthlete.firstName || '';
	const fullName = lastName && firstName ? `${lastName}, ${firstName}` : lastName || firstName || '';
	
	// Use teamName from V2 parser (already resolved) or fall back to resolving from team ID
	const teamName = dbAthlete.teamName || competitionHub.getTeamNameById(dbAthlete.team) || '';
	
	// Build sattempts array from raw database fields
	// Uses 'request' for pending weights (not 'current' - that's session-specific)
	const snatchAttempts = [
		{ declaration: dbAthlete.snatch1Declaration, change1: dbAthlete.snatch1Change1, change2: dbAthlete.snatch1Change2, actualLift: dbAthlete.snatch1ActualLift, automaticProgression: dbAthlete.snatch1AutomaticProgression },
		{ declaration: dbAthlete.snatch2Declaration, change1: dbAthlete.snatch2Change1, change2: dbAthlete.snatch2Change2, actualLift: dbAthlete.snatch2ActualLift, automaticProgression: dbAthlete.snatch2AutomaticProgression },
		{ declaration: dbAthlete.snatch3Declaration, change1: dbAthlete.snatch3Change1, change2: dbAthlete.snatch3Change2, actualLift: dbAthlete.snatch3ActualLift, automaticProgression: dbAthlete.snatch3AutomaticProgression }
	];
	const sattempts = buildFormattedAttempts(snatchAttempts);
	
	// Build cattempts array from raw database fields
	// Uses 'request' for pending weights (not 'current' - that's session-specific)
	const cjAttempts = [
		{ declaration: dbAthlete.cleanJerk1Declaration, change1: dbAthlete.cleanJerk1Change1, change2: dbAthlete.cleanJerk1Change2, actualLift: dbAthlete.cleanJerk1ActualLift, automaticProgression: dbAthlete.cleanJerk1AutomaticProgression },
		{ declaration: dbAthlete.cleanJerk2Declaration, change1: dbAthlete.cleanJerk2Change1, change2: dbAthlete.cleanJerk2Change2, actualLift: dbAthlete.cleanJerk2ActualLift, automaticProgression: dbAthlete.cleanJerk2AutomaticProgression },
		{ declaration: dbAthlete.cleanJerk3Declaration, change1: dbAthlete.cleanJerk3Change1, change2: dbAthlete.cleanJerk3Change2, actualLift: dbAthlete.cleanJerk3ActualLift, automaticProgression: dbAthlete.cleanJerk3AutomaticProgression }
	];
	const cattempts = buildFormattedAttempts(cjAttempts);
	
	// Compute best lifts from actual lift results
	const bestSnatch = computeBestLift([
		dbAthlete.snatch1ActualLift,
		dbAthlete.snatch2ActualLift,
		dbAthlete.snatch3ActualLift
	]);
	const bestCleanJerk = computeBestLift([
		dbAthlete.cleanJerk1ActualLift,
		dbAthlete.cleanJerk2ActualLift,
		dbAthlete.cleanJerk3ActualLift
	]);
	
	// Build a normalized athlete object that looks like a session athlete
	// This allows calculatePredictedIfNext to work the same way
	const normalizedAthlete = {
		sattempts,
		cattempts,
		bestSnatch,
		bestCleanJerk
	};
	
	// Calculate actual total
	const actualTotal = bestSnatch + bestCleanJerk;
	const hasResults = bestSnatch > 0 || bestCleanJerk > 0;
	
	// Calculate actual score (Sinclair)
	const actualScore = (actualTotal > 0 && normalizedGender && athleteBodyWeight > 0)
		? CalculateSinclair2024(actualTotal, athleteBodyWeight, normalizedGender)
		: 0;
	
	// Calculate predicted total if next lift succeeds
	const predictedTotal = calculatePredictedTotal(normalizedAthlete, includeCjDeclaration);
	const predictedScore = (predictedTotal > 0 && normalizedGender && athleteBodyWeight > 0)
		? CalculateSinclair2024(predictedTotal, athleteBodyWeight, normalizedGender)
		: 0;
	
	// Determine if total is definitively zero
	const definitiveZero = isDefinitiveTotalZero(normalizedAthlete);
	
	// Format display values
	const displayTotal = hasResults ? actualTotal : '-';
	const displayScore = actualScore > 0 ? actualScore.toFixed(2) : (definitiveZero ? '0.00' : '-');
	const displayPredictedScore = predictedScore > 0 ? predictedScore.toFixed(2) : (definitiveZero ? '0.00' : '-');
	
	// Return TeamAthlete - same structure as teamAthleteFromSession
	const athleteKey = normalizeKey(dbAthlete.key);
	
	// Format category for display - replace underscores with spaces
	const categoryDisplay = (dbAthlete.categoryCode || '').replace(/_/g, ' ');
	
	const displayInfoSattempts = mapAttemptsToDisplayInfo(sattempts);
	const displayInfoCattempts = mapAttemptsToDisplayInfo(cattempts);
	
	const displayInfo = {
		fullName,
		teamName,
		yearOfBirth: extractYearOfBirth(dbAthlete.fullBirthDate),
		gender: dbAthlete.gender,
		startNumber: String(dbAthlete.startNumber || ''),
		lotNumber: String(dbAthlete.lotNumber || ''),
		category: categoryDisplay,
		sattempts: displayInfoSattempts,
		cattempts: displayInfoCattempts,
		bestSnatch: bestSnatch > 0 ? String(bestSnatch) : '-',
		bestCleanJerk: bestCleanJerk > 0 ? String(bestCleanJerk) : '-',
		total: displayTotal,
		sinclairRank: '-',
		classname: '',
		group: dbAthlete.sessionName || '',
		subCategory: '',
		flagURL: '',
		flagClass: '',
		teamLength: teamName.length,
		custom1: '',
		custom2: '',
		membership: ''
	};
	
	return {
		// Key for lookups (OWLCMS unique identifier)
		key: dbAthlete.key,
		athleteKey,
		
		// displayInfo (computed equivalent for database athlete)
		displayInfo,
		
		// Computed display fields (matching session athlete format)
		fullName,
		firstName: dbAthlete.firstName,
		lastName: dbAthlete.lastName,
		teamName,  // Resolved from team ID using hub's indexed teams
		team: dbAthlete.team,  // Original team ID
		startNumber: dbAthlete.startNumber,
		lotNumber: dbAthlete.lotNumber,
		category: categoryDisplay,
		categoryName: categoryDisplay,
		gender: dbAthlete.gender,
		bodyWeight: athleteBodyWeight,
		yearOfBirth: extractYearOfBirth(dbAthlete.fullBirthDate),
		sessionName: dbAthlete.sessionName || '',
		group: dbAthlete.sessionName || '',
		
		// Computed attempts arrays (same format as session athlete)
		sattempts,
		cattempts,
		
		// Computed best lifts
		bestSnatch,
		bestCleanJerk,
		total: actualTotal,
		
		// Mark source
		_source: 'database',
		_originalDto: dbAthlete,
		
		// Enrichment: actual computed values
		actualTotal,
		actualScore,
		
		// Enrichment: predicted values (if next lift succeeds)
		nextTotal: predictedTotal,
		nextScore: predictedScore,
		
		// Enrichment: display values
		displayTotal,
		displayScore,
		displayNextScore: displayPredictedScore,
		isDefinitiveZero: definitiveZero,
		
		// Enrichment: ordering
		liftingOrder,
		
		// Markers
		inCurrentSession: false
	};
}

// Export for testing
export { calculatePredictedIfNext, calculatePredictedTotal, teamAthleteFromSession, teamAthleteFromDatabase };

// =============================================================================
// LAYER 3: TEAM GROUPING AND SCORING
// =============================================================================

/**
 * Get score from TeamAthlete for team scoring
 * Uses actualScore (computed Sinclair)
 * @param {Object} athlete - TeamAthlete
 * @returns {number}
 */
function getAthleteScore(athlete) {
	if (!athlete) return 0;
	if (typeof athlete.actualScore === 'number' && Number.isFinite(athlete.actualScore)) {
		return athlete.actualScore;
	}
	return 0;
}

/**
 * Compare two athletes for sorting within a team
 * Sort order: session name/number, then start number (if in current session), then lot number
 * @param {Object} a - First TeamAthlete
 * @param {Object} b - Second TeamAthlete
 * @returns {number} Comparison result
 */
function compareAthletesForTeamOrder(a, b) {
	// 1. Sort by session name/number (alphabetical/numerical)
	const sessionA = (a.group || a.sessionName || '').toString();
	const sessionB = (b.group || b.sessionName || '').toString();
	if (sessionA !== sessionB) {
		return sessionA.localeCompare(sessionB, undefined, { numeric: true });
	}
	
	// 2. Within same session, sort by start number (only current session athletes have start numbers)
	const startA = parseInt(a.startNumber, 10) || 999999;
	const startB = parseInt(b.startNumber, 10) || 999999;
	if (startA !== startB) {
		return startA - startB;
	}
	
	// 3. Fallback to lot number
	const lotA = parseInt(a.lotNumber, 10) || 999999;
	const lotB = parseInt(b.lotNumber, 10) || 999999;
	return lotA - lotB;
}

/**
 * Get predicted score from TeamAthlete
 * @param {Object} athlete - TeamAthlete
 * @returns {number}
 */
function getAthletePredictedScore(athlete) {
	if (!athlete) return 0;
	if (typeof athlete.nextScore === 'number' && Number.isFinite(athlete.nextScore)) {
		return athlete.nextScore;
	}
	return parseFormattedNumber(athlete.nextScore) || 0;
}

/**
 * Compare athletes by score with session as tiebreaker
 * Primary: higher score first
 * Tiebreaker: smaller session number first (earlier session = higher priority)
 * 
 * @param {Object} a - First athlete
 * @param {Object} b - Second athlete
 * @param {Function} scoreFn - Function to get score from athlete
 * @returns {number} Comparison result
 */
function compareByScoreWithSessionTiebreaker(a, b, scoreFn) {
	const scoreA = scoreFn(a);
	const scoreB = scoreFn(b);
	
	// Primary sort: higher score first
	if (scoreB !== scoreA) {
		return scoreB - scoreA;
	}
	
	// Tiebreaker: smaller session number first (earlier session = higher priority)
	const sessionA = (a.group || a.sessionName || '').toString();
	const sessionB = (b.group || b.sessionName || '').toString();
	return sessionA.localeCompare(sessionB, undefined, { numeric: true });
}

/**
 * Determine top contributors for a team (for actual or predicted scores)
 * 
 * When scores are equal, athletes from earlier sessions have priority
 * (smaller session number = higher priority)
 * 
 * @param {Array} athletes - Array of TeamAthlete objects for this team
 * @param {string} gender - Gender filter ('M', 'F', or 'MF')
 * @param {Function} scoreFn - Function to get score from athlete
 * @param {Object} topCounts - Top score counts { topM, topF, topMFm, topMFf }
 * @returns {Set} Set of athlete keys for top contributors
 */
function findTopContributors(athletes, gender, scoreFn, topCounts = {}) {
	const { topM = 4, topF = 4, topMFm = 2, topMFf = 2 } = topCounts;
	let topContributors = [];
	
	if (gender === 'MF') {
		// Mixed: top N men + top N women (configurable)
		const males = athletes.filter(a => normalizeGender(a.gender) === 'M');
		const females = athletes.filter(a => normalizeGender(a.gender) === 'F');
		
		// Sort each gender by score (highest first), with session as tiebreaker
		males.sort((a, b) => compareByScoreWithSessionTiebreaker(a, b, scoreFn));
		females.sort((a, b) => compareByScoreWithSessionTiebreaker(a, b, scoreFn));
		
		topContributors = [...males.slice(0, topMFm), ...females.slice(0, topMFf)];
	} else if (gender === 'F') {
		// Female only: top N by score (configurable)
		const byScore = [...athletes].sort((a, b) => compareByScoreWithSessionTiebreaker(a, b, scoreFn));
		topContributors = byScore.slice(0, topF);
	} else {
		// Male only (default): top N by score (configurable)
		const byScore = [...athletes].sort((a, b) => compareByScoreWithSessionTiebreaker(a, b, scoreFn));
		topContributors = byScore.slice(0, topM);
	}
	
	// Use athleteKey for identification (OWLCMS unique key)
	return new Set(
		topContributors.map(a => normalizeKey(a.athleteKey ?? a.key)).filter(Boolean)
	);
}

/**
 * Group TeamAthletes by team and compute team scores
 * 
 * Team score = sum of top N contributors' actualScore (Sinclair)
 *   - Single gender M: top topM by actualScore
 *   - Single gender F: top topF by actualScore  
 *   - Mixed (MF): top topMFm men + top topMFf women by actualScore
 * 
 * All highlighting is precomputed as CSS class names on each athlete:
 *   - scoreHighlightClass: CSS class for actual score cell (e.g., 'top-contributor-m', 'top-contributor-f', 'top-contributor')
 *   - nextScoreHighlightClass: CSS class for predicted score cell
 * 
 * Athletes within team are sorted by: session, start number, lot number
 * Teams are sorted by: team score (highest first)
 * 
 * @param {Array} teamAthletes - Array of TeamAthlete objects
 * @param {string} gender - Gender filter ('M', 'F', or 'MF')
 * @param {Object} headers - Translated headers
 * @param {Object} topCounts - Top score counts { topM, topF, topMFm, topMFf }
 * @returns {Array} Array of team objects ready for frontend display
 */
function groupByTeams(teamAthletes, gender, headers, topCounts = {}, includeAllAthletes = false) {
	const { topM = 4, topF = 4, topMFm = 2, topMFf = 2 } = topCounts;
	console.log(`[NVF groupByTeams] Input: ${teamAthletes.length} athletes, gender filter: ${gender}, topCounts: M=${topM}, F=${topF}, MFm=${topMFm}, MFf=${topMFf}, includeAll=${includeAllAthletes}`);
	
	// Filter athletes with no team
	const athletesWithTeams = teamAthletes.filter(a => {
		const teamName = (a.teamName ?? a.team ?? '').toString().trim();
		return teamName.length > 0;
	});
	
	console.log(`[NVF groupByTeams] After team filter: ${athletesWithTeams.length} athletes with teams`);
	
	// Filter by gender if not mixed
	const filteredAthletes = gender !== 'MF' 
		? athletesWithTeams.filter(a => normalizeGender(a.gender) === gender)
		: athletesWithTeams;
	
	console.log(`[NVF groupByTeams] After gender filter: ${filteredAthletes.length} athletes`);
	
	// Group by team
	const teamMap = new Map();
	filteredAthletes.forEach(athlete => {
		const teamName = (athlete.teamName ?? athlete.team ?? '').toString().trim();
		if (!teamMap.has(teamName)) {
			teamMap.set(teamName, []);
		}
		teamMap.get(teamName).push(athlete);
	});
	
	// Build team objects with scores
	const teams = Array.from(teamMap.entries()).map(([teamName, allTeamAthletes]) => {
		// Filter out spacers
		const athletes = allTeamAthletes.filter(a => !a.isSpacer);
		
		// Find top contributors for ACTUAL score
		const actualTopContributors = findTopContributors(athletes, gender, getAthleteScore, topCounts);
		
		// Find top contributors for PREDICTED score (may differ from actual!)
		const predictedTopContributors = findTopContributors(athletes, gender, getAthletePredictedScore, topCounts);
		
		// Calculate team scores
		let teamScore = 0;
		let teamNextScore = 0;
		
		athletes.forEach(a => {
			const athleteKey = normalizeKey(a.athleteKey ?? a.key);
			if (actualTopContributors.has(athleteKey)) {
				teamScore += getAthleteScore(a);
			}
			if (predictedTopContributors.has(athleteKey)) {
				teamNextScore += getAthletePredictedScore(a);
			}
		});
		
		// Precompute highlight class names for each athlete
		const athletesWithHighlighting = athletes.map(a => {
			const athleteKey = normalizeKey(a.athleteKey ?? a.key);
			const isActualContributor = actualTopContributors.has(athleteKey);
			const isPredictedContributor = predictedTopContributors.has(athleteKey);
			const athleteGender = normalizeGender(a.gender);
			
			// Determine CSS class for actual score highlight
			let scoreHighlightClass = '';
			if (!includeAllAthletes && isActualContributor) {
				if (gender === 'MF') {
					// In MF mode, differentiate by gender
					scoreHighlightClass = athleteGender === 'F' ? 'top-contributor-f' : 'top-contributor-m';
				} else {
					scoreHighlightClass = 'top-contributor';
				}
			}
			
			// Determine CSS class for predicted score highlight
			let nextScoreHighlightClass = '';
			if (!includeAllAthletes && isPredictedContributor) {
				if (gender === 'MF') {
					nextScoreHighlightClass = athleteGender === 'F' ? 'top-contributor-f' : 'top-contributor-m';
				} else {
					nextScoreHighlightClass = 'top-contributor';
				}
			}
			
			return {
				...a,
				scoreHighlightClass,
				nextScoreHighlightClass
			};
		});
		
		// Sort athletes within team by: session, start number, lot number
		athletesWithHighlighting.sort(compareAthletesForTeamOrder);
		
		// Count contributors (for display label)
		const contributorCount = actualTopContributors.size;
		
		// Build totalLabel using translations with placeholders
		// Tracker.TopMScores = "top {0} scores" for single gender
		// Tracker.TopMFScores = "top {0}+{1} scores" for mixed
		let totalLabel;
		if (includeAllAthletes) {
			totalLabel = '';
		} else if (gender === 'MF') {
			const template = headers?.topMFScores || 'top {0}+{1} scores';
			totalLabel = template.replace('{0}', topMFm).replace('{1}', topMFf);
		} else if (gender === 'F') {
			const template = headers?.topMScores || 'top {0} scores';
			totalLabel = template.replace('{0}', topF);
		} else {
			const template = headers?.topMScores || 'top {0} scores';
			totalLabel = template.replace('{0}', topM);
		}
		
		return {
			teamName,
			flagUrl: getFlagUrl(teamName, true),
			athletes: athletesWithHighlighting,
			athleteCount: athletes.length,
			// Label describing which athletes contribute to the team total
			totalLabel,
			teamScore,
			teamNextScore,
			contributorCount,
			contributorLabel: totalLabel
		};
	});
	
	// Sort teams by actual score (highest first), then by predicted score as tiebreaker
	teams.sort((a, b) => {
		const scoreDiff = b.teamScore - a.teamScore;
		if (scoreDiff !== 0) return scoreDiff;
		// Tiebreaker: team with better predicted score first
		return b.teamNextScore - a.teamNextScore;
	});
	
	return teams;
}

// =============================================================================
// TIMER AND DECISION EXTRACTION
// =============================================================================

/**
 * Extract both athlete and break timers from a FOP update.
 * Returns { timer, breakTimer } where each object contains:
 * { type: 'athlete'|'break', state: 'running'|'set'|'stopped', isActive, visible, timeRemaining, duration, startTime, displayText }
 * 
 * @param {Object} fopUpdate - The FOP update object from competition hub
 * @param {string} language - Language code for break text (e.g., 'no' for Norwegian)
 * @returns {Object} { timer, breakTimer }
 */
function extractTimers(fopUpdate, language = 'en') {
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
	const inBreakState = !breakPaused && !athleteTimerStarting && (fopState === 'BREAK' || normBreakEvent.includes('start') || normBreakEvent === 'breakstarted');

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
		visible: inBreakState && !decisionEvent,  // Show break timer only during break (unless decision blocks it)
		timeRemaining: computedBreakRemaining,    // 0 if no timing data
		duration: breakRemainingReported || parseInt(fopUpdate?.breakTimeAllowed || fopUpdate?.timeAllowed || 600000),
		startTime: breakStartMillisReported || null,
		displayText: breakDisplayText  // "STOP"/"STOPP" for INTERRUPTION mode, null otherwise
	};

	// Update athlete timer visibility: hide during break, show when not in break
	athleteTimer.visible = !inBreakState && athleteTimer.isActive;

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
function computeDisplayMode(timer, breakTimer, decision) {
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

function extractDecisionState(fopUpdate) {
	const eventType = fopUpdate?.athleteTimerEventType;
	if (eventType === 'StartTime') {
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

// =============================================================================
// MAIN SCOREBOARD DATA FUNCTION
// =============================================================================

/**
 * Get formatted scoreboard data for SSR/API (SERVER-SIDE ONLY)
 * 
 * For NVF team scoreboard:
 * - Uses session athletes from hub (already flattened, OWLCMS-computed values)
 * - Wraps each athlete with enrichment (sinclair, predictions)
 * - Groups by team and computes team scores
 * 
 * @param {string} fopName - FOP name (default: 'A')
 * @param {Object} options - User preferences
 * @returns {Object} Formatted data ready for browser consumption
 */
export function getScoreboardData(fopName = 'A', options = {}) {
	const fopUpdate = getFopUpdate(fopName);
	const databaseState = getDatabaseState();
	
	// Options
	const showRecords = options.showRecords ?? false;
	const sortBy = 'score';
	const currentAttemptInfo = options.currentAttemptInfo ?? true;
	const showPredicted = options.showPredicted !== 'false' && options.showPredicted !== false;
	const topN = options.topN ?? 0;
	const includeCjDeclaration = Boolean(options.cjDecl ?? true);
	const language = options.lang || options.language || 'no';
	const translations = competitionHub.getTranslations(language);
	const learningMode = process.env.LEARNING_MODE === 'true' ? 'enabled' : 'disabled';
	
	// Check if "include all athletes" mode is enabled
	const includeAllAthletes = options.allAthletes === true || options.allAthletes === 'true';
	
	// Top score counts for team scoring (configurable per federation)
	// When includeAllAthletes is true, use 10 for all counts (effectively includes everyone)
	const topCounts = includeAllAthletes ? {
		topM: 10,
		topF: 10,
		topMFm: 10,
		topMFf: 10
	} : {
		topM: parseInt(options.topM, 10) || 4,      // M mode: top N men
		topF: parseInt(options.topF, 10) || 4,      // F mode: top N women
		topMFm: parseInt(options.topMFm, 10) || 2,  // MF mode: top N men
		topMFf: parseInt(options.topMFf, 10) || 2   // MF mode: top N women
	};
	const sessionStatus = competitionHub.getSessionStatus(fopName);

	// Detect session gender from session athletes
	let helperDetectedGender = 'unknown';
	let helperDetectedAthlete = null;
	
	const sessionAthletes = getSessionAthletes(fopName);
	if (sessionAthletes.length > 0) {
		helperDetectedAthlete = sessionAthletes.find(a => a.fullName || a.startNumber) || sessionAthletes[0];
		helperDetectedGender = normalizeGender(helperDetectedAthlete?.gender) || normalizeGender(fopUpdate?.gender) || 'unknown';
	} else {
		helperDetectedGender = normalizeGender(fopUpdate?.gender) || 'unknown';
	}
	
	// Update last known gender if we detected one from the session
	if (helperDetectedGender && helperDetectedGender !== 'unknown') {
		lastKnownGenderByFop.set(fopName, helperDetectedGender);
	}
	
	// Get the last known gender for this FOP, defaulting to 'M' if never set
	const lastKnownGender = lastKnownGenderByFop.get(fopName) || 'M';
	
	console.log(`[NVF helpers] Detected session athlete: "${helperDetectedAthlete?.fullName || 'none'}" gender: ${helperDetectedGender}, lastKnown: ${lastKnownGender}`);

	// Resolve gender option
	// - Explicit URL parameter (M, F, MF) takes precedence
	// - 'current' uses detected gender from session, or last known, or 'M'
	// - No option: use detected gender from session, or last known, or 'M'
	let gender = 'M';
	
	if (options.gender === true) {
		// Legacy: gender=true means MF mode
		gender = 'MF';
	} else if (typeof options.gender === 'string') {
		const genderOption = String(options.gender).trim().toUpperCase();
		if (genderOption === 'CURRENT') {
			// Use detected gender, fall back to last known, then 'M'
			gender = (helperDetectedGender && helperDetectedGender !== 'unknown') 
				? helperDetectedGender 
				: lastKnownGender;
		} else if (genderOption === 'MF' || genderOption === 'M' || genderOption === 'F') {
			gender = genderOption === 'MF' ? 'MF' : normalizeGender(genderOption);
		} else {
			// Unknown option - treat as single gender or default
			gender = normalizeGender(options.gender) || lastKnownGender;
		}
	} else {
		// No explicit option: use detected gender, fall back to last known, then 'M'
		gender = (helperDetectedGender && helperDetectedGender !== 'unknown') 
			? helperDetectedGender 
			: lastKnownGender;
	}

	// Determine if we're actually in mixed-gender mode (explicit MF request)
	// Only show "2+2" text when user explicitly requests MF mode via URL parameter
	const isExplicitMixedMode = typeof options.gender === 'string' && 
		String(options.gender).trim().toUpperCase() === 'MF';

	// Helper to substitute {0}, {1}, etc. placeholders in translation strings
	const formatTranslation = (template, ...args) => {
		if (!template) return '';
		return args.reduce((str, arg, i) => str.replace(`{${i}}`, arg), template);
	};

	// Build headers from translations (all from OWLCMS, using Tracker.* keys for new ones)
	const headers = {
		order: translations['Tracker.Order'] || translations.Start || translations.Order || 'Order',
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
		session: translations['Tracker.Session'] || translations.Session || 'Session',
		// Translation templates for top scores labels
		topMScores: translations['Tracker.TopNScores'] || 'top {0} scores',
		topMFScores: translations['Tracker.TopNPlusNScores'] || 'top {0}+{1} scores',
		totalNextS: translations['Tracker.TotalNextScore'] || 'Total Next S',
		scoreNextS: translations['Tracker.ScoreNextScore'] || 'Score Next S',
		waitingForData: translations['Tracker.WaitingForData'] || 'Waiting for competition data...',
		noCompetitionData: translations['Tracker.WaitingForData'] || 'Waiting for competition data...',
		noAthleteLifting: translations['Tracker.NoAthleteLifting'] || 'No athlete currently lifting'
	};

	// Early return for waiting states - but only if we have NO data at all
	// If we have database data, show it even without an active session
	if (!fopUpdate && !databaseState) {
		return {
			competition: { name: headers.noCompetitionData, fop: 'unknown' },
			currentAthlete: null,
			timer: { state: 'stopped', timeRemaining: 0 },
			sessionStatus: { isDone: false, sessionName: '', lastActivity: 0 },
			teams: [],
			headers,
			status: 'waiting',
			message: headers.waitingForData,
			learningMode
		};
	}
	
	// If gender='current' but no session is active, default to 'M' (show all)
	// This allows displaying teams from database even before a session starts
	if (gender === 'MF' && helperDetectedGender === 'unknown' && databaseState?.athletes?.length > 0) {
		gender = 'M';
		console.log(`[NVF helpers] No active session, defaulting to M (show men from database)`);
	}

	// Check cache - include hub FOP version and resolved gender in cache key
	// Use shared buildCacheKey; include gender + options to differentiate views.
	const cacheKey = buildCacheKey({ fopName, includeFop: true, opts: { gender, ...options } });
	console.log(`[NVF helpers] Cache check: key=${String(cacheKey).substring(0, 120)}..., gender=${gender}`);
	
	if (nvfScoreboardCache.has(cacheKey)) {
		const cached = nvfScoreboardCache.get(cacheKey);
		console.log(`[NVF helpers] Cache HIT - returning cached data with ${cached.teams?.length || 0} teams`);
		let sessionStatusMessage = null;
		if (sessionStatus.isDone && fopUpdate?.fullName) {
			sessionStatusMessage = (fopUpdate.fullName || '').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—');
		}
		
		// Extract timers and compute display mode (what should be visible)
		const { timer, breakTimer } = extractTimers(fopUpdate, language);
		const decision = extractDecisionState(fopUpdate);
		const { displayMode, displayClass, activeTimer } = computeDisplayMode(timer, breakTimer, decision);
		
		return {
			...cached,
			timer: activeTimer,
			breakTimer,
			displayMode,
			displayClass,
			decision,
			sessionStatus,
			sessionStatusMessage,
			learningMode
		};
	}
	
	console.log(`[NVF helpers] Cache MISS - computing data for gender=${gender}`);

	// Determine current lift type
	const liftTypeKey = fopUpdate?.liftTypeKey || 'Snatch';
	const liftType = liftTypeKey === 'Snatch' ? 'snatch' : 'cleanJerk';
	const liftTypeLabel = liftType === 'snatch' 
		? (translations.Snatch || 'Snatch') 
		: (translations.Clean_and_Jerk || 'Clean & Jerk');
	
	// Build lifting order map for ordering info (keyed by athleteKey)
	const liftingOrderMap = new Map();
	if (Array.isArray(fopUpdate?.liftingOrderAthletes)) {
		let orderPosition = 1;
		for (const entry of fopUpdate.liftingOrderAthletes) {
			if (!entry || entry.isSpacer) continue;
			const athleteKey = normalizeKey(entry.athleteKey ?? entry.key);
			if (athleteKey && !liftingOrderMap.has(athleteKey)) {
				liftingOrderMap.set(athleteKey, orderPosition);
			}
			orderPosition += 1;
		}
	}
	
	// Determine platform state early (needed for session athlete processing)
	// fopState values: INACTIVE, BREAK, CURRENT_ATHLETE, TIME_STARTED, TIME_STOPPED, DOWN_SIGNAL, DECISION_VISIBLE, etc.
	// Any fopState other than INACTIVE means we have an active session
	const platformState = fopUpdate?.fopState || 'INACTIVE';
	const hasActiveSession = platformState !== 'INACTIVE';
	
	// =========================================================================
	// LAYER 2: Build ALL team athletes (session + database)
	// Session athletes have live data, database athletes have historical data
	// =========================================================================
	
	// Build session athletes map by key (for merging)
	const sessionAthletesByKey = new Map();
	
	// Only use session athletes if we have an active session
	if (hasActiveSession) {
		sessionAthletes
			.filter(athlete => !athlete.isSpacer)
			.forEach(sessionAthlete => {
				const athleteKey = normalizeKey(sessionAthlete.athleteKey ?? sessionAthlete.key);
				if (athleteKey) {
					sessionAthletesByKey.set(athleteKey, sessionAthlete);
				}
			});
	}
	
	// Process ALL database athletes - use session data if available, else database data
	const allTeamAthletes = [];
	
	console.log(`[NVF helpers] Database has ${databaseState?.athletes?.length || 0} athletes, session has ${sessionAthletesByKey.size} athletes`);
	
	if (databaseState?.athletes && Array.isArray(databaseState.athletes)) {
		for (const dbAthlete of databaseState.athletes) {
			const athleteKey = normalizeKey(dbAthlete.key);
			if (!athleteKey) {
				console.log(`[NVF helpers] Skipping athlete with no key:`, dbAthlete?.lastName);
				continue;
			}
			
			// Check if this athlete is in the current session
			const sessionAthlete = sessionAthletesByKey.get(athleteKey);
			
			if (sessionAthlete) {
				// Athlete is in current session - use session data (has live updates)
				const wrapped = teamAthleteFromSession(sessionAthlete, {
					liftType,
					liftingOrder: liftingOrderMap.get(athleteKey) ?? null,
					bodyWeight: dbAthlete.bodyWeight || sessionAthlete.bodyWeight || 0,
					includeCjDeclaration
				});
				allTeamAthletes.push(wrapped);
			} else {
				// Athlete is NOT in current session - use database data
				const wrapped = teamAthleteFromDatabase(dbAthlete, {
					liftingOrder: null, // Not in current lifting order
					includeCjDeclaration
				});
				if (wrapped) {
					allTeamAthletes.push(wrapped);
				} else {
					console.log(`[NVF helpers] teamAthleteFromDatabase returned null for:`, dbAthlete?.lastName);
				}
			}
		}
	}
	
	console.log(`[NVF helpers] Built ${allTeamAthletes.length} team athletes from database`);
	
	// Add flag URLs
	const athletesWithFlags = allTeamAthletes.map(athlete => ({
		...athlete,
		flagUrl: getFlagUrl(athlete.teamName || athlete.team, true)
	}));
	
	// =========================================================================
	// LAYER 3: Group by teams
	// =========================================================================
	const teams = groupByTeams(athletesWithFlags, gender, headers, topCounts, includeAllAthletes);
	
	console.log(`[NVF helpers] Grouped ${allTeamAthletes.length} athletes into ${teams.length} teams (gender=${gender})`);
	if (teams.length > 0) {
		teams.forEach(t => console.log(`[NVF helpers]   Team "${t.teamName}": ${t.athleteCount} athletes, score=${t.teamScore?.toFixed(2)}`));
	}
	
	// Determine if there's a current athlete lifting
	const hasCurrentAthlete = Boolean(fopUpdate?.fullName && platformState !== 'INACTIVE' && !sessionStatus.isDone);
	
	// Use sessionInfo from OWLCMS if available, otherwise build fallback
	// OWLCMS sends sessionInfo with format like "pulje P1.1 Rykk" (session name + lift type)
	let sessionInfo;
	if (fopUpdate?.sessionInfo) {
		// Use OWLCMS-provided sessionInfo directly
		sessionInfo = fopUpdate.sessionInfo;
	} else if (hasActiveSession && fopUpdate?.sessionName) {
		// Fallback: build from sessionName + lift type
		sessionInfo = `${headers.session} ${fopUpdate?.sessionName || 'A'} - ${liftTypeLabel}`;
	} else if (hasActiveSession) {
		// Active but no sessionName in message (e.g., timer-only message) - just show lift type
		sessionInfo = liftTypeLabel;
	} else {
		// No active session - show "Platform X"
		const platformLabel = translations.Platform || 'Platform';
		sessionInfo = `${platformLabel} ${fopName}`;
	}
	
	// Extract competition info
	const competition = {
		name: fopUpdate?.competitionName || databaseState?.competition?.name || 'Competition',
		fop: fopName,
		state: platformState,
		session: fopUpdate?.sessionName || '',
		liftType: hasActiveSession ? liftType : null,
		sessionInfo,
		// Visibility flags - no logic in svelte, all controlled here
		// showTimer: true if fopState indicates active competition (not INACTIVE)
		showWeight: hasCurrentAthlete,
		showTimer: hasActiveSession,
		showLiftType: hasActiveSession
	};

	// If no active session, clear start numbers for all athletes
	if (!hasActiveSession) {
		teams.forEach(team => {
			team.athletes.forEach(athlete => {
				athlete.startNumber = '';
			});
		});
	}

	// Extract current attempt - only if there's actually an athlete lifting
	let currentAttempt = null;
	let sessionStatusMessage = null;
	
	if (hasCurrentAthlete && fopUpdate?.fullName) {
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
			startTime: null
		};
	}
	
	// Session done message (separate from currentAttempt)
	if (sessionStatus.isDone && fopUpdate?.fullName) {
		sessionStatusMessage = (fopUpdate.fullName || '').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—');
	}

	// Extract timers and compute display mode
	const { timer, breakTimer } = extractTimers(fopUpdate, language);
	const decision = extractDecisionState(fopUpdate);
	const { displayMode, displayClass, activeTimer } = computeDisplayMode(timer, breakTimer, decision);
	
	// Compute max team name length for responsive layout
	const maxTeamNameLength = Math.max(0, ...teams.map(t => (t.teamName || '').length));
	const compactTeamColumn = maxTeamNameLength < 7;

	const responseOptions = {
		showRecords,
		sortBy,
		gender: options.gender !== undefined ? options.gender : undefined,
		currentAttemptInfo,
		showPredicted,
		topN,
		cjDecl: includeCjDeclaration
	};

	const result = {
		competition,
		currentAttempt,
		detectedAthlete: {
			fullName: helperDetectedAthlete?.fullName || helperDetectedAthlete?.startNumber || null,
			gender: helperDetectedGender || null
		},
		timer: activeTimer,
		breakTimer,
		displayMode,
		displayClass,
		sessionStatusMessage,
		teams,
		allAthletes: athletesWithFlags,
		stats: getCompetitionStats(databaseState),
		headers,
		displaySettings: fopUpdate?.showTotalRank || fopUpdate?.showSinclair ? {
			showTotalRank: fopUpdate.showTotalRank === 'true',
			showSinclair: fopUpdate.showSinclair === 'true',
			showLiftRanks: fopUpdate.showLiftRanks === 'true',
			showSinclairRank: fopUpdate.showSinclairRank === 'true'
		} : {},
		isBreak: fopUpdate?.break === 'true' || false,
		breakType: fopUpdate?.breakType,
		sessionStatus,
		compactTeamColumn,
		status: (fopUpdate || databaseState) ? 'ready' : 'waiting',
		lastUpdate: fopUpdate?.lastUpdate || Date.now(),
		options: responseOptions
	};
	
	// Cache result (excluding frequently changing fields)
	nvfScoreboardCache.set(cacheKey, {
		competition: result.competition,
		currentAttempt: result.currentAttempt,
		detectedAthlete: result.detectedAthlete,
		teams: result.teams,
		allAthletes: result.allAthletes,
		stats: result.stats,
		displaySettings: result.displaySettings,
		headers: result.headers,
		isBreak: result.isBreak,
		breakType: result.breakType,
		status: result.status,
		lastUpdate: result.lastUpdate,
		options: responseOptions
	});
	
	console.log(`[NVF] Cache now has ${nvfScoreboardCache.size} entries`);
    
	// Cleanup old cache entries (keep last 3)
	if (nvfScoreboardCache.size > 3) {
		const firstKey = nvfScoreboardCache.keys().next().value;
		nvfScoreboardCache.delete(firstKey);
	}

	return {
		...result,
		sessionStatus,
		decision,
		learningMode
	};
}

/**
 * Create a waiting response for when session data is not available
 */
function createWaitingResponse(fopName, fopUpdate, databaseState, headers, learningMode, gender, currentAttemptInfo, topN, showRecords, sortBy) {
	return {
		competition: { name: fopUpdate?.competitionName || databaseState?.competition?.name || 'Competition', fop: fopName },
		currentAttempt: null,
		detectedAthlete: { fullName: null, gender: null },
		timer: { state: 'stopped', timeRemaining: 0 },
		sessionStatus: { isDone: false, sessionName: '', lastActivity: 0 },
		teams: [],
		headers,
		status: 'waiting',
		learningMode,
		options: { showRecords, sortBy, gender, currentAttemptInfo, topN }
	};
}

// =============================================================================
// STATISTICS AND UTILITIES
// =============================================================================

/**
 * Get competition statistics
 */
export function getCompetitionStats(competitionState = null) {
	if (!competitionState) {
		competitionState = getDatabaseState();
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
	const teamsSet = [...new Set(athletes.map(a => a.teamName || a.team).filter(Boolean))];

	return {
		totalAthletes: athletes.length,
		activeAthletes: athletes.filter(a => a.total > 0 || a.bestSnatch > 0 || a.bestCleanJerk > 0).length,
		completedAthletes: athletes.filter(a => a.total > 0).length,
		categories,
		teams: teamsSet,
		averageTotal: athletes.filter(a => a.total > 0).reduce((sum, a, _, arr) => sum + a.total / arr.length, 0) || 0
	};
}

/**
 * Get top athletes from competition state
 */
export function getTopAthletes(competitionState, limit = 10) {
	if (!competitionState?.athletes || !Array.isArray(competitionState.athletes)) {
		return [];
	}

	return competitionState.athletes
		.filter(athlete => athlete && (athlete.total > 0 || athlete.bestSnatch > 0 || athlete.bestCleanJerk > 0))
		.sort((a, b) => {
			const totalA = a.total || 0;
			const totalB = b.total || 0;
			if (totalA !== totalB) return totalB - totalA;
			
			const sinclairA = a.sinclair || 0;
			const sinclairB = b.sinclair || 0;
			if (sinclairA !== sinclairB) return sinclairB - sinclairA;
			
			return (b.bestSnatch || 0) - (a.bestSnatch || 0);
		})
		.slice(0, limit);
}

/**
 * Get team rankings
 */
export function getTeamRankings() {
	return competitionHub.getTeamRankings();
}
