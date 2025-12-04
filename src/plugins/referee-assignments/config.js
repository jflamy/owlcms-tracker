/**
 * Scoreboard Configuration
 * 
 * Metadata for the "Referee Assignments" scoreboard
 */

export default {
	// Display name
	name: 'Referee Assignments',
	
	// Description for AI assistants
	description: 'Summary table for referee assignments.',
	
	// Category for grouping in the UI
	category: 'documents',
	
	// Sort order within category
	order: 100,

	// Whether this scoreboard requires athlete pictures
	requiresPictures: false,
	
	// User-configurable options
	options: [
		{
			key: 'language',
			label: 'Language',
			type: 'select',
			options: 'dynamic:locales',
			default: 'en',
			description: 'Choose scoreboard text language'
		}
	],
	
	// Required FOP data fields
	requiredFields: [
		'database'
	],
	
	// This scoreboard works with any FOP (doesn't need current athlete data)
	multiPlatform: true
};
