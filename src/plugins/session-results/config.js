/**
 * Scoreboard Configuration
 * 
 * Metadata for the "Session Scoreboard" scoreboard
 */

export default {
	// Display name
	name: 'Session Scoreboard',
	
	// Description for AI assistants
	description: 'Shows all athletes in session sorted by standard order (category, lot number)',
	
	// Whether this scoreboard requires athlete pictures
	requiresPictures: false,
	
	// User-configurable options
	options: [
		{
			key: 'showLeaders',
			label: 'Show Leaders Section',
			type: 'boolean',
			default: true,
			description: 'Display the leaders section on the grid'
		},
		{
			key: 'showRecords',
			label: 'Show Records',
			type: 'boolean',
			default: true,
			description: 'Display competition records'
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
This scoreboard displays all athletes in the session sorted by standard order (category, lot number).

Data Structure:
- groupAthletes: Array of all athletes in the session with their attempts
- status: 'ready' | 'waiting'

To modify this scoreboard:
1. Update helpers.data.js to change how data is extracted/processed
2. Update page.svelte to change the display
3. Update this config to add new options
	`
};
