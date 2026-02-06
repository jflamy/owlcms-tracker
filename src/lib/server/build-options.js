/**
 * Shared option-building logic for all endpoints.
 *
 * Applies config defaults (base then extension), then overrides with URL params.
 * Every endpoint that hands options to a plugin MUST use this function so that
 * the behavior is identical everywhere.
 *
 * @param {Object} params
 * @param {Object} params.scoreboard  - The registered scoreboard entry
 * @param {URL}    params.url         - The request URL (searchParams are read)
 * @param {Set}    [params.reservedKeys] - URL param keys to skip (e.g. 'type','fop','plugin','action')
 * @param {import('$lib/server/scoreboard-registry.js').ScoreboardRegistry} [params.registry]
 *        - registry instance, needed to look up base scoreboard for delegating extensions
 * @returns {Object} Fully-resolved options object
 */
export function buildOptions({ scoreboard, url, reservedKeys = new Set(), registry = null }) {
	const options = {};

	// 1. Apply defaults from BASE plugin config (if this is a delegating extension)
	if (registry) {
		const baseScoreboard = registry.getBaseScoreboard(scoreboard?.type);
		if (baseScoreboard?.config?.options && Array.isArray(baseScoreboard.config.options)) {
			for (const opt of baseScoreboard.config.options) {
				if (opt.key && opt.default !== undefined) {
					options[opt.key] = opt.default;
				}
			}
		}
	}

	// 2. Apply defaults from current scoreboard config (overrides base if extension redefines)
	if (scoreboard?.config?.options && Array.isArray(scoreboard.config.options)) {
		for (const opt of scoreboard.config.options) {
			if (opt.key && opt.default !== undefined) {
				options[opt.key] = opt.default;
			}
		}
	}

	// 3. Override with URL parameters (skip reserved keys)
	for (const [key, value] of url.searchParams.entries()) {
		if (reservedKeys.has(key)) continue;

		// Parse boolean / number values
		if (value === 'true') options[key] = true;
		else if (value === 'false') options[key] = false;
		else if (!isNaN(value) && value !== '') options[key] = parseFloat(value);
		else options[key] = value;
	}

	return options;
}
