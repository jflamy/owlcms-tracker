/**
 * Scoreboard Configuration
 * 
 * Metadata for the "Team Scoreboard" scoreboard
 */

export default {
	// Display name
	name: 'Team Scoreboard',

	// Description for AI assistants
	description: 'Team competition scoreboard with athletes grouped by team, showing current scores and predicted scores.',

	// Category for grouping in the UI
	category: 'team',

	// on the home page, sort order within the category
	order: 100,

	// Required resources that must be loaded before this plugin can render
	// When accessed, missing resources will be requested from OWLCMS via 428
	// Computes GAMX team scoring locally, so it pulls the GAMX param tables.
	requires: ['flags_zip', 'gamx_zip'],

	// Whether this scoreboard requires athlete pictures
	requiresPictures: false,

	// Runtime dependencies that are not bundled (externalized)
	additionalDependencies: ['exceljs'],

	// Additional pages this plugin provides (for export, configuration, etc.)
	pages: [
		{
			key: 'team-export',
			name: 'Export Results',
			icon: '📊',
			component: 'page-export.svelte'
		}
	],

	// User-configurable options
	options: [
		{
			key: 'scoringSystem',
			label: 'Scoring System',
			type: 'select',
			options: ['Sinclair', 'SMHF', 'Q-Points', 'Q-Masters', 'GAMX', 'GAMX-M', 'GAMX-A', 'GAMX-U', 'TeamPoints'],
			default: 'Sinclair',
			group: 'display',
			description: 'Select the scoring system. TeamPoints uses placement rankings (1st=tp1, 2nd=tp2, etc.) and respects snatch/C&J/total medals setting. Disables predicted scores.'
		},
		{
			key: 'gender',
			label: 'Gender',
			type: 'select',
			options: ['M', 'F', 'MF', 'Current'],
			default: 'Current',
			group: 'display',
			description: 'Select scoreboard gender: M, F, MF (mixed) or Current. Default: Current. When set to M, F or MF the scoreboard will respect that selection and not auto-switch. When set to Current (or when no gender is set in the URL) the scoreboard will follow the current session athlete gender provided by the server.'
		},
		{
			key: 'currentAttemptInfo',
			label: 'Show Current Attempt Info',
			type: 'boolean',
			default: true,
			group: 'display',
			description: 'Display current lifter information at the top'
		},
		{
			key: 'language',
			label: 'Language',
			type: 'select',
			options: 'dynamic:locales',
			default: 'en',
			group: 'display',
			description: 'Choose scoreboard text language'
		},
		{
			key: 'fixedTeamOrder',
			label: 'Keep Teams in Fixed Order',
			type: 'boolean',
			default: true,
			group: 'display',
			description: 'Keep teams in alphabetical order instead of re-sorting them by score'
		},
		{
			key: 'showPredicted',
			label: 'Show Predicted Totals',
			type: 'boolean',
			default: false,
			group: 'display',
			description: 'Show predicted total and score columns'
		},
		{
			key: 'cjDecl',
			label: 'Include CJ Declaration',
			type: 'boolean',
			default: true,
			group: 'display',
			description: 'Include first C&J attempt in predicted total'
		},
		{
			key: 'enforceBombout',
			label: 'Bomb-out on Snatch or CJ implies 0 Total',
			type: 'boolean',
			default: false,
			group: 'scoring',
			description: 'IWF rule: If an athlete fails all 3 attempts in snatch or C&J, their total is 0 (and thus their score is also 0)'
		},
		{
			key: 'allAthletes',
			label: 'Include All Athletes',
			type: 'boolean',
			default: true,
			group: 'scoring',
			description: 'Count all athletes toward team score (overrides individual top counts)'
		},
		{
			key: 'exportOnlyScoringAthletes',
			label: 'Export only the athletes included in the team score',
			type: 'boolean',
			default: true,
			group: 'export',
			groupLabel: 'Export',
			description: 'When enabled, Excel exports include only athletes who count toward each team total.'
		},
		{
			key: 'topM',
			label: 'M Team Top Scores',
			type: 'number',
			default: 4,
			min: 1,
			max: 10,
			group: 'scoring',
			disabledBy: 'allAthletes',
			description: 'Number of top male athletes counting toward team score in M mode'
		},
		{
			key: 'topF',
			label: 'F Team Top Scores',
			type: 'number',
			default: 4,
			min: 1,
			max: 10,
			group: 'scoring',
			disabledBy: 'allAthletes',
			description: 'Number of top female athletes counting toward team score in F mode'
		},
		{
			key: 'topMFm',
			label: 'MF Team Men Top Scores',
			type: 'number',
			default: 2,
			min: 1,
			max: 10,
			group: 'scoring',
			disabledBy: 'allAthletes',
			description: 'Number of top male athletes counting toward team score in MF (mixed) mode'
		},
		{
			key: 'topMFf',
			label: 'MF Team Women Top Scores',
			type: 'number',
			default: 2,
			min: 1,
			max: 10,
			group: 'scoring',
			disabledBy: 'allAthletes',
			description: 'Number of top female athletes counting toward team score in MF (mixed) mode'
		},
		{
			key: 'smhfOverrideSinclairYear',
			label: 'Override Sinclair Year for SMHF Calculations',
			type: 'select',
			options: ['2020', '2024', '2028'],
			default: '2020',
			group: 'smhf',
			groupLabel: 'SMHF',
			description: 'Override the base Sinclair coefficient year used for SMHF calculations. Default 2020 matches OWLCMS.'
		},
		{
			key: 'smhfAgeFactorYear',
			label: 'Age Factor Year for SMHF Calculations',
			type: 'select',
			options: ['2020', '2025'],
			default: '2020',
			group: 'smhf',
			groupLabel: 'SMHF',
			description: 'Select the masters age-factor table used for SMHF calculations. 2020 is the Standard SMHF table. 2025 uses the alternate published masters age factors.'
		}
	]
};
