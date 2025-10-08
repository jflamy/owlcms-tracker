import { json } from '@sveltejs/kit';
import { competitionHub } from '$lib/server/competition-hub.js';
import { captureMessage, LEARNING_MODE } from '$lib/server/learning-mode.js';

export async function POST({ request }) {
  try {
    // Get raw body for learning mode before parsing
    const rawBody = await request.text();
    
    // Debug logging - show exact payload received
    console.log('[DATABASE] ===== RAW PAYLOAD DEBUG =====');
    console.log(`[DATABASE] Content-Type: ${request.headers.get('content-type') || 'not set'}`);
    console.log(`[DATABASE] Body length: ${rawBody.length} bytes`);
    console.log(`[DATABASE] First 100 chars: ${rawBody.substring(0, 100)}`);
    console.log('[DATABASE] ============================');
    
    // Parse the body - handle both JSON and form data
    let params;
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('application/json') || rawBody.trim().startsWith('{')) {
      // Parse as JSON
      try {
        params = JSON.parse(rawBody);
        console.log(`[DATABASE] Received JSON data | Size: ${Math.round(rawBody.length / 1024)}KB`);
      } catch (parseErr) {
        console.error('[DATABASE] Failed to parse JSON:', parseErr.message);
        return json({ 
          error: 'invalid_json',
          message: 'Request body is not valid JSON',
          timestamp: Date.now()
        }, { status: 400 });
      }
    } else {
      // Parse as form data
      const formData = new URLSearchParams(rawBody);
      params = Object.fromEntries(formData);
      console.log(`[DATABASE] Received form data | Size: ${Math.round(rawBody.length / 1024)}KB`);
    }
    
    // Capture message in learning mode
    captureMessage(params, rawBody, 'database');
    
    // DATABASE endpoint specific logging
    console.log(`[DATABASE] Fields available: ${Object.keys(params).length} total`);
    if (params.competitionName || params.config?.competitionName) {
      console.log(`[DATABASE] Competition: ${params.competitionName || params.config?.competitionName}`);
    }

    // Skip authentication for now - focus on message capture
    // Handle full competition state data
    const result = competitionHub.handleFullCompetitionData(params);
    
    if (result.accepted) {
      console.log('✅ Full competition data accepted and loaded');
      return json({ 
        success: true,
        message: 'Full competition data loaded successfully',
        clientsNotified: competitionHub.getMetrics().activeClients,
        timestamp: Date.now(),
        learningMode: LEARNING_MODE
      }, { status: 200 });
    } else {
      console.log('❌ Failed to process full competition data');
      return json({
        error: 'processing_error',
        message: result.reason || 'Unable to process full competition data',
        timestamp: Date.now(),
        learningMode: LEARNING_MODE
      }, { status: 500 });
    }
    
  } catch (err) {
    console.error('❌ Database update error:', err);
    return json({ 
      error: 'internal_error',
      message: err.message,
      timestamp: Date.now(),
      learningMode: LEARNING_MODE
    }, { status: 500 });
  }
}