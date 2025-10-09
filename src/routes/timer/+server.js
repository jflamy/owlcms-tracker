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
    captureMessage(params, rawBody, 'timer');
    
    // TIMER endpoint specific logging - uses 'athleteTimerEventType' or 'breakTimerEventType' field
    const eventType = params.athleteTimerEventType || params.breakTimerEventType || 'unknown';
    const fopName = params.fopName || params.fop || 'unknown';
    const timeRemaining = params.athleteMillisRemaining ? `${params.athleteMillisRemaining}ms` : 
                         params.breakMillisRemaining ? `${params.breakMillisRemaining}ms` : 'unknown';
    console.log(`[TIMER] Event: ${eventType} | FOP: ${fopName} | Time: ${timeRemaining}`);
    if (params.fullName) console.log(`[TIMER] Athlete: ${params.fullName} | Mode: ${params.mode || 'unknown'}`);
    if (params.fopState) console.log(`[TIMER] FOP State: ${params.fopState}`);
    if (params.break) console.log(`[TIMER] Break: ${params.break} | Break Type: ${params.breakType || 'unknown'}`);
    
    // Reject messages that contain full competition data - those belong to /database
    if (params.fullCompetitionData) {
      console.log(`[TIMER] ❌ Rejecting message with full competition data - should go to /database`);
      return json({
        error: 'wrong_endpoint',
        message: 'Timer endpoint only accepts timer events.',
        timestamp: Date.now(),
        learningMode: LEARNING_MODE
      }, { status: 400 });
    }
    
    // Require actual timer event
    if (!params.athleteTimerEventType && !params.breakTimerEventType) {
      console.log(`[TIMER] ❌ Rejecting non-timer message - missing timer event type`);
      return json({
        error: 'invalid_message',
        message: 'Timer endpoint requires athleteTimerEventType or breakTimerEventType field',
        timestamp: Date.now(),
        learningMode: LEARNING_MODE
      }, { status: 400 });
    }

    // Skip authentication for now - focus on message capture
    // Timer events are handled by competition hub
    const result = competitionHub.handleOwlcmsUpdate(params);
    
    if (result.accepted) {
      console.log('✅ Timer update accepted and broadcast to clients');
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
        message: 'Competition data required before accepting timer updates',
        reason: result.reason,
        timestamp: Date.now(),
        learningMode: LEARNING_MODE
      }, { status: 428 });
    } else {
      return json({
        error: 'processing_error',
        message: result.reason || 'Unable to process timer update',
        timestamp: Date.now(),
        learningMode: LEARNING_MODE
      }, { status: 500 });
    }
  } catch (err) {
    console.error('❌ Timer update error:', err);
    return json({ 
      error: 'internal_error',
      message: err.message,
      timestamp: Date.now(),
      learningMode: LEARNING_MODE
    }, { status: 500 });
  }
}