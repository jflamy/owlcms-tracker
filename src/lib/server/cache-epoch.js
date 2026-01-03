// Global cache epoch used to force invalidation of scoreboard/plugin caches.
//
// Plugins typically cache processed data keyed by (fop + options + hub state version).
// A manual refresh should force recomputation even if the hub state version has not changed.
//
// Caches register themselves here so they can be cleared when the epoch bumps,
// preventing orphaned entries from accumulating in memory.

let cacheEpoch = 0;

/** @type {Set<Map<any, any>>} */
const registeredCaches = new Set();

export function getCacheEpoch() {
	return cacheEpoch;
}

/**
 * Register a cache Map to be cleared when epoch bumps.
 * Call this once per cache at module load time.
 * @param {Map<any, any>} cacheMap
 */
export function registerCache(cacheMap) {
	registeredCaches.add(cacheMap);
}

/**
 * Bump the epoch and clear all registered caches.
 * Returns the new epoch value.
 */
export function bumpCacheEpoch() {
	cacheEpoch += 1;
	let totalCleared = 0;
	for (const cache of registeredCaches) {
		totalCleared += cache.size;
		cache.clear();
	}
	if (totalCleared > 0) {
		console.log(`[CacheEpoch] Cleared ${totalCleared} entries from ${registeredCaches.size} caches`);
	}
	return cacheEpoch;
}
