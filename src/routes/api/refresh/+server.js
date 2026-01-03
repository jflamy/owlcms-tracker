import { json } from '@sveltejs/kit';
import { closeConnection } from '@owlcms/tracker-core';

// Import cache clearing functions from plugins
import { clearCache as clearStartbookCache } from '../../../plugins/iwf-startbook/helpers.data.js';

/**
 * Manual refresh endpoint
 * POST - Clear plugin caches only (keeps hub data, rebuilds from last OWLCMS data)
 * POST with ?fullRefresh=true - Close WebSocket to force OWLCMS full reconnect and data resend
 */
export async function POST({ url }) {
  try {
    const fullRefresh = url.searchParams.get('fullRefresh') === 'true';
    
    console.log('[API] Refresh requested: fullRefresh=' + fullRefresh);
    
    // Clear plugin caches (always - safe operation)
    const cacheResults = [];
    try {
      const startbookResult = clearStartbookCache();
      cacheResults.push({ plugin: 'iwf-startbook', ...startbookResult });
    } catch (err) {
      console.error('[API] Error clearing startbook cache:', err.message);
    }
    
    // Full refresh closes WebSocket - OWLCMS will automatically reconnect and resend everything
    let connectionClosed = false;
    if (fullRefresh) {
      connectionClosed = closeConnection();
    }
    
    return json({
      success: true,
      message: fullRefresh 
        ? (connectionClosed 
            ? 'Full refresh - WebSocket closed, OWLCMS will reconnect and resend all data'
            : 'Full refresh requested but no active connection to close')
        : 'Plugin caches cleared - data will rebuild from existing hub state',
      cachesCleared: cacheResults,
      fullRefresh,
      connectionClosed,
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
  const state = competitionHub.getState();
  const metrics = competitionHub.getMetrics();
  
  return json({
    hasState: !!state,
    metrics,
    lastUpdate: state?.lastUpdate,
    timestamp: Date.now()
  });
}