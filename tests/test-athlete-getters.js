/**
 * Test script for athlete getter methods in competition-hub.js
 * 
 * Tests:
 * - getCurrentAthlete(fopName)
 * - getNextAthlete(fopName)
 * - getPreviousAthlete(fopName)
 * 
 * Uses V1 sample data to verify V1 format support
 * (V2 samples not yet available from real OWLCMS)
 */

import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TRACKER_URL = 'ws://localhost:8096/ws';

// Connect to tracker's WebSocket
const ws = new WebSocket(TRACKER_URL);

ws.on('open', async () => {
	console.log('✅ Connected to tracker WebSocket');
	console.log('');

	// Load a sample UPDATE message (V1 format with groupAthletes)
	const samplePath = path.join(
		__dirname,
		'..',
		'samples',
		'2025-11-23T15-28-15-965-UPDATE-LIFTINGORDERUPDATED.json'
	);

	if (!fs.existsSync(samplePath)) {
		console.error('❌ Sample file not found:', samplePath);
		console.log('   Run OWLCMS with tracker to generate sample data');
		ws.close();
		return;
	}

	console.log('📂 Loading sample UPDATE message...');
	const sampleData = JSON.parse(fs.readFileSync(samplePath, 'utf8'));

	// Wrap in WebSocket message format
	const message = {
		type: 'update',
		payload: sampleData
	};

	console.log('📤 Sending UPDATE message to tracker...');
	ws.send(JSON.stringify(message));

	// Wait for tracker to process
	await new Promise((resolve) => setTimeout(resolve, 500));

	console.log('');
	console.log('🔍 Testing athlete getter methods via HTTP API...');
	console.log('');

	// Test via HTTP API (since WebSocket is for receiving only)
	const testAthleteGetters = async () => {
		try {
			// Fetch current athlete
			const currentResponse = await fetch('http://localhost:8096/api/test-athlete-getters?fop=A');
			const result = await currentResponse.json();

			console.log('📊 Results for FOP "A":');
			console.log('');

			if (result.currentAthlete) {
				console.log('✅ Current Athlete:');
				console.log('   Name:', result.currentAthlete.fullName);
				console.log('   Weight:', result.currentAthlete.currentWeight, 'kg');
				console.log('   Attempt:', result.currentAthlete.currentAttempt);
				console.log('   Lift Type:', result.currentAthlete.currentLiftType);
				console.log('   Attempts Done:', result.currentAthlete.attemptsDone);
			} else {
				console.log('⚠️  No current athlete found');
			}
			console.log('');

			if (result.nextAthlete) {
				console.log('✅ Next Athlete:');
				console.log('   Name:', result.nextAthlete.fullName);
				console.log('   Weight:', result.nextAthlete.currentWeight, 'kg');
				console.log('   Attempt:', result.nextAthlete.currentAttempt);
				console.log('   Lift Type:', result.nextAthlete.currentLiftType);
			} else {
				console.log('⚠️  No next athlete found');
			}
			console.log('');

			if (result.previousAthlete) {
				console.log('✅ Previous Athlete:');
				console.log('   Name:', result.previousAthlete.fullName);
				console.log('   Weight:', result.previousAthlete.currentWeight, 'kg');
				console.log('   Attempt:', result.previousAthlete.currentAttempt);
			} else {
				console.log('ℹ️  No previous athlete found (expected for V1 format)');
			}
			console.log('');

			console.log('✅ Test complete!');
			console.log('');
			console.log('💡 Note: V1 format does not track previous athlete directly.');
			console.log('   V2 format will provide previousAthleteKey for full support.');
		} catch (err) {
			console.error('❌ Error testing athlete getters:', err.message);
		}

		ws.close();
		process.exit(0);
	};

	// Run tests
	testAthleteGetters();
});

ws.on('error', (err) => {
	console.error('❌ WebSocket error:', err.message);
	process.exit(1);
});

ws.on('close', () => {
	console.log('🔌 Disconnected from tracker');
});
