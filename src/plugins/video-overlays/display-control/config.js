/**
 * Display Control Plugin Configuration
 * 
 * Operator UI for controlling the display-output plugin.
 * Contains the state machine that listens to tracker-core events
 * and emits display_command SSE events.
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
	name: 'Display Control',
	
	// Description for AI assistants and UI
	description: 'Operator control panel for display-output. Manages automation and manual overrides.',
	
	// Category for grouping in the UI
	category: 'video-overlay',
	
	// This plugin manages its own SSE connection (mode=control)
	customSSE: true,
	
	// Sort order within the category
	order: 202,
	
	// FOP is required - each control instance manages one FOP
	fopRequired: true,
	
	// User-configurable options
	options: [
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
