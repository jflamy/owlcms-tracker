/**
 * Cache Utils Shim
 *
 * - Maintains backward compatibility with existing imports.
 * - Re-exports tracker-core's buildCacheKey (epoch no longer needed in key).
 * - Provides registerCache for automatic cleanup on refresh.
 *
 * Why: owlcms-tracker plugins cache processed results in-memory. A manual refresh
 * clears all registered caches directly, so epoch in the key is not needed.
 */

import { buildCacheKey } from '@owlcms/tracker-core/utils';
import { registerCache } from './cache-epoch.js';

export { buildCacheKey, registerCache };

