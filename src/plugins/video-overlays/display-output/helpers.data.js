/**
 * Display Output - Minimal Server-side Helper
 * 
 * This plugin is purely reactive - it just displays what SSE tells it.
 * All state machine logic is in display-control.
 */

import pluginConfig from './config.js';

/**
 * Normalize a configured scoreboard path to a clean /path?query form
 */
function normalizeScoreboardPath(rawPath) {
	let path = rawPath || '';

	// Convert full URL to path if needed
	if (/^https?:\/\//i.test(path)) {
		try {
			const url = new URL(path);
			path = `${url.pathname}${url.search}${url.hash}`;
		} catch (err) {
			// If URL parsing fails, keep original
		}
	}

	// Strip any leading /proxy to avoid double prefix
	if (path.startsWith('/proxy')) {
		path = path.replace(/^\/proxy\/?/, '/');
	}

	// Ensure leading slash
	if (!path.startsWith('/')) {
		path = `/${path}`;
	}

	return path;
}

/**
 * Get scoreboard data for the page (required by plugin pattern)
 * Returns initial URL so display has something to show before control connects
 */
export function getScoreboardData(fopName = 'A', options = {}) {
	// Get default scoreboard page
	const defaultOption = pluginConfig.options.find(o => o.key === 'scoreboardPage');
	const scoreboardPage = options.scoreboardPage || defaultOption?.default || 'displays/publicScoreboard';
	
	// Build initial scoreboard URL
	let scoreboardPath = normalizeScoreboardPath(scoreboardPage);
	const separator = scoreboardPath.includes('?') ? '&' : '?';
	const initialUrl = `/proxy${scoreboardPath}${separator}fop=${encodeURIComponent(fopName)}`;
	
	return {
		fopName,
		initialUrl,
		currentType: 'iframe'
	};
}
