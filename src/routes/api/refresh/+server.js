import { json } from '@sveltejs/kit';
import { competitionHub } from '$lib/server/competition-hub.js';

/**
 * Manual refresh endpoint - forces hub to request full state
 */
export async function POST() {
  try {
    console.log('[API] Manual refresh requested');
    competitionHub.refresh();
    
    return json({
      success: true,
      message: 'Refresh initiated - hub will request full state on next update',
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