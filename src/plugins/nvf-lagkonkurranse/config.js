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
			description: 'Select scoreboard gender: M, F, MF (mixed) or Current. Default: Current. When set to M, F or MF the scoreboard will respect that selection and not auto-switch. When set to Current (or when no gender is set in the URL) the scoreboard will follow the current session athlete gender provided by the server.'
		},
		{
			key: 'currentAttemptInfo',
			label: 'Show Current Attempt Info',
			type: 'boolean',
			default: false,
			description: 'Display current lifter information at the top'
		},
		{
			key: 'language',
			label: 'Language',
			type: 'select',
			options: ['en', 'no'],
			default: 'no',
			description: 'Choose scoreboard text language (English or Norwegian)'
		},
	],
	
	// Required FOP data fields
	requiredFields: [
		'fullName',
		'startNumber',
		'teamName',
		'categoryName',
		'groupAthletes'
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
