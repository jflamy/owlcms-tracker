import { competitionHub } from '$lib/server/competition-hub.js';

/**
 * Return a numeric or string version id for the hub/fop used in cache keys.
 * If a plugin is tied to a specific FOP, pass the fopName and includeFop=true
 * (default) when building cache keys. If a plugin is not tied to any FOP
 * (document-style plugins), pass includeFop=false to avoid per-FOP keys.
 * 
 * IMPORTANT: Uses lastDataUpdate timestamp to detect data changes.
 * Timer/decision events do NOT update lastDataUpdate, only actual data updates do.
 * This ensures timer events don't invalidate cached scoreboard data.
 */
export function getHubFopVersion(fopName) {
    try {
        if (fopName) {
            const fop = competitionHub.getFopUpdate(fopName);
            if (fop) {
                // Use lastDataUpdate (not lastUpdate) - this only changes on actual data updates,
                // not on timer/decision events. This is the correct cache invalidation key.
                if (fop.lastDataUpdate) {
                    return fop.lastDataUpdate;
                }
                // Fallback to lastUpdate if lastDataUpdate not set
                if (fop.lastUpdate) {
                    return fop.lastUpdate;
                }
                // Legacy fields (from older hub implementations)
                if (fop.fopVersion || fop.fopStateVersion || fop.version) {
                    return fop.fopVersion || fop.fopStateVersion || fop.version;
                }
            }
        }
    } catch (e) {
        // swallow errors and fall back
    }

    try {
        const db = competitionHub.getDatabaseState();
        if (db && db.hubVersion) return db.hubVersion;
        if (db && db.lastUpdate) return db.lastUpdate;
    } catch (e) {
        // swallow
    }

    // final fallback
    return 0;
}

/**
 * Build a cache key. If includeFop is false, the fopName will be omitted
 * and the key will be global to the hub. Options are JSON-stringified in
 * a consistent manner.
 */
export function buildCacheKey({ fopName, includeFop = true, opts = {} } = {}) {
    const version = getHubFopVersion(includeFop ? fopName : null);
    const optionsPart = Object.keys(opts).length ? JSON.stringify(opts) : '';
    if (includeFop) {
        return `${fopName}-v${version}-${optionsPart}`;
    }
    return `global-v${version}-${optionsPart}`;
}
