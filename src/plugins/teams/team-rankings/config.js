export default {
	name: 'Team Rankings',
	description: 'Paged team championship rankings that follow OWLCMS team-result rules. REQUIRES OWLCMS 66+',
	category: 'team',
	order: 110,
	fopRequired: false,
	requiresPictures: false,
	// Only plugin that computes GAMX locally (team aggregation), so it pulls the GAMX param tables.
	requires: ['gamx_zip'],
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
		},
		{
			key: 'smhfOverrideSinclairYear',
			label: 'Override Sinclair Year for SMHF Calculations',
			type: 'select',
			options: ['2020', '2024', '2028'],
			default: '2020',
			group: 'smhf',
			groupLabel: 'SMHF',
			description: 'Override the base Sinclair coefficient year used for SMHF calculations. Default 2020 matches OWLCMS.'
		},
		{
			key: 'smhfAgeFactorYear',
			label: 'Age Factor Year for SMHF Calculations',
			type: 'select',
			options: ['2020', '2025'],
			default: '2020',
			group: 'smhf',
			groupLabel: 'SMHF',
			description: 'Select the masters age-factor table used for SMHF calculations. 2020 is the Standard SMHF table. 2025 uses the alternate published masters age factors.'
		}
	]
};