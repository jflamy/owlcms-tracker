/**
 * Scoreboard Configuration
 * 
 * Metadata for the "Ranking Box" lower-third scoreboard
 */

export default {
	// Display name
	name: 'Ranking Box',
	
	// Description for AI assistants
	description: 'Lower-third overlay with animated ranking display in SVG box',
	
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
	],
	
	// Required FOP data fields
	requiredFields: [
		'groupName',
		'fullName',
		'startNumber',
		'teamName',
		'categoryName',
		'total'
	],
	
	// AI prompt for modifications
	aiPrompt: `
This scoreboard displays a lower-third overlay with an animated SVG ranking box in the lower left.

The SVG contains:
- Rounded rectangle background
- Centered text showing the current lifting session name
- Animated page transitions for athlete rankings

Data Structure:
- competitionName: Name of competition
- groupName: Current session/group name
- athletes: Array of current session athletes
- pageInterval: Seconds between page transitions

To modify this scoreboard:
1. Update helpers.data.js to change how data is extracted/processed
2. Update page.svelte to change the SVG display and animations
3. Update this config to add new options or change page interval
	`
};
