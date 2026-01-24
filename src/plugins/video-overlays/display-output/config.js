/**
 * Display Output Plugin Configuration
 * 
 * Pure display page that shows content based on SSE commands.
 * Switches between iframe (OWLCMS pages) and video content.
 * 
 * This plugin receives display_command SSE events from display-control.
 */

export default {
	// Display name
	name: 'Display Output',
	
	// Description for AI assistants and UI
	description: 'Fullscreen display that shows OWLCMS pages or videos based on commands from display-control',
	
	// Category for grouping in the UI
	category: 'video-overlay',
	
	// This plugin manages its own SSE connection (mode=display)
	customSSE: true,
	
	// Sort order within the category
	order: 201,
	
	// FOP is required - each display instance is for one FOP
	fopRequired: true,
	
	// Minimal options - display just shows what it's told
	options: [
		{
			key: 'scoreboardPage',
			label: 'Default Scoreboard Page',
			type: 'text',
			default: 'displays/publicScoreboard?currentAttempt=false',
			description: 'OWLCMS scoreboard page to show initially (before control connects)'
		}
	]
};
