import { scoreboardRegistry } from '$lib/server/scoreboard-registry.js';
import { competitionHub } from '$lib/server/competition-hub.js';
import { loadLandingPageCategories } from '$lib/server/landing-page-categories.js';
import { existsSync, readdirSync } from 'fs';
import { resolve } from 'path';
import versionInfo from '$lib/server/version.json';

/**
 * Landing page - discovers available scoreboards and FOPs
 */
export async function load() {
	// Initialize registry if needed
	await scoreboardRegistry.initialize();
	
	// Get available scoreboards
	const allScoreboards = scoreboardRegistry.getAllScoreboards();
	const scoreboards = allScoreboards
		.filter(sb => !sb.isSubPage) // Exclude sub-pages (e.g., export pages)
		.map(sb => {
			const options = (sb.config.options || []).map((opt) => ({
				...opt,
				options: Array.isArray(opt.options) ? [...opt.options] : opt.options
			}));

			const config = {
				...sb.config,
				options
			};

			return {
				type: sb.type,
				name: sb.config.name,
				description: sb.config.description,
				options,
				isLowerThird: sb.config.isLowerThird || false,
				category: sb.config.category || 'standard',
				order: sb.config.order || 999,
				fopRequired: sb.config.fopRequired !== false, // Default to true if not specified
				standalone: sb.config.standalone || false, // Plugin works without OWLCMS data
				additionalDependencies: sb.config.additionalDependencies || [],
				config // Include full config for pages array access
			};
		});
	
	// Get available FOPs from competition data
	const availableFOPs = competitionHub.getAvailableFOPs();
	
	// Get competition info
	const databaseState = competitionHub.getDatabaseState();
	const competitionName = databaseState?.competition?.name || 'OWLCMS Competition';
		// Exposed generically so plugin options can reference any OWLCMS competition setting.
		const competitionSettings = databaseState?.competition || {};
	// Get available locales from loaded translations
	// Prefer hub locales; fall back to English so dropdown is never empty even if translations arrive late
	const hubLocales = competitionHub.getAvailableLocales();
	const availableLocales = (hubLocales.length > 0 ? hubLocales : ['en'])
		.filter((locale) => locale !== 'es_419');

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
		const translations = competitionHub.getTranslations({ locale });
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
	const landingPageCategories = loadLandingPageCategories(scoreboards);

	// Resolve all 'dynamic:*' option values server-side so the client receives
	// concrete arrays and doesn't need access to backend data or filesystem.
	for (const sb of scoreboards) {
		if (!sb.options) continue;
		const regEntry = allScoreboards.find(r => r.type === sb.type);
		for (const opt of sb.options) {
			if (typeof opt.options !== 'string' || !opt.options.startsWith('dynamic:')) continue;

			if (opt.options === 'dynamic:locales') {
				const defaultLang = opt.default || 'en';
				opt.options = [...availableLocales].sort((a, b) => {
					if (a === defaultLang) return -1;
					if (b === defaultLang) return 1;
					if (a === 'ia') return 1;
					if (b === 'ia') return -1;
					return (languageNames[a] || a).localeCompare(languageNames[b] || b);
				});
			} else if (opt.options === 'dynamic:templates') {
				// Scan the plugin's own templates/ directory
				const templates = [''];
				const pluginPath = regEntry?.pluginPath;
				if (pluginPath) {
					const templateDir = resolve('src/plugins', pluginPath, 'templates');
					if (existsSync(templateDir)) {
						try {
							for (const entry of readdirSync(templateDir, { withFileTypes: true })) {
								if (entry.isFile() && entry.name.endsWith('.json')) {
									templates.push(entry.name);
								}
							}
						} catch {
							// Non-fatal
						}
					}
				}
				opt.options = templates;
			}
		}
	}

	return {
		scoreboards,
		landingPageCategories,
		fops: availableFOPs,
		competitionName,
			competitionSettings,
		hasData: availableFOPs.length > 0,
		hasConfirmedFops: confirmedFopsAvailable,
		availableLocales,
		languageNames,
		versionInfo
	};
}
