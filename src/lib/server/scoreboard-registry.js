/**
 * Scoreboard Plugin Registry
 *
 * Discovers and manages all scoreboard types.
 * Each scoreboard plugin has:
 * - config.js: metadata (name, description, options)
 * - helpers.data.js: server-side data processing function
 * - page.svelte: display component
 *
 * Static discovery (build-time): Vite import.meta.glob eagerly imports all
 * plugins under src/plugins/* so production builds include them without
 * runtime filesystem access.
 */

// Eager imports so Vite includes all plugins at build time
const configModules = import.meta.glob('../../plugins/*/config.js', { eager: true });
const helperModules = import.meta.glob('../../plugins/*/helpers.data.js', { eager: true });

class ScoreboardRegistry {
	constructor() {
		this.scoreboards = new Map();
		this.initialized = false;
		this.initializingPromise = null;  // Track ongoing initialization to prevent race conditions
	}

	/**
	 * Auto-discover scoreboard plugins in src/plugins/
	 * Looks for folders in plugins/ directory (excluding system folders starting with .)
	 * 
	 * Uses initialization lock to prevent race condition when multiple concurrent requests
	 * all see initialized=false and try to initialize simultaneously
	 */
	async initialize() {
		// If already initialized, return immediately
		if (this.initialized) return;
		
		// If initialization is in progress, wait for it
		if (this.initializingPromise) {
			console.log('[ScoreboardRegistry] Initialization in progress, waiting...');
			await this.initializingPromise;
			return;
		}

		// Start initialization and create promise to block other requests
		this.initializingPromise = this._doInitialize();
		await this.initializingPromise;
		this.initializingPromise = null;  // Clear after completion
	}

	async _doInitialize() {
		const discovered = new Set();

		for (const configPath of Object.keys(configModules)) {
			const parts = configPath.split('/');
			if (parts.length < 3) continue;
			const folderName = parts[parts.length - 2]; // plugins/<folder>/config.js
			discovered.add(folderName);
		}

		for (const folderName of discovered) {
			await this.registerScoreboard(folderName);
		}

		this.initialized = true;
	}

	/**
	 * Register a single scoreboard plugin
	 */
	async registerScoreboard(folderName) {
		try {
			const configModule = configModules[`../../plugins/${folderName}/config.js`];
			if (!configModule) {
				console.warn(`[ScoreboardRegistry] Skipping ${folderName}: no config.js`);
				return;
			}
			const config = configModule.default || configModule;

			const helpersModule = helperModules[`../../plugins/${folderName}/helpers.data.js`];
			const dataHelper = helpersModule
				? helpersModule.getScoreboardData || helpersModule.default
				: null;

			// Extract scoreboard type from folder name
			// Folder name IS the type (e.g., "lifting-order")
			const type = folderName;

			this.scoreboards.set(type, {
				type,
				folderName,
				config,
				dataHelper,
				path: `../../plugins/${folderName}`
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
