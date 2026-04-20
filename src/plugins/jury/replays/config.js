export default {
	name: 'Replays',
	description: 'Load the latest replay from a replays server and review it in a full-screen player.',
	category: 'jury',
	order: 260,
	customSSE: true,
	fopRequired: false,
	standalone: true,
	options: [
		{
			key: 'replaysBaseUrl',
			label: 'Replays Server URL',
			type: 'text',
			default: 'http://localhost:8091',
			description: 'Base URL of the replays web app. Camera buttons 1 to 4 load the corresponding /replay/{camera} endpoint.'
		}
	]
};