/**
 * Scoreboard Configuration
 * 
 * Metadata for the "Team Scoreboard" scoreboard
 */

export default {
	// Display name
	name: 'Team Scoreboard',
	
	// Description for AI assistants
	description: 'Shows team competition results with athletes grouped by team',
	
	// User-configurable options
	options: [
		{
			key: 'showRecords',
			label: 'Show Records',
			type: 'boolean',
			default: false,
			description: 'Display competition records alongside athlete attempts'
		},
		{
			key: 'sortBy',
			label: 'Sort Teams By',
			type: 'select',
			options: ['total', 'name'],
			default: 'total',
			description: 'How to sort teams (by total score or alphabetically)'
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
