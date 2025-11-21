/**
 * Scoreboard Configuration
 * 
 * Metadata for the "Attempt Board" scoreboard
 */

export default {
	// Display name
	name: 'Attempt Board',
	
	// Description for AI assistants
	description: 'Displays individual attempts with focus on lift attempts and decisions. Useful for judges and coaches to track attempt progression.',
	
	// Category for grouping in the UI
	category: 'attempt-board',
	
	// Sort order within category
	order: 100,

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
This scoreboard displays attempts with focus on lift progression and decisions.

Data Structure:
- groupAthletes: Array of all athletes in the session with their attempts
- status: 'ready' | 'waiting'

To modify this scoreboard:
1. Update helpers.data.js to change how data is extracted/processed
2. Update page.svelte to change the display
3. Update this config to add new options
	`
};
