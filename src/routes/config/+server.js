import { json } from '@sveltejs/kit';
import { LEARNING_MODE } from '$lib/server/learning-mode.js';

export async function POST({ request }) {
  try {
    console.log('[CONFIG] Received config upload from OWLCMS');
    
    // For now, just accept config uploads and return success
    // In the future, this could handle styling/configuration files
    
    if (LEARNING_MODE) {
      console.log('📁 Config upload received in learning mode');
    }
    
    return json({ 
      success: true,
      message: 'Configuration received',
      timestamp: Date.now(),
      learningMode: LEARNING_MODE
    }, { status: 200 });
    
  } catch (err) {
    console.error('❌ Config upload error:', err);
    return json({ 
      error: 'internal_error',
      message: err.message,
      timestamp: Date.now(),
      learningMode: LEARNING_MODE
    }, { status: 500 });
  }
}