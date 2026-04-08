export default {
	name: 'Team Rankings',
	description: 'Paged team championship rankings that follow OWLCMS team-result rules. REQUIRES OWLCMS 66+',
	category: 'team',
	order: 110,
	fopRequired: false,
	requiresPictures: false,
	options: [
		{
			key: 'language',
			label: 'Language',
			type: 'select',
			options: 'dynamic:locales',
			default: 'en',
			group: 'display',
			description: 'Choose scoreboard text language'
		},
		{
			key: 'championships',
			label: 'Championship Filter',
			type: 'text',
			default: '',
			group: 'display',
			description: 'Optional comma-separated championship names. Blank shows all active championships.'
		},
		{
			key: 'pageSize',
			label: 'Rows Per Page',
			type: 'number',
			default: 10,
			min: 5,
			max: 25,
			group: 'display',
			description: 'Maximum number of team rows shown on each page.'
		},
		{
			key: 'pagePauseMs',
			label: 'Page Pause (ms)',
			type: 'number',
			default: 5000,
			min: 1000,
			max: 15000,
			group: 'display',
			description: 'Pause after the row sweep before advancing to the next page.'
		},
		{
			key: 'sweepDurationMs',
			label: 'Sweep Duration (ms)',
			type: 'number',
			default: 1200,
			min: 200,
			max: 5000,
			group: 'display',
			description: 'Duration of the top-to-bottom row entrance animation.'
		}
	]
};