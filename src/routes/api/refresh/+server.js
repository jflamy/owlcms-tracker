import { json } from '@sveltejs/kit';
import { closeConnection, competitionHub } from '@owlcms/tracker-core';
import { scoreboardRegistry } from '$lib/server/scoreboard-registry.js';

/**
 * Manual refresh endpoint
 * POST - Flush all plugin caches (keeps hub data, rebuilds from last OWLCMS data)
 * POST with ?fullRefresh=true - Close WebSocket to force OWLCMS full reconnect and data resend
 * 
 * Both modes broadcast an SSE event so browsers automatically re-fetch data.
 */
export async function POST({ url }) {
  try {
    const fullRefresh = url.searchParams.get('fullRefresh') === 'true';
    
    console.log('[API] Refresh requested: fullRefresh=' + fullRefresh);
    
    // Flush all plugin caches via the registry
    const cacheEpoch = scoreboardRegistry.flushCaches();
    
    // Full refresh closes WebSocket - OWLCMS will automatically reconnect and resend everything
    let connectionClosed = false;
    if (fullRefresh) {
      connectionClosed = closeConnection();
    }
    
    // Broadcast refresh event to all connected browsers via SSE
    // This triggers browsers to re-fetch their scoreboard data immediately
    const fops = competitionHub.getAvailableFOPs();
    for (const fop of fops) {
      competitionHub.emit('fop_update', {
        fop,
        data: { refreshTriggered: true, cacheEpoch },
        timestamp: Date.now()
      });
    }
    // Also emit for browsers not listening to a specific FOP
    competitionHub.emit('fop_update', {
      fop: 'ALL',
      data: { refreshTriggered: true, cacheEpoch },
      timestamp: Date.now()
    });
    
    return json({
      success: true,
      message: fullRefresh 
        ? (connectionClosed 
            ? 'Full refresh - WebSocket closed, OWLCMS will reconnect and resend all data'
            : 'Full refresh requested but no active connection to close')
        : 'Plugin caches flushed - browsers notified to re-fetch',
      fullRefresh,
      connectionClosed,
      cacheEpoch,
      browsersNotified: fops.length + 1,
      timestamp: Date.now()
    });
  } catch (err) {
    console.error('[API] Refresh error:', err);
    return json({ 
      error: 'internal_error',
      message: err.message,
      timestamp: Date.now()
    }, { status: 500 });
  }
}

/**
 * Get refresh status
 */
export async function GET() {
  // Import hub dynamically to avoid circular dependencies
  const { competitionHub } = await import('@owlcms/tracker-core');
  
  return json({
    isReady: competitionHub.isReady(),
    fops: competitionHub.getAvailableFOPs(),
    timestamp: Date.now()
  });
}