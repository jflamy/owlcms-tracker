/**
 * Ranking Box Scoreboard - Data Processing
 * 
 * Processes competition data for lower-third overlay display
 * Supports modality: snatch | cj | total
 */

import { competitionHub } from '$lib/server/competition-hub.js';
import { logger } from '@owlcms/tracker-core';
import { getFlagUrl } from '$lib/server/flag-resolver.js';

import { buildCacheKey } from '$lib/server/cache-utils.js';
// Cache for ranking-box
const rankingBoxCache = new Map();

/**
 * Extract attempt value with status styling
 * Priority: actualLift > change2 > change1 > declaration
 */
function formatAttempt(attempt) {
	if (!attempt) return { value: '', status: 'empty' };
	
	const { liftStatus, stringValue } = attempt;
	
	// Status mapping for CSS classes
	let status = 'empty';
	if (liftStatus === 'good') status = 'good'; // Green
	if (liftStatus === 'fail') status = 'fail'; // Red with value
	if (liftStatus === 'request') status = 'empty'; // White/empty
	
	return {
		value: stringValue || '',
		status: status
	};
}

export function getScoreboardData(fopName = 'A', options = {}) {
	const fopUpdate = competitionHub.getFopUpdate(fopName);
	
	// Extract options
	const pageInterval = parseInt(options.pageInterval || 5);
	const modality = options.modality || 'total'; // snatch | cj | total

	// Cache key: hub version + options affecting layout
	const cacheKey = buildCacheKey({ fopName, includeFop: true, opts: { modality, pageInterval } });
	if (rankingBoxCache.has(cacheKey)) {
		const cached = rankingBoxCache.get(cacheKey);
		return {
			...cached,
			learningMode: process.env.LEARNING_MODE === 'true' ? 'enabled' : 'disabled'
		};
	}
	
	// Parse session athletes from OWLCMS precomputed data
	let athletes = [];
	if (fopUpdate?.athletes) {
		try {
			const parsed = typeof fopUpdate.athletes === 'string' 
				? JSON.parse(fopUpdate.athletes)
				: fopUpdate.athletes;
			
			athletes = Array.isArray(parsed) ? parsed : [];
			logger.debug('[Ranking Box] Parsed athletes count:', athletes.length);
		} catch (e) {
			logger.error('[Ranking Box] Error parsing athletes:', e);
			athletes = [];
		}
	} else {
		logger.warn('[Ranking Box] No athletes found in fopUpdate');
	}
	
	// Filter athletes with valid data and sort by total (descending)
	athletes = athletes
		.filter(a => {
			const hasName = a.fullName && a.fullName.trim().length > 0;
			const hasTotal = a.total !== null && a.total !== undefined && a.total !== '';
			return hasName && hasTotal;
		})
		.map(a => {
			// Extract country code from teamName (e.g., "USA", "COL", "KSA")
			let countryCode = null;
			
			if (a.teamName) {
				const parts = a.teamName.trim().split(/[\s\-()]/);
				if (parts.length > 0 && parts[0].length <= 3) {
					countryCode = parts[0];
				} else {
					countryCode = a.teamName.substring(0, 3);
				}
			}
			
			// Build modality-specific data
			let scores = [];
			
			if (modality === 'snatch') {
				// 3 snatch attempts + best snatch
				scores = [
					formatAttempt(a.sattempts?.[0]),
					formatAttempt(a.sattempts?.[1]),
					formatAttempt(a.sattempts?.[2]),
					{
						value: a.bestSnatch || '-',
						status: 'best'  // Always transparent with white text
					}
				];
			} else if (modality === 'cj') {
				// 3 clean & jerk attempts + best C&J
				scores = [
					formatAttempt(a.cattempts?.[0]),
					formatAttempt(a.cattempts?.[1]),
					formatAttempt(a.cattempts?.[2]),
					{
						value: a.bestCleanJerk || '-',
						status: 'best'  // Always transparent with white text
					}
				];
			} else {
				// modality === 'total'
				// Best snatch, best C&J, total (3 columns)
				// All shown as transparent with white text
				scores = [
					{
						value: a.bestSnatch || '-',
						status: 'best'
					},
					{
						value: a.bestCleanJerk || '-',
						status: 'best'
					},
					{
						value: a.total || '-',
						status: 'best'
					}
				];
			}
			
			return {
				...a,
				countryCode: countryCode,
				flagUrl: countryCode ? getFlagUrl(countryCode, true) : null,
				scores: scores
			};
		})
		.sort((a, b) => {
			// Sort by category first, then by total within each category
			const catA = (a.categoryName || a.category || '').toString();
			const catB = (b.categoryName || b.category || '').toString();
			
			// Compare categories lexicographically
			if (catA !== catB) {
				return catA.localeCompare(catB);
			}
			
			// Within same category, sort by total descending
			const totalA = typeof a.total === 'string' ? parseFloat(a.total) : (a.total || 0);
			const totalB = typeof b.total === 'string' ? parseFloat(b.total) : (b.total || 0);
			return totalB - totalA;
		});
	
	logger.debug(`[Ranking Box] Filtered & sorted athletes count: ${athletes.length} (modality: ${modality})`);
	
	return {
		competition: {
			name: fopUpdate?.competitionName || 'Competition',
			fop: fopName
		},
		session: {
			name: fopUpdate?.sessionName || 'Session',
			fopState: fopUpdate?.fopState || 'UNKNOWN'
		},
		athletes,
		modality,
		pageInterval,
		status: athletes.length > 0 ? 'ready' : 'waiting'
	};

    // Cache a simplified stable payload (exclude any volatile fields)
    const toCache = {
        competition: { name: fopUpdate?.competitionName || 'Competition', fop: fopName },
        session: { name: fopUpdate?.sessionName || 'Session', fopState: fopUpdate?.fopState || 'UNKNOWN' },
        athletes,
        modality,
        pageInterval,
        status: athletes.length > 0 ? 'ready' : 'waiting'
    };
    rankingBoxCache.set(cacheKey, toCache);
    if (rankingBoxCache.size > 3) {
        const firstKey = rankingBoxCache.keys().next().value;
        const expiredEntry = rankingBoxCache.get(firstKey);
        if (expiredEntry) {
            if (expiredEntry.athletes) expiredEntry.athletes = null;
        }
        rankingBoxCache.delete(firstKey);
    }
}
