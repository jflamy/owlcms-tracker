#!/usr/bin/env node
/**
 * Test V2 format detection and processing using real OWLCMS V2 database
 * 
 * This script sends a real V2 database export to the tracker to verify:
 * - Format detection (V2)
 * - Numeric type preservation
 * - Category code handling
 * - Age groups parsing
 * - Platform extraction
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import http from 'http';

// Path to real V2 database file
const V2_DB_FILE = 'c:/Users/lamyj/git/owlcms4/owlcms/src/main/java/app/owlcms/monitors/owlcmsDatabase_v2_2025-11-26_15h45.json';

console.log('🧪 Testing V2 format detection with real database...\n');

// Check if file exists
if (!existsSync(V2_DB_FILE)) {
  console.error(`❌ Error: V2 database file not found at ${V2_DB_FILE}`);
  process.exit(1);
}

// Read and parse the database file
console.log(`📁 Reading database file: ${V2_DB_FILE}`);
const dbContent = readFileSync(V2_DB_FILE, 'utf8');
const dbSize = Buffer.byteLength(dbContent, 'utf8');
console.log(`📊 Database size: ${(dbSize / 1024).toFixed(2)} KB\n`);

let database;
try {
  database = JSON.parse(dbContent);
  console.log(`✅ Database parsed successfully`);
  console.log(`   Format version: ${database.formatVersion || 'not specified'}`);
  console.log(`   Athletes: ${database.athletes?.length || 0}`);
  console.log(`   Age groups: ${database.ageGroups?.length || 0}`);
  console.log(`   Platforms: ${database.platforms?.length || 0}`);
  console.log(`   Competition: ${database.competition?.competitionName || 'unknown'}\n`);
} catch (error) {
  console.error(`❌ Error parsing database JSON:`, error.message);
  process.exit(1);
}

// Wrap in WebSocket message format
const message = {
  type: 'database',
  payload: database
};

// Send via WebSocket (proper protocol)
console.log(`📤 Connecting to tracker WebSocket at ws://localhost:8096/ws...\n`);

// Dynamically import ws module
const { default: WebSocket } = await import('ws');

const ws = new WebSocket('ws://localhost:8096/ws');

ws.on('open', () => {
  console.log('✅ WebSocket connected');
  console.log('📤 Sending V2 database...\n');
  
  // Send the message
  ws.send(JSON.stringify(message));
});

ws.on('message', (data) => {
  try {
    const response = JSON.parse(data.toString());
    console.log(`📥 Response from tracker:`);
    console.log(JSON.stringify(response, null, 2));
    console.log('');
  } catch (e) {
    console.log(`📥 Response (text):`, data.toString());
  }
  
  // Close after receiving response
  ws.close();
});

ws.on('close', () => {
  console.log('\n✅ V2 database sent successfully\n');
  console.log('Check tracker console for:');
  console.log('  [Hub] 📋 Detected format: V2');
  console.log('  [V2 Parser] Parsing V2 format database');
  console.log(`  [V2 Parser] Processing ${database.athletes?.length || 0} athletes`);
  console.log(`  [V2 Parser] Has ageGroups: true count: ${database.ageGroups?.length || 0}`);
  console.log('  [V2 Parser] ✅ Parsed XX athletes, XX categories, X FOPs\n');
  
  console.log('To view parsed data:');
  console.log('  http://localhost:8096/api/scoreboard?type=lifting-order&fop=Platform_A');
  
  // Sample a few athletes to verify numeric types (V2 format)
  if (database.athletes && database.athletes.length > 0) {
    const sampleAthlete = database.athletes[0];
    console.log('\n📊 Sample athlete data from V2 database (raw format):');
    console.log(`   First name: ${sampleAthlete.firstName} (V2 has separate first/last)`);
    console.log(`   Last name: ${sampleAthlete.lastName}`);
    console.log(`   Start number: ${sampleAthlete.startNumber} (type: ${typeof sampleAthlete.startNumber})`);
    console.log(`   Lot number: ${sampleAthlete.lotNumber} (type: ${typeof sampleAthlete.lotNumber})`);
    console.log(`   Body weight: ${sampleAthlete.bodyWeight} (type: ${typeof sampleAthlete.bodyWeight})`);
    console.log(`   Snatch 1 declaration: ${sampleAthlete.snatch1Declaration} (type: ${typeof sampleAthlete.snatch1Declaration})`);
    console.log(`   Team (numeric ID): ${sampleAthlete.team} (type: ${typeof sampleAthlete.team})`);
    console.log(`   Category code: ${sampleAthlete.categoryCode}`);
    console.log('\n   Note: Tracker will derive fullName and resolve teamName from ID');
  }
  
  process.exit(0);
});

ws.on('error', (error) => {
  console.error(`❌ WebSocket error:`, error.message);
  console.error('\nMake sure the tracker is running:');
  console.error('  cd c:/Dev/git/owlcms-tracker');
  console.error('  npm run dev');
  process.exit(1);
});
