/**
 * Scoreboard Configuration
 *
 * Metadata for the "Medal Count" document
 */

export default {
	// Display name
	name: 'Medal Count',

	// Description for AI assistants
	description: 'How many gold/silver/bronze medals are needed for each session.',

	// Category for grouping in the UI
	category: 'documents',

	// on the home page, sort order within the category
	order: 105,

	// FOP requirement: false = not used, true = required, 'optional' = show All button
	fopRequired: false,

	// Whether this scoreboard requires athlete pictures
	requiresPictures: false,

	// User-configurable options
	options: [
		{
			key: 'language',
			label: 'Language',
			type: 'select',
			options: 'dynamic:locales',
			default: 'en',
			group: 'general',
			groupLabel: 'General',
			description: 'Choose document text language'
		},
		{
			key: 'medalsOverride',
			label: 'Override OWLCMS Medal Settings',
			type: 'boolean',
			default: false,
			group: 'medals',
			groupLabel: 'Medals',
			description: 'When off, medals follow the OWLCMS "Medals for snatch, clean&jerk, total" setting. When on, the checkboxes below decide which lifts are awarded medals.'
		},
		{
			key: 'medalsSnatch',
			label: 'Snatch Medals',
			type: 'boolean',
			default: false,
			group: 'medals',
			disabledBy: 'medalsOverride',
			effectiveWhenDisabled: { competitionSetting: 'snatchCJTotalMedals' },
			description: 'Award medals for snatch (only when overriding OWLCMS).'
		},
		{
			key: 'medalsCleanJerk',
			label: 'Clean & Jerk Medals',
			type: 'boolean',
			default: false,
			group: 'medals',
			disabledBy: 'medalsOverride',
			effectiveWhenDisabled: { competitionSetting: 'snatchCJTotalMedals' },
			description: 'Award medals for clean & jerk (only when overriding OWLCMS).'
		},
		{
			key: 'medalsTotal',
			label: 'Total Medals',
			type: 'boolean',
			default: true,
			group: 'medals',
			disabledBy: 'medalsOverride',
			effectiveWhenDisabled: true,
			description: 'Award medals for total (only when overriding OWLCMS).'
		}
	],

	// This document aggregates the whole competition
	multiPlatform: true
};
