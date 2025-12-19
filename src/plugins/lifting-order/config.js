/**
 * Scoreboard Configuration
 * 
 * Metadata for the "Lifting Order" scoreboard
 */

export default {
	// Display name
	name: 'Lifting Order',
	
	// Description for AI assistants 
	description: 'Shows athletes in the expected lifting order',
	
	// Category for grouping in the UI
	category: 'standard',
	
	// Sort order within category
	order: 200,

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
		'attempt',
		'weight',
		'liftingOrderAthletes'
	],
	
	// AI prompt for modifications
	aiPrompt: `
This scoreboard displays the current lifter and upcoming lifting order.

Data Structure:
- currentAttempt: { fullName, startNumber, teamName, categoryName, attempt, weight, startTime, timeAllowed }
- liftingOrder: Array of athletes with same fields
- status: 'ready' | 'waiting'

To modify this scoreboard:
1. Update helpers.data.js to change how data is extracted/processed
2. Update page.svelte to change the display
3. Update this config to add new options
	`
};
