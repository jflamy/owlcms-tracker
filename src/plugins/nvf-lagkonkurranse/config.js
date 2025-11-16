/**
 * Scoreboard Configuration
 * 
 * Metadata for the "NVF Lagkonkurranse" scoreboard
 */

export default {
	// Display name
	name: 'NVF Lagkonkurranse',
	
	// Description for AI assistants
	description: 'Norwegian team league competition scoreboard showing team rankings with athletes grouped by team',
	
	// Whether this scoreboard requires athlete pictures
	requiresPictures: false,
	
	// User-configurable options
	options: [
		{
			key: 'gender',
			label: 'Gender',
			type: 'select',
			options: ['MF', 'M', 'F'],
			default: 'MF',
			description: 'Filter athletes by gender'
		},
		{
			key: 'currentAttemptInfo',
			label: 'Show Current Attempt Info',
			type: 'boolean',
			default: false,
			description: 'Display current lifter information at the top'
		},
		{
			key: 'topN',
			label: 'Top N Athletes',
			type: 'number',
			default: 0,
			min: 0,
			max: 50,
			description: 'Show only top N men and top N women per team by score (0 = show all)'
		}
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
