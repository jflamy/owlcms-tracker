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
		order: sb.config.order || 999
	}));
	
	// Get available FOPs from competition data
	const availableFOPs = competitionHub.getAvailableFOPs();
	
	// Get competition info
	const databaseState = competitionHub.getDatabaseState();
	const competitionName = databaseState?.competition?.name || 'OWLCMS Competition';
	
	// Get available locales from loaded translations
	const availableLocales = competitionHub.getAvailableLocales();
	
	// Build language display names from Tracker.LocaleName translations
	const languageNames = {};
	for (const locale of availableLocales) {
		const translations = competitionHub.getTranslations(locale);
		// Use the locale's own name for itself (e.g., "Norsk" for 'no', "Français" for 'fr')
		languageNames[locale] = translations?.['Tracker.LocaleName'] || locale;
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
