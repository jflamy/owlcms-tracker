/**
 * Scoreboard Plugin Registry
 * 
 * Discovers and manages all scoreboard types.
 * Each scoreboard plugin has:
 * - config.js: metadata (name, description, options)
 * - helpers.data.js: server-side data processing function
 * - page.svelte: display component
 */

import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class ScoreboardRegistry {
	constructor() {
		this.scoreboards = new Map();
		this.initialized = false;
	}

	/**
	 * Auto-discover scoreboard plugins in src/plugins/
	 * Looks for folders in plugins/ directory (excluding system folders starting with .)
	 */
	async initialize() {
		if (this.initialized) return;

		const pluginsDir = join(__dirname, '../../plugins');

		if (!existsSync(pluginsDir)) {
			console.warn('[ScoreboardRegistry] Plugins directory not found:', pluginsDir);
			return;
		}

		const entries = readdirSync(pluginsDir, { withFileTypes: true });

		for (const entry of entries) {
			// Skip system folders and files
			if (entry.isDirectory() && !entry.name.startsWith('.')) {
				await this.registerScoreboard(entry.name);
			}
		}

		this.initialized = true;
		console.log('[ScoreboardRegistry] Registered scoreboards:', Array.from(this.scoreboards.keys()));
	}

	/**
	 * Register a single scoreboard plugin
	 */
	async registerScoreboard(folderName) {
		try {
			const pluginPath = join(__dirname, '../../plugins', folderName);
			const configPath = join(pluginPath, 'config.js');
			const helpersPath = join(pluginPath, 'helpers.data.js');

			// Check if config exists
			if (!existsSync(configPath)) {
				console.warn(`[ScoreboardRegistry] Skipping ${folderName}: no config.js`);
				return;
			}

			// Import config
			const configModule = await import(`../../plugins/${folderName}/config.js`);
			const config = configModule.default || configModule;

			// Import data helper (optional)
			let dataHelper = null;
			if (existsSync(helpersPath)) {
				const helpersModule = await import(`../../plugins/${folderName}/helpers.data.js`);
				dataHelper = helpersModule.getScoreboardData || helpersModule.default;
			}

			// Extract scoreboard type from folder name
			// Folder name IS the type (e.g., "lifting-order")
			const type = folderName;

			this.scoreboards.set(type, {
				type,
				folderName,
				config,
				dataHelper,
				path: pluginPath
			});

		} catch (err) {
			console.error(`[ScoreboardRegistry] Failed to register ${folderName}:`, err);
		}
	}

	/**
	 * Get scoreboard by type
	 */
	getScoreboard(type) {
		return this.scoreboards.get(type);
	}

	/**
	 * Get all registered scoreboards
	 */
	getAllScoreboards() {
		return Array.from(this.scoreboards.values());
	}

	/**
	 * Check if any registered scoreboard requires pictures
	 */
	anyScoreboardRequiresPictures() {
		for (const scoreboard of this.scoreboards.values()) {
			if (scoreboard.config && scoreboard.config.requiresPictures === true) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Process data for a specific scoreboard type
	 */
	async processData(type, fopName, options = {}) {
		const scoreboard = this.getScoreboard(type);

		if (!scoreboard) {
			throw new Error(`Unknown scoreboard type: ${type}`);
		}

		if (!scoreboard.dataHelper) {
			throw new Error(`Scoreboard ${type} has no data helper`);
		}

		// Call the scoreboard's data processing function
		return scoreboard.dataHelper(fopName, options);
	}
}

// Singleton instance
export const scoreboardRegistry = new ScoreboardRegistry();
