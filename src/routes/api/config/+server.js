import { json } from '@sveltejs/kit';
import { competitionHub } from '$lib/server/competition-hub.js';

/**
 * Config receiver endpoint for OWLCMS
 * Handles multipart uploads containing local.zip and other config
 */
export async function POST({ request }) {
  try {
    console.log('[Config] Received config upload from OWLCMS');
    
    // For now, just mark that we have config
    // In a full implementation, you'd parse the multipart form data
    // and extract the local.zip file with styles, translations, etc.
    const result = competitionHub.handleConfig({
      received: true,
      timestamp: Date.now()
    });
    
    if (result.accepted) {
      return json({
        success: true,
        message: 'Configuration received',
        timestamp: Date.now()
      }, { status: 200 });
    } else {
      return json({
        error: 'config_error',
        message: 'Failed to process configuration',
        timestamp: Date.now()
      }, { status: 500 });
    }
  } catch (err) {
    console.error('[Config] Error:', err);
    return json({
      error: 'internal_error',
      message: err.message,
      timestamp: Date.now()
    }, { status: 500 });
  }
}

export async function GET() {
  return json({
    status: 'config_endpoint_ready',
    timestamp: Date.now()
  });
}