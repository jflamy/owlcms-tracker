/**
 * Shared config store for display-control.
 *
 * Keeps per-FOP config available for the OWLCMS proxy without relying on $lib aliases.
 * 
 * IMPORTANT: Uses globalThis to ensure the same Map is shared between Vite plugin context
 * (owlcms-proxy.js loaded by configureServer) and SvelteKit server context (helpers.data.js).
 */

import pluginConfig from '../../plugins/video-overlays/display-control/config.js';

// Use globalThis to ensure same instance across Vite plugin and SvelteKit contexts
const GLOBAL_KEY = '__owlcms_display_control_configs__';
if (!globalThis[GLOBAL_KEY]) {
	globalThis[GLOBAL_KEY] = new Map();
}
const fopConfigs = globalThis[GLOBAL_KEY];

function buildDefaultConfig() {
	const defaults = {};
	for (const option of pluginConfig.options) {
		defaults[option.key] = option.default;
	}
	return defaults;
}

const DEFAULT_CONFIG = buildDefaultConfig();

export function setDisplayControlConfig(fopName, config) {
	if (!fopName) return;
	if (!config || typeof config !== 'object') return;
	fopConfigs.set(fopName, { ...config });
}

export function getDisplayControlConfig(fopName) {
	if (!fopName) return DEFAULT_CONFIG;
	return fopConfigs.get(fopName) || DEFAULT_CONFIG;
}

export function getDefaultConfig() {
	return { ...DEFAULT_CONFIG };
}