/**
 * Rankings Scoreboard Configuration
 * Shows athletes sorted by total (highest first) for the current session
 */

export default {
	name: 'Rankings',
	description: 'Current session rankings sorted by total',
	
	// Whether this scoreboard requires athlete pictures
	requiresPictures: false,
	
	options: [
		{
			key: 'showRecords',
			label: 'Show Records',
			type: 'boolean',
			default: false,
			description: 'Display competition records'
		}
	],
	requiredFields: ['fullName', 'total', 'totalRank']
};
