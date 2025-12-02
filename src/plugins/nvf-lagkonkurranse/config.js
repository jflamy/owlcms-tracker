/**
 * Scoreboard Configuration
 * 
 * Metadata for the "NVF Lagkonkurranse" scoreboard
 */

export default {
	// Display name
	name: 'NVF Lagkonkurranse',

	// Description for AI assistants
	description: 'Norske lagkonkurranser med forutsatt totalt og poengsum hvis neste løft lykkes.<br><br>Norwegian team league competitions with predicted total and score if the next lift is successful.',

	// Category for grouping in the UI
	category: 'team',

	// Sort order within category
	order: 200,

	// Whether this scoreboard requires athlete pictures
	requiresPictures: false,

	// User-configurable options
	options: [
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
			default: 'no',
			group: 'display',
			description: 'Choose scoreboard text language / Velg språk for resultattavle'
		},
		{
			key: 'cjDecl',
			label: 'Include CJ Declaration',
			type: 'boolean',
			default: true,
			group: 'display',
			description: 'Include first C&J attempt in predicted total / Inkluder første støt i anslått sammenlagt'
		},
		{
			key: 'allAthletes',
			label: 'Include All Athletes',
			type: 'boolean',
			default: false,
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
This scoreboard displays NVF (Norwegian weightlifting) team league competition results with athletes grouped by team.

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
