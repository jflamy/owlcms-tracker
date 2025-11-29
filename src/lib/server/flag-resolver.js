/**
 * Flag resolver utility for scoreboards
 * Handles multiple flag formats and missing files gracefully
 */

import fs from 'fs';
import path from 'path';

const FLAG_EXTENSIONS = ['.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp'];
const FLAGS_DIR = path.join(process.cwd(), 'local', 'flags');

/**
 * Resolve flag path by country/team code
 * Tries exact match first, then uppercase, then each extension and returns first match or null
 * @param {string} countryCode - Country or team code (e.g., "USA", "COL", "CAN", "AK BJØRGVIN")
 * @returns {string|null} Relative path to flag (e.g., "local/flags/USA.svg") or null if not found
 */
export function resolveFlagPath(countryCode) {
	if (!countryCode || typeof countryCode !== 'string') {
		return null;
	}

	const trimmedCode = countryCode.trim();
	if (!trimmedCode) {
		return null;
	}

	// Try exact case first (for team names like "AK BJØRGVIN")
	for (const ext of FLAG_EXTENSIONS) {
		const fileName = `${trimmedCode}${ext}`;
		const fullPath = path.join(FLAGS_DIR, fileName);

		try {
			if (fs.existsSync(fullPath)) {
				console.log(`[Flag] ✓ Found (exact case): ${fileName}`);
				return `local/flags/${fileName}`;
			}
		} catch (error) {
			// Continue to next extension
			continue;
		}
	}

	// Try uppercase (for country codes like "USA")
	const upperCode = trimmedCode.toUpperCase();
	for (const ext of FLAG_EXTENSIONS) {
		const fileName = `${upperCode}${ext}`;
		const fullPath = path.join(FLAGS_DIR, fileName);

		try {
			if (fs.existsSync(fullPath)) {
				console.log(`[Flag] ✓ Found (uppercase): ${fileName}`);
				return `local/flags/${fileName}`;
			}
		} catch (error) {
			// Continue to next extension
			continue;
		}
	}

	// Not found - do not log to avoid noisy console output in production
	return null;
}

/**
 * Get flag URL for HTML img src
 * Returns either the actual flag path or a data URL with placeholder
 * @param {string} countryCode - Country or team code
 * @param {boolean} returnNull - If true, return null instead of placeholder for missing flags
 * @returns {string|null} URL suitable for img src or null
 */
export function getFlagUrl(countryCode, returnNull = false) {
	const flagPath = resolveFlagPath(countryCode);

	if (flagPath) {
		return `/${flagPath}`;
	}

	if (returnNull) {
		return null;
	}

	// Return a 1x1 transparent PNG as placeholder
	return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
}

/**
 * Get flag HTML element for embedding
 * @param {string} countryCode - Country or team code
 * @param {string} altText - Alternative text for accessibility
 * @param {string} className - CSS class to apply
 * @returns {string} HTML img element or empty string if not found
 */
export function getFlagHtml(countryCode, altText = '', className = 'flag') {
	const url = getFlagUrl(countryCode, true);

	if (!url) {
		return '';
	}

	const alt = altText || countryCode || 'Flag';
	const cls = className ? ` class="${className}"` : '';
	return `<img src="${url}" alt="${alt}"${cls} />`;
}

/**
 * Check if flag exists for country code
 * @param {string} countryCode - Country or team code
 * @returns {boolean} True if flag file exists
 */
export function hasFlagFile(countryCode) {
	return resolveFlagPath(countryCode) !== null;
}

/**
 * Get all available flag codes
 * Returns array of country/team codes that have flag files
 * @returns {string[]} Array of country codes (e.g., ["USA", "CAN", "COL"])
 */
export function getAvailableFlagCodes() {
	const codes = [];

	try {
		if (!fs.existsSync(FLAGS_DIR)) {
			return codes;
		}

		const files = fs.readdirSync(FLAGS_DIR);

		files.forEach((file) => {
			// Extract filename without extension
			const parsed = path.parse(file);

			// Check if it has a valid flag extension
			if (FLAG_EXTENSIONS.includes(parsed.ext.toLowerCase())) {
				codes.push(parsed.name.toUpperCase());
			}
		});
	} catch (error) {
		console.error('[Flag Resolver] Error reading flags directory:', error.message);
	}

	return codes;
}

/**
 * Get flag info object for use in scoreboards
 * Combines all flag data into single object
 * @param {string} countryCode - Country or team code
 * @returns {Object} Flag info object { code, url, html, exists }
 */
export function getFlagInfo(countryCode) {
	const url = getFlagUrl(countryCode, true);
	const html = getFlagHtml(countryCode);
	const exists = hasFlagFile(countryCode);

	return {
		code: countryCode,
		url,
		html,
		exists,
		flagPath: resolveFlagPath(countryCode)
	};
}
