/**
 * Scoreboard Configuration
 * 
 * Metadata for the "Ranking Box" lower-third scoreboard
 */

export default {
	// Display name
	name: 'Ranking Box',
	
	// Description for AI assistants
	description: 'Lower-third overlay with animated ranking display in SVG box (Experimental)',
	
	// Category for grouping in the UI
	category: 'video-overlay',
	
	// on the home page, sort order within the category
	order: 300,

	// Lower-third scoreboard marker
	isLowerThird: true,
	
	// Whether this scoreboard requires athlete pictures
	requiresPictures: false,
	
	// User-configurable options
	options: [
		{
			key: 'pageInterval',
			label: 'Page Interval (seconds)',
			type: 'number',
			default: 5,
			min: 2,
			max: 30,
			description: 'Time between page transitions in seconds'
		},
		{
			key: 'modality',
			label: 'Display Mode',
			type: 'select',
			options: ['snatch', 'cj', 'total'],
			default: 'total',
			description: 'snatch: 3 snatch attempts + best snatch | cj: 3 C&J attempts + best C&J | total: best snatch, best C&J, total'
		}
	]
};
