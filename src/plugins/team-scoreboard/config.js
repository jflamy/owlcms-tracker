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

	// Sort order within category
	order: 100,

	// Whether this scoreboard requires athlete pictures
	requiresPictures: false,

	// User-configurable options
	options: [
		{
			key: 'scoringSystem',
			label: 'Scoring System',
			type: 'select',
			options: ['Sinclair', 'SMHF', 'Q-Points', 'Q-Masters', 'GAMX', 'GAMX-M', 'GAMX-A', 'GAMX-U'],
			default: 'Sinclair',
			group: 'display',
			description: 'Select the scoring system to use for individual and team scores.'
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
			default: false,
			group: 'display',
			description: 'Include first C&J attempt in predicted total'
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
	],

	// Required FOP data fields
	requiredFields: [
		'fullName',
		'startNumber',
		'teamName',
		'categoryName',
		'startOrderAthletes'
	],

	// AI prompt for modifications
	aiPrompt: `
This scoreboard displays team competition results with athletes grouped by team.

Data Structure:
- teams: Array of teams, each containing:
  - teamName: Name of the team
  - athletes: Array of athletes on this team
  - totalScore: Sum of team scoring (to be calculated)
- status: 'ready' | 'waiting'

To modify this scoreboard:
1. Update helpers.data.js to change team scoring logic
2. Update page.svelte to change the display
3. Update this config to add new options (e.g., number of counting athletes)
`
};
