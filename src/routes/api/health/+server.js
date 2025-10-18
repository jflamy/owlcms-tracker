/**
 * Health check endpoint for monitoring server status
 * Helps distinguish between crashes and deadlocks
 */

import { competitionHub } from '$lib/server/competition-hub.js';

export async function GET() {
	try {
		const memUsage = process.memoryUsage();
		const uptime = process.uptime();
		const db = competitionHub.getDatabaseState();
		const fops = competitionHub.getAvailableFOPs();
		const locales = competitionHub.getAvailableLocales();
		const metrics = competitionHub.getMetrics();

		// Determine overall health
		let status = 'healthy';
		let issues = [];

		if (memUsage.heapUsed / memUsage.heapTotal > 0.9) {
			status = 'degraded';
			issues.push('Heap memory >90%');
		}

		if (!db || !db.athletes || db.athletes.length === 0) {
			issues.push('No database loaded');
		}

		if (locales.length === 0) {
			issues.push('No translations loaded');
		}

		if (status === 'healthy' && issues.length > 0) {
			status = 'degraded';
		}

		return new Response(
			JSON.stringify({
				status,
				timestamp: new Date().toISOString(),
				uptime: Math.round(uptime),
				memory: {
					heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
					heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
					rssMB: Math.round(memUsage.rss / 1024 / 1024),
					heapUsagePercent: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
				},
				competition: {
					databaseLoaded: !!db,
					athletesCount: db?.athletes?.length || 0,
					fopsCount: fops.length,
					fops: fops.slice(0, 10) // Limit to first 10
				},
				translations: {
					localesCount: locales.length,
					locales: locales.slice(0, 10) // Limit to first 10
				},
				metrics: {
					activeClients: metrics.activeClients,
					messagesReceived: metrics.messagesReceived,
					messagesBroadcast: metrics.messagesBroadcast
				},
				issues: issues.length > 0 ? issues : null,
				alive: true // If this returns, server is not crashed
			}),
			{
				status: status === 'healthy' ? 200 : 503,
				headers: {
					'Content-Type': 'application/json',
					'Cache-Control': 'no-cache'
				}
			}
		);
	} catch (error) {
		console.error('[Health] Health check failed:', error.message);
		return new Response(
			JSON.stringify({
				status: 'error',
				error: error.message,
				alive: false
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
}
