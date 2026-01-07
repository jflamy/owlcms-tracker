/**
 * Param matcher for scoreboard routes.
 * Only matches if the param does NOT contain a file extension (dot).
 * This prevents static file requests like /paged.polyfill.js from being caught.
 */
export function match(param) {
	// Reject anything with a dot (file extension)
	return !param.includes('.');
}
