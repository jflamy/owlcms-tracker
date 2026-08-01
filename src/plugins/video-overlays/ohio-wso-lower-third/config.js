export default {
	name: 'Ohio WSO Lower Third - Minimal Status',
	description: 'Minimal overlay showing current athlete, weight, timer, and decision lights. Transparent background for video overlay.',

	// Category for grouping in the UI
	category: 'video-overlay',

	// on the home page, sort order within the category
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
		},
		{
			key: 'platformTheme',
			label: 'Platform Theme',
			type: 'select',
			options: ['auto', 'scarlet', 'gray'],
			default: 'auto',
			description: 'Overlay color theme; auto uses FOP name (Scarlet/Gray)'
		},
		{
			key: 'ohioLogoUrl',
			label: 'Ohio WSO Logo URL',
			type: 'text',
			default: '/local/flags/OhioWSO.png',
			description: 'Left-side event logo image URL'
		},
		{
			key: 'clubLogoSource',
			label: 'Club Logo Source',
			type: 'select',
			options: ['none', 'flag'],
			default: 'none',
			description: 'Use none or reuse team flag as club logo fallback'
		},
		{
			key: 'clubLogoBasePath',
			label: 'Club Logo Base Path',
			type: 'text',
			default: '/local/flags',
			description: 'Optional base path for club logos using slugged team names'
		},
		{
			key: 'clubLogoExt',
			label: 'Club Logo Extension',
			type: 'text',
			default: 'jpg',
			description: 'File extension used with clubLogoBasePath lookups'
		}
	]
};
