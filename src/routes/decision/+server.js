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
    captureMessage(params, rawBody, 'decision');
    
    // DECISION endpoint specific logging - uses 'decisionEventType' field
    const eventType = params.decisionEventType || 'unknown';
    const fopName = params.fopName || params.fop || 'unknown';
    const decisions = {
      d1: params.d1 || 'unknown',
      d2: params.d2 || 'unknown', 
      d3: params.d3 || 'unknown'
    };
    console.log(`[DECISION] Event: ${eventType} | FOP: ${fopName} | Decisions: ${decisions.d1}/${decisions.d2}/${decisions.d3}`);
    if (params.fullName) console.log(`[DECISION] Athlete: ${params.fullName} | ${params.liftTypeKey} ${params.attemptNumber}`);
    if (params.decisionsVisible) console.log(`[DECISION] Visible: ${params.decisionsVisible} | Down: ${params.down || 'false'}`);

    // Reject messages that contain full competition data - those belong to /database
    if (params.fullCompetitionData) {
      console.log(`[DECISION] ❌ Rejecting message with full competition data - should go to /database`);
      return json({
        error: 'wrong_endpoint',
        message: 'Decision endpoint only accepts decision events. Full competition data should be sent to /database',
        timestamp: Date.now(),
        learningMode: LEARNING_MODE
      }, { status: 400 });
    }
    
    // Require actual decision event for this endpoint
    if (!params.decisionEventType) {
      console.log(`[DECISION] ❌ Rejecting message - missing decisionEventType field required for /decision`);
      return json({
        error: 'invalid_message',
        message: 'Decision endpoint requires decisionEventType field (RESET, DECISION, etc.)',
        timestamp: Date.now(),
        learningMode: LEARNING_MODE
      }, { status: 400 });
    }
    const result = competitionHub.handleOwlcmsUpdate(params);
    
    if (result.accepted) {
      console.log('✅ Decision update accepted and broadcast to clients');
      return json({ 
        success: true,
        clientsNotified: competitionHub.getMetrics().activeClients,
        timestamp: Date.now(),
        learningMode: LEARNING_MODE
      }, { status: 200 });
    } else if (result.retry) {
      // Database is currently loading, tell client to wait
      console.log('⏳ Database load in progress - returning 202 Accepted (please wait)');
      return json({
        message: 'Database load in progress, update will be processed when ready',
        reason: result.reason,
        timestamp: Date.now(),
        learningMode: LEARNING_MODE
      }, { status: 202 });
    } else if (result.needsData) {
      console.log('⚠️  Need full competition data - returning 428');
      return json({
        error: 'precondition_required',
        message: 'Competition data required before accepting decision updates',
        reason: result.reason,
        timestamp: Date.now(),
        learningMode: LEARNING_MODE
      }, { status: 428 });
    } else {
      return json({
        error: 'processing_error',
        message: result.reason || 'Unable to process decision update',
        timestamp: Date.now(),
        learningMode: LEARNING_MODE
      }, { status: 500 });
    }
  } catch (err) {
    console.error('❌ Decision update error:', err);
    return json({ 
      error: 'internal_error',
      message: err.message,
      timestamp: Date.now(),
      learningMode: LEARNING_MODE
    }, { status: 500 });
  }
}