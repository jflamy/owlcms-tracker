/**
 * Status endpoint - Check if the hub is ready to receive messages
 */

import { json } from '@sveltejs/kit';
import { competitionHub } from '$lib/server/competition-hub.js';
import { sseBroker } from '$lib/server/sse-broker.js';

export async function GET() {
  const state = competitionHub.getState();
  const activeClients = sseBroker.getActiveClientCount();
  
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
      activeClients,
      messagesReceived: 0,
      messagesBroadcast: 0
    },
    timestamp: new Date().toISOString()
  });
}