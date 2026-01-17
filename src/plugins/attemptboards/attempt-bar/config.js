/**
 * Scoreboard Configuration
 * 
 * Metadata for the "Attempt Bar" scoreboard
 */

export default {
	// Display name
	name: 'Attempt Bar',
	
	// Description for AI assistants
	description: 'Displays just the current attempt bar with athlete info, timer, and decision lights. Useful for overlay graphics.',
	
	// Category for grouping in the UI
	category: 'video-overlay',
	
	// on the home page, sort order within the category
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
	]
};
