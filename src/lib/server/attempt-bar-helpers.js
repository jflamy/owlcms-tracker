/**
 * Attempt Bar Helpers - Shared presentation helpers for attempt bar display
 * 
 * This module provides hub-bound wrappers for tracker-core presentation functions.
 * These helpers are used by the CurrentAttemptBar component data providers.
 * 
 * Both standard scoreboards and plugin scoreboards (like team-scoreboard) should
 * import from this module to ensure consistent behavior.
 */

import { competitionHub } from '$lib/server/competition-hub.js';
import { getFlagUrl } from '$lib/server/flag-resolver.js';
import { 
	buildSessionInfo as _buildSessionInfo,
	buildAttemptLabel as _buildAttemptLabel,
	inferGroupName as _inferGroupName,
	inferBreakMessage as _inferBreakMessage,
	extractCurrentAttempt as _extractCurrentAttempt,
	isBreakMode
} from '@owlcms/tracker-core/utils';

// Re-export isBreakMode directly (no hub binding needed)
export { isBreakMode };

/**
 * Build sessionInfo string using tracker translations
 * Format: "Session M1 – Snatch" (using en-dash)
 * @param {Object} fopUpdate - FOP update object
 * @param {string} locale - Language locale code
 * @returns {string} - Session info string or empty string if no session
 */
export function buildSessionInfo(fopUpdate, locale = 'en') {
	return _buildSessionInfo(fopUpdate, competitionHub, locale);
}

/**
 * Build attempt label using tracker translations
 * Format: "Snatch #2" or "C&J #1" based on liftTypeKey and attemptNumber
 * @param {Object} fopUpdate - FOP update object
 * @param {string} locale - Language locale code
 * @returns {string} - Attempt label or empty string
 */
export function buildAttemptLabel(fopUpdate, locale = 'en') {
	return _buildAttemptLabel(fopUpdate, competitionHub, locale);
}

/**
 * Infer the group/session name for break display
 * Mirrors OWLCMS BreakDisplay.inferGroupName()
 * @param {Object} fopUpdate - FOP update object
 * @param {string} locale - Language locale code
 * @returns {string}
 */
export function inferGroupName(fopUpdate, locale = 'en') {
	return _inferGroupName(fopUpdate, competitionHub, locale);
}

/**
 * Infer the break message for break display
 * Mirrors OWLCMS BreakDisplay.inferMessage()
 * @param {string} breakType - Break type from fopUpdate
 * @param {string} ceremonyType - Ceremony type if applicable
 * @param {string} locale - Language locale code
 * @returns {string}
 */
export function inferBreakMessage(breakType, ceremonyType, locale = 'en') {
	return _inferBreakMessage(breakType, ceremonyType, competitionHub, locale);
}

/**
 * Extract current attempt info for display
 * Handles both normal athlete mode and break mode
 * @param {Object} fopUpdate - FOP update object
 * @param {string} locale - Language locale code
 * @returns {Object|null} - Current attempt info or null if no current athlete
 */
export function extractCurrentAttempt(fopUpdate, locale = 'en') {
	return _extractCurrentAttempt(fopUpdate, competitionHub, getFlagUrl, locale);
}
