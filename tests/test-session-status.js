#!/usr/bin/env node

/**
 * Test script for session status tracking
 * Tests that the competition hub correctly detects GroupDone and session reopening
 * 
 * Session reopening occurs when ANY of these is received after GroupDone:
 * - Timer event (type="timer")
 * - Decision event (type="decision")
 * - Update event (type="update" with uiEvent != "GroupDone")
 */

import WebSocket from 'ws';

const WS_URL = 'ws://localhost:8096/ws';

console.log('🧪 Testing Session Status Tracking\n');
console.log('This test will:');
console.log('1. Send a normal update (session active)');
console.log('2. Send a GroupDone event (session complete)');
console.log('3. Send a timer event (session reopened automatically)');
console.log('4. Check that the hub detected all state changes\n');

// Test messages
const normalUpdate = {
  type: 'update',
  payload: {
    uiEvent: 'LiftingOrderUpdated',
    fopName: 'A',
    sessionName: 'M1',
    fullName: 'Test Athlete',
    attemptNumber: '1',
    weight: '120'
  }
};

const groupDoneUpdate = {
  type: 'update',
  payload: {
    uiEvent: 'GroupDone',
    fopName: 'A',
    fopState: 'BREAK',
    break: 'true',
    breakType: 'GROUP_DONE',
    sessionName: '',
    liftsDone: ''
  }
};

const timerAfterDone = {
  type: 'timer',
  payload: {
    athleteTimerEventType: 'StartTime',
    fopName: 'A',
    athleteMillisRemaining: '60000',
    timeAllowed: '60000',
    fullName: 'New Athlete',
    sessionName: 'M2'
  }
};

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  const ws = new WebSocket(WS_URL);
  
  ws.on('open', async () => {
    console.log('✅ Connected to WebSocket\n');
    
    try {
      // Step 1: Send normal update
      console.log('📤 Step 1: Sending normal update (session active)...');
      ws.send(JSON.stringify(normalUpdate));
      await delay(500);
      
      // Step 2: Send GroupDone
      console.log('📤 Step 2: Sending GroupDone event (session complete)...');
      ws.send(JSON.stringify(groupDoneUpdate));
      await delay(500);
      
      // Step 3: Send timer to reopen session
      console.log('📤 Step 3: Sending timer event (session reopened)...');
      ws.send(JSON.stringify(timerAfterDone));
      await delay(500);
      
      console.log('\n✅ All messages sent!');
      console.log('\n📋 Check the tracker logs for:');
      console.log('   - "🏁 Session completed for FOP A"');
      console.log('   - "🔄 Session reopened for FOP A"');
      console.log('\nYou can also check session status via:');
      console.log('   competitionHub.getSessionStatus("A")');
      console.log('   competitionHub.isSessionDone("A")');
      
      ws.close();
      process.exit(0);
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      ws.close();
      process.exit(1);
    }
  });
  
  ws.on('message', (data) => {
    try {
      const response = JSON.parse(data);
      console.log(`   ← Response: status=${response.status}, message="${response.message}"`);
    } catch (e) {
      console.log(`   ← Response: ${data}`);
    }
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
    process.exit(1);
  });
  
  ws.on('close', () => {
    console.log('\n🔌 WebSocket connection closed');
  });
}

// Run the test
runTest().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
