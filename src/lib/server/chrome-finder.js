/**
 * Chrome Finder Utility
 * 
 * Locates Chrome/Chromium executable on different platforms
 */

import { existsSync } from 'fs';
import { platform } from 'os';

/**
 * Find Chrome executable path based on platform
 * @returns {Promise<string|null>} Path to Chrome executable or null if not found
 */
export async function findChrome() {
	const plat = platform();
	
	// Common Chrome/Chromium paths by platform
	const paths = {
		win32: [
			process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
			process.env.PROGRAMFILES + '\\Google\\Chrome\\Application\\chrome.exe',
			process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe',
			process.env.LOCALAPPDATA + '\\Chromium\\Application\\chrome.exe'
		],
		darwin: [
			'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
			'/Applications/Chromium.app/Contents/MacOS/Chromium'
		],
		linux: [
			'/usr/bin/google-chrome',
			'/usr/bin/google-chrome-stable',
			'/usr/bin/chromium',
			'/usr/bin/chromium-browser',
			'/snap/bin/chromium'
		]
	};
	
	const platformPaths = paths[plat] || paths.linux;
	
	// Check each path
	for (const path of platformPaths) {
		if (path && existsSync(path)) {
			console.log(`[Chrome Finder] Found Chrome at: ${path}`);
			return path;
		}
	}
	
	console.warn('[Chrome Finder] Chrome not found in common locations');
	return null;
}
