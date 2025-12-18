export default {
	name: 'Lower Third - Minimal Status',
	description: 'Minimal overlay showing current athlete, weight, timer, and decision lights. Transparent background for video overlay.',
	
	// Category for grouping in the UI
	category: 'video-overlay',
	
	// Sort order within category
	order: 100,

	// Lower-third scoreboard marker
	isLowerThird: true,
	
	// Whether this scoreboard requires athlete pictures
	requiresPictures: false,
	
	options: [
		{
			key: 'position',
			label: 'Position',
			type: 'select',
			options: ['bottom-right', 'bottom-left', 'top-right', 'top-left'],
			default: 'bottom-right',
			description: 'Screen position for the overlay'
		},
		{
			key: 'fontSize',
			label: 'Font Size',
			type: 'select',
			options: ['small', 'medium', 'large'],
			default: 'medium',
			description: 'Text size for athlete name and weight'
		}
	],
	requiredFields: ['fullName', 'weight', 'timer', 'decision']
};
