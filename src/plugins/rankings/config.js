/**
 * Rankings Scoreboard Configuration
 * Shows athletes sorted by total (highest first) for the current session
 */

export default {
	name: 'Rankings',
	description: 'Current session rankings sorted by total',
	
	// Category for grouping in the UI
	category: 'standard',
	
	// Sort order within category
	order: 300,

	// Whether this scoreboard requires athlete pictures
	requiresPictures: false,
	
	options: [
		{
			key: 'showLeaders',
			label: 'Show Leaders Section',
			type: 'boolean',
			default: true,
			description: 'Display the leaders section on the grid'
		},
	],
	requiredFields: ['fullName', 'total', 'totalRank']
};
