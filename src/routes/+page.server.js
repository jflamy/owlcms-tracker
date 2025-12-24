import { scoreboardRegistry } from '$lib/server/scoreboard-registry.js';
import { competitionHub } from '$lib/server/competition-hub.js';

/**
 * Landing page - discovers available scoreboards and FOPs
 */
export async function load() {
	// Initialize registry if needed
	await scoreboardRegistry.initialize();
	
	// Get available scoreboards
	const allScoreboards = scoreboardRegistry.getAllScoreboards();
	const scoreboards = allScoreboards.map(sb => ({
		type: sb.type,
		name: sb.config.name,
		description: sb.config.description,
		options: sb.config.options || [],
		isLowerThird: sb.config.isLowerThird || false,
		category: sb.config.category || 'standard',
		order: sb.config.order || 999,
		fopRequired: sb.config.fopRequired !== false // Default to true if not specified
	}));
	
	// Get available FOPs from competition data
	const availableFOPs = competitionHub.getAvailableFOPs();
	
	// Get competition info
	const databaseState = competitionHub.getDatabaseState();
	const competitionName = databaseState?.competition?.name || 'OWLCMS Competition';
	
	// Get available locales from loaded translations
	// Prefer hub locales; fall back to English so dropdown is never empty even if translations arrive late
	const hubLocales = competitionHub.getAvailableLocales();
	const availableLocales = hubLocales.length > 0 ? hubLocales : ['en'];

	// Filter locales to BCP-47-ish strings to avoid RangeError in Intl.DisplayNames (allow _ as OWLCMS uses en_US style)
	const sanitizedLocales = availableLocales.filter((loc) => typeof loc === 'string' && /^[A-Za-z0-9_-]+$/.test(loc));
	const displayLocales = sanitizedLocales.length > 0 ? sanitizedLocales : ['en'];

	// Build language display names, falling back to Intl.DisplayNames when Tracker.LocaleName is absent
	const languageNames = {};
	let displayNames = null;
	if (typeof Intl !== 'undefined' && Intl.DisplayNames) {
		try {
			displayNames = new Intl.DisplayNames(displayLocales, { type: 'language' });
		} catch (err) {
			// If Intl.DisplayNames rejects locales, skip and rely on translation/fallbacks
			displayNames = null;
		}
	}
	const localePattern = /^[A-Za-z0-9_-]+$/;
	for (const locale of availableLocales) {
		const translations = competitionHub.getTranslations(locale);
		const translated = translations?.['Tracker.LocaleName'];
		let intlName = null;
		if (displayNames && localePattern.test(locale)) {
			try {
				intlName = displayNames.of(locale);
			} catch {
				// Invalid locale code for Intl, skip
			}
		}
		languageNames[locale] = translated || intlName || locale;
	}
	
	const confirmedFopsAvailable = typeof competitionHub.hasConfirmedFops === 'function'
		? competitionHub.hasConfirmedFops()
		: false;
	return {
		scoreboards,
		fops: availableFOPs,
		competitionName,
		hasData: availableFOPs.length > 0,
		hasConfirmedFops: confirmedFopsAvailable,
		availableLocales,
		languageNames
	};
}
