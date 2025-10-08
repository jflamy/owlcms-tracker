/**
 * Status endpoint - Check if the hub is ready to receive messages
 */

import { json } from '@sveltejs/kit';
import { competitionHub } from '$lib/server/competition-hub.js';

export async function GET() {
  const metrics = competitionHub.getMetrics();
  const state = competitionHub.getState();
  
  return json({
    status: 'ready',
    message: 'Competition Hub is ready to receive OWLCMS messages',
    ready: true,
    hasCompetitionData: !!state,
    endpoints: {
      timer: '/timer',
      decision: '/decision',
      update: '/update', 
      database: '/database',
      config: '/config',
      clientStream: '/api/client-stream',
      status: '/api/status'
    },
    metrics: {
      activeClients: metrics.activeClients,
      messagesReceived: metrics.messagesReceived,
      messagesBroadcast: metrics.messagesBroadcast
    },
    timestamp: new Date().toISOString()
  });
}