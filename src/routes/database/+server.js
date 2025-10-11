import { json } from '@sveltejs/kit';
import { competitionHub } from '$lib/server/competition-hub.js';
import { captureMessage, LEARNING_MODE } from '$lib/server/learning-mode.js';
import { extractEmbeddedDatabase } from '$lib/server/embedded-database.js';

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
    
    // Capture message in learning mode (before mutating params)
    captureMessage(params, rawBody, 'database');

    // Handle embedded database envelopes (same as WebSocket / other endpoints)
    const embeddedDatabase = extractEmbeddedDatabase(params);
    if (embeddedDatabase.error) {
      return json({
        error: 'invalid_database_payload',
        message: 'Failed to parse embedded database payload',
        timestamp: Date.now(),
        learningMode: LEARNING_MODE
      }, { status: 400 });
    }

    const payloadToProcess = embeddedDatabase.hasDatabase ? embeddedDatabase.payload : params;
    if (embeddedDatabase.hasDatabase) {
      console.log(`[DATABASE] Embedded database payload detected (checksum ${embeddedDatabase.checksum || 'none'})`);
    }
    
    // DATABASE endpoint specific logging
    console.log(`[DATABASE] Fields available: ${Object.keys(params).length} total`);
    if (payloadToProcess.competitionName || payloadToProcess.config?.competitionName || payloadToProcess.competition?.competitionName) {
      const competitionName = payloadToProcess.competitionName
        || payloadToProcess.config?.competitionName
        || payloadToProcess.competition?.competitionName
        || payloadToProcess.competition?.name;
      if (competitionName) {
        console.log(`[DATABASE] Competition: ${competitionName}`);
      }
    }

    // Skip authentication for now - focus on message capture
    // Handle full competition state data
    const result = competitionHub.handleFullCompetitionData(payloadToProcess);
    
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