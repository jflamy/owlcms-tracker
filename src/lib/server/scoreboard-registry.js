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
 * 
 * Runtime discovery: Plugins added to src/plugins/ after build can be
 * discovered at runtime via filesystem scan (Node.js only).
 */

import { bumpCacheEpoch } from './cache-epoch.js';
import { competitionHub } from './competition-hub.js';
import { existsSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

// Eager imports so Vite includes all plugins at build time
// Note: import.meta.glob is a Vite COMPILE-TIME feature - it gets transformed
// into actual imports during build. It does NOT exist as a function at runtime.
// 
// Uses ** to support nested plugins (e.g., books/iwf-startbook, books/iwf-results)
const configModules = import.meta.glob('../../plugins/**/config.js', { eager: true });
const helperModules = import.meta.glob('../../plugins/**/helpers.data.js', { eager: true });

function findPackageRoot(startDir) {
	let current = startDir;
	for (let i = 0; i < 6; i += 1) {
		if (existsSync(join(current, 'package.json'))) {
			return current;
		}
		const parent = resolve(current, '..');
		if (parent === current) break;
		current = parent;
	}
	return startDir;
}

function toFileUrl(filePath) {
	if (!filePath) return null;
	const normalized = filePath.replace(/\\/g, '/');
	return `file:///${normalized}`;
}

async function importFromFileUrl(fileUrl) {
	const dynamicImport = new Function('u', 'return import(u)');
	return dynamicImport(fileUrl);
}

/**
 * Discover plugins at runtime that weren't included in the build
 * This enables adding plugins to a pre-built application
 * 
 * @returns {Promise<Map<string, {configPath: string, helpersPath: string}>>}
 */
async function discoverRuntimePlugins() {
	const runtimePlugins = new Map();
	
	// Only run in Node.js environment (not browser)
	if (typeof process === 'undefined' || !process.cwd) {
		return runtimePlugins;
	}
	
	try {
		const moduleDir = fileURLToPath(new URL('.', import.meta.url));
		const moduleRoot = findPackageRoot(moduleDir);

		// Recursively find plugin folders (folders containing config.js)
		const findPlugins = (dir, prefix = '') => {
			const entries = readdirSync(dir);
			
			for (const entry of entries) {
				// Skip hidden folders and node_modules
				if (entry.startsWith('.') || entry === 'node_modules') continue;
				
				const fullPath = join(dir, entry);
				const stat = statSync(fullPath);
				
				if (stat.isDirectory()) {
					const configPath = join(fullPath, 'config.js');
					const helpersPath = join(fullPath, 'helpers.data.js');
					
					if (existsSync(configPath)) {
						// Found a plugin
						const pluginPath = prefix ? `${prefix}/${entry}` : entry;
						const globKey = `../../plugins/${pluginPath}/config.js`;
						
						// Only add if not already in build-time modules
						if (!configModules[globKey]) {
							runtimePlugins.set(pluginPath, {
								configPath: configPath,
								helpersPath: existsSync(helpersPath) ? helpersPath : null
							});
							console.log(`[ScoreboardRegistry] Runtime discovery: found ${pluginPath}`);
						}
					}
					
					// Recurse into subdirectories
					findPlugins(fullPath, prefix ? `${prefix}/${entry}` : entry);
				}
			}
		};
		
		// Scan multiple plugin directories
		// In development: src/plugins (bundled plugins)
		// In production: plugins (user-added runtime plugins)
		// Use both process.cwd() and the module root to handle different launchers
		const pluginsDirs = [
			resolve(process.cwd(), 'src/plugins'),
			resolve(process.cwd(), 'plugins'),
			resolve(moduleRoot, 'src/plugins'),
			resolve(moduleRoot, 'plugins')
		];
		const uniquePluginDirs = Array.from(new Set(pluginsDirs));
		
		let foundAnyDir = false;
		for (const pluginsDir of uniquePluginDirs) {
			if (!existsSync(pluginsDir)) {
				continue;
			}
			foundAnyDir = true;
			console.log(`[ScoreboardRegistry] Runtime discovery: scanning ${pluginsDir}`);
			findPlugins(pluginsDir);
		}
		
		if (!foundAnyDir) {
			console.log('[ScoreboardRegistry] Runtime discovery: no plugin directories found, skipping');
		}
		
	} catch (err) {
		console.error('[ScoreboardRegistry] Runtime discovery error:', err.message);
	}
	
	return runtimePlugins;
}


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
		const discovered = new Map(); // pluginPath -> { folderName, runtime, paths }

		// Build-time plugins (from import.meta.glob)
		for (const configPath of Object.keys(configModules)) {
			// Extract plugin path relative to plugins/ directory
			// Examples:
			//   ../../plugins/lifting-order/config.js -> "lifting-order"
			//   ../../plugins/books/iwf-startbook/config.js -> "books/iwf-startbook"
			const match = configPath.match(/\.\.\/\.\.\/plugins\/(.+)\/config\.js$/);
			if (!match) continue;
			
			const pluginPath = match[1]; // e.g., "lifting-order" or "books/iwf-startbook"
			const folderName = pluginPath.split('/').pop(); // e.g., "iwf-startbook"
			discovered.set(pluginPath, { folderName, runtime: false });
		}

		// Runtime plugins (not in build)
		const runtimePlugins = await discoverRuntimePlugins();
		for (const [pluginPath, paths] of runtimePlugins) {
			const folderName = pluginPath.split('/').pop();
			discovered.set(pluginPath, { folderName, runtime: true, paths });
		}

		// Register all discovered plugins
		for (const [pluginPath, info] of discovered) {
			await this.registerScoreboard(pluginPath, info.folderName, info.runtime ? info.paths : null);
		}

		this.initialized = true;
		console.log(`[ScoreboardRegistry] Initialized with ${this.scoreboards.size} scoreboards`);
	}

	/**
	 * Register a single scoreboard plugin
	 * @param {string} pluginPath - Path relative to plugins/ (e.g., "books/iwf-startbook")
	 * @param {string} folderName - Folder name (e.g., "iwf-startbook")
	 * @param {Object|null} runtimePaths - Paths for runtime-discovered plugins
	 */
	async registerScoreboard(pluginPath, folderName = null, runtimePaths = null) {
		if (!folderName) {
			folderName = pluginPath;
		}
		
		try {
			let config, configModule, dataHelper;
			
			if (runtimePaths) {
				// Runtime-discovered plugin - use dynamic import
				// Use direct file URL strings (no percent-encoding) for accented paths on Windows
				try {
					const configUrl = toFileUrl(runtimePaths.configPath) || pathToFileURL(runtimePaths.configPath).href;
					configModule = await importFromFileUrl(configUrl);
					config = configModule.default || configModule;
					
					if (runtimePaths.helpersPath) {
						const helpersUrl = toFileUrl(runtimePaths.helpersPath) || pathToFileURL(runtimePaths.helpersPath).href;
						const helpersModule = await importFromFileUrl(helpersUrl);
						dataHelper = helpersModule.getScoreboardData || helpersModule.default;
					}
				} catch (importErr) {
					console.error(`[ScoreboardRegistry] Failed to import runtime plugin ${pluginPath}:`, importErr.message);
					return;
				}
			} else {
				// Build-time plugin - use pre-imported modules
				configModule = configModules[`../../plugins/${pluginPath}/config.js`];
				if (!configModule) {
					console.warn(`[ScoreboardRegistry] Skipping ${pluginPath}: no config.js`);
					return;
				}
				config = configModule.default || configModule;

				const helpersModule = helperModules[`../../plugins/${pluginPath}/helpers.data.js`];
				dataHelper = helpersModule
					? helpersModule.getScoreboardData || helpersModule.default
					: null;
			}

			// Handle delegateTo pattern: config-only plugins that extend a base plugin
			// If no dataHelper but config has delegateTo, load base plugin's createHelpers
			if (!dataHelper && config.delegateTo) {
				try {
					const basePluginPath = config.delegateTo;
					console.log(`[ScoreboardRegistry] ${folderName}: delegating to ${basePluginPath}`);
					
					// Get base plugin's helpers module
					let baseHelpersModule;
					const baseGlobKey = `../../plugins/${basePluginPath}/helpers.data.js`;
					
					if (helperModules[baseGlobKey]) {
						// Build-time: use pre-imported module
						baseHelpersModule = helperModules[baseGlobKey];
					} else {
						// Runtime: try dynamic import from src/plugins
						const baseHelpersPath = resolve(process.cwd(), `src/plugins/${basePluginPath}/helpers.data.js`);
						if (existsSync(baseHelpersPath)) {
							baseHelpersModule = await import(/* @vite-ignore */ 'file://' + baseHelpersPath);
						}
					}
					
					if (baseHelpersModule?.createHelpers) {
						// Check if config exports a custom calculateScore function
						const customCalculateScore = configModule.calculateScore || null;
						
						if (customCalculateScore) {
							console.log(`[ScoreboardRegistry] ${folderName}: using custom calculateScore from config`);
						}
						
						// Create helpers with custom scoring (or null for default)
						const derivedHelpers = baseHelpersModule.createHelpers(customCalculateScore);
						dataHelper = derivedHelpers.getScoreboardData;
					} else {
						console.warn(`[ScoreboardRegistry] ${folderName}: base plugin ${basePluginPath} has no createHelpers export`);
					}
				} catch (delegateErr) {
					console.error(`[ScoreboardRegistry] ${folderName}: delegation failed:`, delegateErr.message);
				}
			}

			const type = folderName;

			this.scoreboards.set(type, {
				type,
				folderName,
				pluginPath,
				config,
				dataHelper,
				path: `../../plugins/${pluginPath}`,
				runtime: !!runtimePaths
			});

			console.log(`[ScoreboardRegistry] Registered: ${type} (path: ${pluginPath}${runtimePaths ? ', runtime' : ''})`);
		} catch (err) {
			console.error(`[ScoreboardRegistry] Failed to register ${pluginPath}:`, err);
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
	 * 
	 * Resource preconditions (config.requires) are checked only on cache miss.
	 * If a valid cache entry exists, resources were already loaded when it was built.
	 */
	async processData(type, fopName, options = {}) {
		const scoreboard = this.getScoreboard(type);

		if (!scoreboard) {
			throw new Error(`Unknown scoreboard type: ${type}`);
		}

		if (!scoreboard.dataHelper) {
			throw new Error(`Scoreboard ${type} has no data helper`);
		}

		// Resource preconditions are checked inside helpers on cache miss.
		// Helpers call competitionHub methods which short-circuit if already loaded.
		// We move the check here to centralize it, but helpers still have caching.
		// 
		// Note: ensurePluginPreconditions is fast when resources are loaded (flag check only).
		// We could skip this on cache hit, but that requires helpers to return cache status.
		// Current design: check every time (fast path) for simplicity.
		const requires = scoreboard.config?.requires || [];
		if (requires.length > 0) {
			const ready = await competitionHub.ensurePluginPreconditions(requires);
			if (!ready) {
				return { status: 'waiting', message: 'Waiting for resources...' };
			}
		}

		// Call the scoreboard's data processing function
		return scoreboard.dataHelper(fopName, options);
	}

	/**
	 * Flush all plugin caches
	 * Called when OWLCMS establishes a new connection to clear stale cached data
	 */
	flushCaches() {
		// Force invalidation of any cache keys that include the global cache epoch.
		// Many plugin helpers build cache keys using $lib/server/cache-utils.js; we append
		// this epoch there. Document plugins that build custom keys should include it too.
		//
		// Note: we do not attempt to directly clear plugin-private Map instances.
		// This avoids tight coupling and keeps plugins in control of their own caches.
		//
		const newEpoch = bumpCacheEpoch();
		console.log(`[ScoreboardRegistry] Cache epoch bumped to ${newEpoch} (was ${newEpoch - 1})`);
		return newEpoch;
	}
}

// Singleton instance
export const scoreboardRegistry = new ScoreboardRegistry();

