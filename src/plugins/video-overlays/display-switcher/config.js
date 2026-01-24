/**
 * Display Switcher Plugin Configuration
 * 
 * Controls a fullscreen display that switches between:
 * - OWLCMS Vaadin pages (via iframe through proxy)
 * - Video content (local or remote URLs)
 * 
 * Automation:
 * - DECISION events → Good/bad lift video → Replay → Scoreboard
 * - TIMER start → Switch to scoreboard immediately
 * - BREAK → Play video playlist
 * 
 * Manual override stops all automation until explicitly resumed.
 */

export default {
	// Display name
	name: 'Display Switcher',
	
	// Description for AI assistants and UI
	description: 'Controls a fullscreen display that switches between OWLCMS pages and video content based on competition events',
	
	// Category for grouping in the UI
	category: 'video-overlay',
	
	// Sort order within the category
	order: 200,
	
	// FOP is required - each display-switcher instance controls one FOP
	fopRequired: true,
	
	// User-configurable options
	options: [
		{
			key: 'mode',
			label: 'Mode',
			type: 'select',
			default: 'display',
			options: ['display', 'control'],
			description: 'Display mode shows fullscreen output. Control mode shows operator UI.'
		},
		{
			key: 'owlcmsUrl',
			label: 'OWLCMS Server URL',
			type: 'text',
			default: 'http://localhost:8080',
			description: 'Base URL of the OWLCMS server (used for proxy target)'
		},
		{
			key: 'scoreboardPage',
			label: 'Scoreboard Page',
			type: 'text',
			default: 'displays/publicScoreboard?currentAttempt=false',
			description: 'OWLCMS scoreboard page path (will be proxied). Use {FOP} for FOP parameter.'
		},
		{
			key: 'replayUrl',
			label: 'Replay Server URL',
			type: 'text',
			default: '',
			description: 'URL of the replay video server (optional)'
		},
		{
			key: 'goodLiftVideo',
			label: 'Good Lift Video',
			type: 'text',
			default: '',
			description: 'Video URL to play after a good lift'
		},
		{
			key: 'badLiftVideo',
			label: 'Bad Lift Video',
			type: 'text',
			default: '',
			description: 'Video URL to play after a bad lift'
		},
		{
			key: 'goodLiftDuration',
			label: 'Good Lift Video Duration (seconds)',
			type: 'number',
			default: 5,
			description: 'How long to show the good lift video before switching to replay'
		},
		{
			key: 'badLiftDuration',
			label: 'Bad Lift Video Duration (seconds)',
			type: 'number',
			default: 5,
			description: 'How long to show the bad lift video before switching to replay'
		},
		{
			key: 'replayDuration',
			label: 'Replay Duration (seconds)',
			type: 'number',
			default: 10,
			description: 'How long to show the replay before returning to scoreboard'
		}
	]
};
