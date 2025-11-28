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

// =============================================================================
// CACHE
// =============================================================================

/**
 * Plugin-specific cache to avoid recomputing team data on every browser request
 */
const nvfScoreboardCache = new Map();

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
	const { liftingOrder = null, bodyWeight = null } = context;
	
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
	const predictedIfNext = calculatePredictedIfNext(sessionAthlete);
	const predictedScore = (predictedIfNext > 0 && normalizedGender && athleteBodyWeight > 0)
		? CalculateSinclair2024(predictedIfNext, athleteBodyWeight, normalizedGender)
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
		nextTotal: predictedIfNext,
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
 * Priority: actualLift > change2 > change1 > declaration
 * 
 * @param {string|number} declaration - Initial declared weight
 * @param {string|number} change1 - First change
 * @param {string|number} change2 - Second change
 * @param {string|number} actualLift - Actual lift result (negative = fail)
 * @returns {Object} { stringValue, liftStatus } matching hub normalized format
 */
function formatAttemptFromDatabase(declaration, change1, change2, actualLift) {
	// If actual lift exists, it's been attempted
	if (actualLift !== null && actualLift !== undefined && actualLift !== '' && actualLift !== 0) {
		const val = parseInt(actualLift, 10);
		if (!isNaN(val)) {
			if (val > 0) {
				return { stringValue: String(val), liftStatus: 'good' };
			} else {
				// Negative = failed lift
				return { stringValue: String(Math.abs(val)), liftStatus: 'bad' };
			}
		}
	}
	
	// Not yet attempted - find the current request weight
	const requestWeight = change2 || change1 || declaration;
	if (requestWeight !== null && requestWeight !== undefined && requestWeight !== '' && requestWeight !== 0) {
		const val = parseInt(requestWeight, 10);
		if (!isNaN(val) && val > 0) {
			return { stringValue: String(val), liftStatus: 'request' };
		}
	}
	
	// No data
	return { stringValue: '', liftStatus: 'empty' };
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
	const { liftingOrder = null } = context;
	
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
	const sattempts = [
		formatAttemptFromDatabase(dbAthlete.snatch1Declaration, dbAthlete.snatch1Change1, dbAthlete.snatch1Change2, dbAthlete.snatch1ActualLift),
		formatAttemptFromDatabase(dbAthlete.snatch2Declaration, dbAthlete.snatch2Change1, dbAthlete.snatch2Change2, dbAthlete.snatch2ActualLift),
		formatAttemptFromDatabase(dbAthlete.snatch3Declaration, dbAthlete.snatch3Change1, dbAthlete.snatch3Change2, dbAthlete.snatch3ActualLift)
	];
	
	// Build cattempts array from raw database fields
	const cattempts = [
		formatAttemptFromDatabase(dbAthlete.cleanJerk1Declaration, dbAthlete.cleanJerk1Change1, dbAthlete.cleanJerk1Change2, dbAthlete.cleanJerk1ActualLift),
		formatAttemptFromDatabase(dbAthlete.cleanJerk2Declaration, dbAthlete.cleanJerk2Change1, dbAthlete.cleanJerk2Change2, dbAthlete.cleanJerk2ActualLift),
		formatAttemptFromDatabase(dbAthlete.cleanJerk3Declaration, dbAthlete.cleanJerk3Change1, dbAthlete.cleanJerk3Change2, dbAthlete.cleanJerk3ActualLift)
	];
	
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
	const predictedIfNext = calculatePredictedIfNext(normalizedAthlete);
	const predictedScore = (predictedIfNext > 0 && normalizedGender && athleteBodyWeight > 0)
		? CalculateSinclair2024(predictedIfNext, athleteBodyWeight, normalizedGender)
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
	
	return {
		// Key for lookups (OWLCMS unique identifier)
		key: dbAthlete.key,
		athleteKey,
		
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
		nextTotal: predictedIfNext,
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
export { calculatePredictedIfNext, teamAthleteFromSession, teamAthleteFromDatabase };

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
 * Determine top contributors for a team (for actual or predicted scores)
 * 
 * @param {Array} athletes - Array of TeamAthlete objects for this team
 * @param {string} gender - Gender filter ('M', 'F', or 'MF')
 * @param {Function} scoreFn - Function to get score from athlete
 * @returns {Set} Set of athlete keys for top contributors
 */
function findTopContributors(athletes, gender, scoreFn) {
	let topContributors = [];
	
	if (gender === 'MF') {
		// Mixed: top 2 men + top 2 women
		const males = athletes.filter(a => normalizeGender(a.gender) === 'M');
		const females = athletes.filter(a => normalizeGender(a.gender) === 'F');
		
		// Sort each gender by score (highest first)
		males.sort((a, b) => scoreFn(b) - scoreFn(a));
		females.sort((a, b) => scoreFn(b) - scoreFn(a));
		
		topContributors = [...males.slice(0, 2), ...females.slice(0, 2)];
	} else {
		// Single gender: top 4 by score
		const byScore = [...athletes].sort((a, b) => scoreFn(b) - scoreFn(a));
		topContributors = byScore.slice(0, 4);
	}
	
	// Use athleteKey for identification (OWLCMS unique key)
	return new Set(
		topContributors.map(a => normalizeKey(a.athleteKey ?? a.key)).filter(Boolean)
	);
}

/**
 * Group TeamAthletes by team and compute team scores
 * 
 * Team score = sum of top 4 contributors' actualScore (Sinclair)
 *   - Single gender: top 4 by actualScore
 *   - Mixed (MF): top 2 men + top 2 women by actualScore
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
 * @returns {Array} Array of team objects ready for frontend display
 */
function groupByTeams(teamAthletes, gender, headers) {
	console.log(`[NVF groupByTeams] Input: ${teamAthletes.length} athletes, gender filter: ${gender}`);
	
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
		const actualTopContributors = findTopContributors(athletes, gender, getAthleteScore);
		
		// Find top contributors for PREDICTED score (may differ from actual!)
		const predictedTopContributors = findTopContributors(athletes, gender, getAthletePredictedScore);
		
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
			if (isActualContributor) {
				if (gender === 'MF') {
					// In MF mode, differentiate by gender
					scoreHighlightClass = athleteGender === 'F' ? 'top-contributor-f' : 'top-contributor-m';
				} else {
					scoreHighlightClass = 'top-contributor';
				}
			}
			
			// Determine CSS class for predicted score highlight
			let nextScoreHighlightClass = '';
			if (isPredictedContributor) {
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
		
		return {
			teamName,
			flagUrl: getFlagUrl(teamName, true),
			athletes: athletesWithHighlighting,
			athleteCount: athletes.length,
			teamScore,
			teamNextScore,
			contributorCount,
			contributorLabel: headers?.top4scores || (gender === 'MF' ? 'top 2+2 scores' : 'top 4 scores')
		};
	});
	
	// Sort teams by actual score (highest first)
	teams.sort((a, b) => b.teamScore - a.teamScore);
	
	return teams;
}

// =============================================================================
// TIMER AND DECISION EXTRACTION
// =============================================================================

function extractTimerState(fopUpdate) {
	return {
		state: fopUpdate?.athleteTimerEventType === 'StartTime' ? 'running' : 
		       fopUpdate?.athleteTimerEventType === 'StopTime' ? 'stopped' : 
		       fopUpdate?.athleteTimerEventType === 'SetTime' ? 'set' :
		       fopUpdate?.athleteTimerEventType ? fopUpdate.athleteTimerEventType.toLowerCase() : 'stopped',
		timeRemaining: fopUpdate?.athleteMillisRemaining ? parseInt(fopUpdate.athleteMillisRemaining) : 0,
		duration: fopUpdate?.timeAllowed ? parseInt(fopUpdate.timeAllowed) : 60000,
		startTime: null
	};
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
	const currentAttemptInfo = options.currentAttemptInfo ?? false;
	const topN = options.topN ?? 0;
	const language = options.lang || options.language || 'no';
	const translations = competitionHub.getTranslations(language);
	const learningMode = process.env.LEARNING_MODE === 'true' ? 'enabled' : 'disabled';
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
	
	console.log(`[NVF helpers] Detected session athlete: "${helperDetectedAthlete?.fullName || 'none'}" gender: ${helperDetectedGender}`);

	// Resolve gender option
	const requestedGender = (typeof options.gender === 'string' || options.gender === true) ? options.gender : undefined;
	let gender = 'MF';
	
	if (options.gender === true) {
		gender = 'MF';
	} else if (typeof options.gender === 'string') {
		if (String(options.gender).trim().toLowerCase() === 'current') {
			gender = (helperDetectedGender && helperDetectedGender !== 'unknown') ? helperDetectedGender : 'MF';
		} else {
			gender = normalizeGender(options.gender) || 'MF';
		}
	} else {
		gender = (helperDetectedGender && helperDetectedGender !== 'unknown') ? helperDetectedGender : 'MF';
	}

	// Build headers from translations
	const headers = {
		order: language === 'no' ? 'Rekke\u00ADfølge' : (translations.Start || translations.Order || 'Order'),
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
		session: language === 'no' ? 'Pulje' : (translations.Session || 'Session'),
		top4scores: (gender === 'MF') 
			? (language === 'no' ? 'topp 2+2 poengsummer' : 'top 2+2 scores') 
			: (language === 'no' ? 'topp 4 poengsummer' : 'top 4 scores'),
		totalNextS: language === 'no' ? 'Total Neste F' : 'Total Next S',
		scoreNextS: language === 'no' ? 'Poeng Neste F' : 'Score Next S'
	};

	// Early return for waiting states - but only if we have NO data at all
	// If we have database data, show it even without an active session
	if (!fopUpdate && !databaseState) {
		return {
			competition: { name: 'No Competition Data', fop: 'unknown' },
			currentAthlete: null,
			timer: { state: 'stopped', timeRemaining: 0 },
			sessionStatus: { isDone: false, groupName: '', lastActivity: 0 },
			teams: [],
			headers,
			status: 'waiting',
			learningMode
		};
	}
	
	// If gender='current' but no session is active, default to 'M' (show all)
	// This allows displaying teams from database even before a session starts
	if (gender === 'MF' && helperDetectedGender === 'unknown' && databaseState?.athletes?.length > 0) {
		gender = 'M';
		console.log(`[NVF helpers] No active session, defaulting to M (show men from database)`);
	}

	// Check cache - include resolved gender in cache key
	const lastUpdate = fopUpdate?.lastDataUpdate || 0;
	const cacheKey = `${fopName}-${lastUpdate}-${gender}-${JSON.stringify(options)}`;
	
	console.log(`[NVF helpers] Cache check: key=${cacheKey.substring(0, 60)}..., gender=${gender}`);
	
	if (nvfScoreboardCache.has(cacheKey)) {
		const cached = nvfScoreboardCache.get(cacheKey);
		console.log(`[NVF helpers] Cache HIT - returning cached data with ${cached.teams?.length || 0} teams`);
		let sessionStatusMessage = null;
		if (sessionStatus.isDone && fopUpdate?.fullName) {
			sessionStatusMessage = (fopUpdate.fullName || '').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—');
		}
		
		return {
			...cached,
			timer: extractTimerState(fopUpdate),
			decision: extractDecisionState(fopUpdate),
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
	
	// =========================================================================
	// LAYER 2: Build ALL team athletes (session + database)
	// Session athletes have live data, database athletes have historical data
	// =========================================================================
	
	// Build session athletes map by key (for merging)
	const sessionAthletesByKey = new Map();
	sessionAthletes
		.filter(athlete => !athlete.isSpacer)
		.forEach(sessionAthlete => {
			const athleteKey = normalizeKey(sessionAthlete.athleteKey ?? sessionAthlete.key);
			if (athleteKey) {
				sessionAthletesByKey.set(athleteKey, sessionAthlete);
			}
		});
	
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
					bodyWeight: dbAthlete.bodyWeight || sessionAthlete.bodyWeight || 0
				});
				allTeamAthletes.push(wrapped);
			} else {
				// Athlete is NOT in current session - use database data
				const wrapped = teamAthleteFromDatabase(dbAthlete, {
					liftingOrder: null // Not in current lifting order
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
	const teams = groupByTeams(athletesWithFlags, gender, headers);
	
	console.log(`[NVF helpers] Grouped ${allTeamAthletes.length} athletes into ${teams.length} teams (gender=${gender})`);
	if (teams.length > 0) {
		teams.forEach(t => console.log(`[NVF helpers]   Team "${t.teamName}": ${t.athleteCount} athletes, score=${t.teamScore?.toFixed(2)}`));
	}
	
	// Extract competition info
	const competition = {
		name: fopUpdate?.competitionName || databaseState?.competition?.name || 'Competition',
		fop: fopName,
		state: fopUpdate?.fopState || 'INACTIVE',
		session: fopUpdate?.sessionName || 'A',
		liftType: liftType,
		groupInfo: `${language === 'no' ? 'Pulje' : (translations.Session || 'Session')} ${fopUpdate?.sessionName || 'A'} - ${liftTypeLabel}`
	};

	// Extract current attempt
	let currentAttempt = null;
	let sessionStatusMessage = null;
	
	if (fopUpdate?.fullName) {
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
		
		if (sessionStatus.isDone) {
			sessionStatusMessage = cleanFullName;
		}
	}

	const timer = extractTimerState(fopUpdate);
	
	// Compute max team name length for responsive layout
	const maxTeamNameLength = Math.max(0, ...teams.map(t => (t.teamName || '').length));
	const compactTeamColumn = maxTeamNameLength < 7;

	const result = {
		competition,
		currentAttempt,
		detectedAthlete: {
			fullName: helperDetectedAthlete?.fullName || helperDetectedAthlete?.startNumber || null,
			gender: helperDetectedGender || null
		},
		timer,
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
		options: { showRecords, sortBy, gender: requestedGender !== undefined ? requestedGender : undefined, currentAttemptInfo, topN }
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
		options: result.options
	});
	
	console.log(`[NVF] Cache now has ${nvfScoreboardCache.size} entries`);
	
	// Cleanup old cache entries
	if (nvfScoreboardCache.size > 3) {
		const firstKey = nvfScoreboardCache.keys().next().value;
		nvfScoreboardCache.delete(firstKey);
	}

	return {
		...result,
		sessionStatus,
		decision: extractDecisionState(fopUpdate),
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
		sessionStatus: { isDone: false, groupName: '', lastActivity: 0 },
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
