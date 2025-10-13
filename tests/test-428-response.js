#!/usr/bin/env node

/**
 * Test script to verify 428 response includes missing preconditions
 * 
 * This script connects to the WebSocket server and sends an update
 * without first sending database, then verifies the 428 response
 * includes the "missing" array.
 */

import WebSocket from 'ws';

const WS_URL = 'ws://localhost:8096/ws';

console.log('🧪 Testing 428 Response with Missing Preconditions');
console.log('================================================\n');

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
	console.log('✅ WebSocket connection established\n');
	
	// Send an update message WITHOUT sending database first
	const updateMessage = {
		type: 'update',
		payload: {
			uiEvent: 'LiftingOrderUpdated',
			fop: 'A',
			fullName: 'Test Athlete',
			weight: '100',
			attemptNumber: '1'
		}
	};
	
	console.log('📤 Sending UPDATE message (without database):');
	console.log(JSON.stringify(updateMessage, null, 2));
	console.log('');
	
	ws.send(JSON.stringify(updateMessage));
});

ws.on('message', (data) => {
	const response = JSON.parse(data.toString());
	
	console.log('📥 Received response:');
	console.log(JSON.stringify(response, null, 2));
	console.log('');
	
	// Verify the response
	if (response.status === 428) {
		console.log('✅ Status 428 received (correct)');
		
		if (response.message === 'Precondition Required: Missing required data') {
			console.log('✅ Generic message "Missing required data" (correct)');
		} else {
			console.log(`⚠️  Message is: "${response.message}" (expected generic message)`);
		}
		
		if (response.missing && Array.isArray(response.missing)) {
			console.log(`✅ Missing array present: ${JSON.stringify(response.missing)}`);
			
			if (response.missing.includes('database')) {
				console.log('✅ "database" is in missing array (correct)');
				console.log('\n🎉 TEST PASSED - 428 response includes missing preconditions!\n');
			} else {
				console.log('❌ "database" is NOT in missing array (incorrect)');
				console.log('\n❌ TEST FAILED\n');
			}
		} else {
			console.log('❌ Missing array is NOT present in response (incorrect)');
			console.log('\n❌ TEST FAILED\n');
		}
	} else {
		console.log(`❌ Expected status 428, got ${response.status}`);
		console.log('\n❌ TEST FAILED\n');
	}
	
	// Close connection
	ws.close();
});

ws.on('error', (error) => {
	console.error('❌ WebSocket error:', error.message);
	process.exit(1);
});

ws.on('close', () => {
	console.log('🔌 Connection closed');
	process.exit(0);
});
