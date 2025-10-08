import { json } from '@sveltejs/kit';
import { competitionHub } from '$lib/server/competition-hub.js';
import { captureMessage, LEARNING_MODE } from '$lib/server/learning-mode.js';

export async function POST({ request }) {
  try {
    // Get raw body for learning mode before parsing
    const rawBody = await request.text();
    
    // Parse form data from raw body
    const formData = new URLSearchParams(rawBody);
    const params = Object.fromEntries(formData);
    
    // Capture message in learning mode
    captureMessage(params, rawBody, 'update');
    
    // UPDATE endpoint specific logging - uses 'uiEvent' field
    const eventType = params.uiEvent || 'unknown';
    const fopName = params.fopName || params.fop || 'unknown';
    console.log(`[UPDATE] Event: ${eventType} | FOP: ${fopName} | Mode: ${params.mode || 'unknown'}`);
    if (params.fullName) console.log(`[UPDATE] Athlete: ${params.fullName} | Attempt: ${params.attemptNumber || 'unknown'}`);
    if (params.fopState) console.log(`[UPDATE] FOP State: ${params.fopState}`);

    // Reject messages that contain full competition data - those belong to /database
    if (params.fullCompetitionData) {
      console.log(`[UPDATE] ❌ Rejecting message with full competition data - should go to /database`);
      return json({
        error: 'wrong_endpoint',
        message: 'Update endpoint only accepts UI events. Full competition data should be sent to /database',
        timestamp: Date.now(),
        learningMode: LEARNING_MODE
      }, { status: 400 });
    }
    
    // Require actual UI event for this endpoint
    if (!params.uiEvent) {
      console.log(`[UPDATE] ❌ Rejecting message - missing uiEvent field required for /update`);
      return json({
        error: 'invalid_message',
        message: 'Update endpoint requires uiEvent field (LiftingOrderUpdated, SwitchGroup, etc.)',
        timestamp: Date.now(),
        learningMode: LEARNING_MODE
      }, { status: 400 });
    }

    // Skip authentication for now - focus on message capture
    // TODO: Re-enable updateKey validation later
    // const updateKey = params.updateKey;
    // const expectedKey = process.env.UPDATE_KEY || 'development-key';
    // if (!updateKey || updateKey !== expectedKey) {
    //   console.error('[API] Authentication failed, expected:', expectedKey, 'got:', updateKey);
    //   return json({
    //     error: 'authentication_failed',
    //     message: 'Invalid or missing updateKey'
    //   }, { status: 401 });
    // }

    const result = competitionHub.handleOwlcmsUpdate(params);
    
    if (result.accepted) {
      console.log('✅ Update accepted and broadcast to clients');
      return json({ 
        success: true,
        clientsNotified: competitionHub.getMetrics().activeClients,
        timestamp: Date.now(),
        learningMode: LEARNING_MODE
      }, { status: 200 });
    } else if (result.needsData) {
      // Return 428 to tell OWLCMS we need initial competition data
      console.log('⚠️  Need full competition data - returning 428');
      return json({
        error: 'precondition_required',
        message: 'Competition data required before accepting updates',
        reason: result.reason,
        timestamp: Date.now(),
        learningMode: LEARNING_MODE
      }, { status: 428 });
    } else {
      return json({
        error: 'processing_error',
        message: result.reason || 'Unable to process update',
        timestamp: Date.now(),
        learningMode: LEARNING_MODE
      }, { status: 500 });
    }
  } catch (err) {
    console.error('❌ Update error:', err);
    return json({ 
      error: 'internal_error',
      message: err.message,
      timestamp: Date.now(),
      learningMode: LEARNING_MODE
    }, { status: 500 });
  }
}