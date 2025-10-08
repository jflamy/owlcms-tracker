/**
 * Scoreboard Configuration
 * 
 * Metadata for the "Lifting Order" scoreboard
 */

export default {
	// Display name
	name: 'Lifting Order',
	
	// Description for AI assistants
	description: 'Shows current lifter and upcoming lifting order with timer',
	
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
			key: 'maxLifters',
			label: 'Max Lifters',
			type: 'number',
			default: 8,
			min: 3,
			max: 15,
			description: 'Number of upcoming lifters to display'
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
