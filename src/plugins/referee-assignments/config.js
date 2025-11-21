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
	
	// Whether this scoreboard requires athlete pictures
	requiresPictures: false,
	
	// User-configurable options
	options: [
		{
			key: 'language',
			label: 'Language',
			type: 'select',
			options: ['en', 'no'],
			default: 'en',
			description: 'Choose scoreboard text language (English or Norwegian)'
		}
	],
	
	// Required FOP data fields
	requiredFields: [
		'database'
	],
	
	// This scoreboard works with any FOP (doesn't need current athlete data)
	multiPlatform: true
};
