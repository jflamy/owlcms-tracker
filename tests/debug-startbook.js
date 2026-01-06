#!/usr/bin/env node
/**
 * Debug script for iwf-startbook API response
 * Run with: node tests/debug-startbook.js
 */

const BASE_URL = process.env.TRACKER_URL || 'http://localhost:8096';

async function fetchStartbook() {
  console.log('='.repeat(60));
  console.log('IWF-STARTBOOK DIAGNOSTIC');
  console.log('='.repeat(60));
  console.log(`Fetching from: ${BASE_URL}/api/scoreboard?type=iwf-startbook`);
  console.log('');

  // Also test SSE connection
  console.log('=== SSE CONNECTION TEST ===');
  try {
    const sseRes = await fetch(`${BASE_URL}/api/client-stream?lang=en`, {
      headers: { 'Accept': 'text/event-stream' }
    });
    console.log(`SSE endpoint status: ${sseRes.status}`);
    console.log(`SSE Content-Type: ${sseRes.headers.get('content-type')}`);
  } catch (err) {
    console.log('SSE test error:', err.message);
  }
  console.log('');

  try {
    const res = await fetch(`${BASE_URL}/api/scoreboard?type=iwf-startbook`);
    console.log(`HTTP Status: ${res.status} ${res.statusText}`);
    console.log(`Content-Type: ${res.headers.get('content-type')}`);
    console.log('');

    const json = await res.json();

    console.log('=== TOP-LEVEL RESPONSE STRUCTURE ===');
    console.log('Keys:', Object.keys(json));
    console.log('');

    if (json.error) {
      console.log('❌ ERROR in response:', json.error);
      return;
    }

    // Check data wrapper
    const data = json.data || json;
    console.log('=== DATA STRUCTURE ===');
    console.log('data keys:', Object.keys(data));
    console.log('');

    // Competition info
    console.log('=== COMPETITION ===');
    console.log('competition:', JSON.stringify(data.competition, null, 2)?.substring(0, 500));
    console.log('');

    // Sessions
    console.log('=== SESSIONS ===');
    const sessions = data.sessions || [];
    console.log(`sessions count: ${sessions.length}`);
    if (sessions.length > 0) {
      console.log('First session keys:', Object.keys(sessions[0]));
      console.log('First session name:', sessions[0].name || sessions[0].sessionName);
      console.log('First session athletes count:', sessions[0].athletes?.length || 0);
      if (sessions[0].athletes?.length > 0) {
        console.log('First athlete sample:', JSON.stringify(sessions[0].athletes[0], null, 2)?.substring(0, 400));
      }
    } else {
      console.log('⚠️  NO SESSIONS IN RESPONSE');
    }
    console.log('');

    // Participation (via participants.championships)
    console.log('=== PARTICIPANTS ===');
    const participants = data.participants || {};
    const championships = participants.championships || [];
    console.log(`participants.championships count: ${championships.length}`);
    if (championships.length > 0) {
      console.log('First championship name:', championships[0]?.name);
      console.log('First championship rows:', championships[0]?.rows?.length || 0);
      console.log('First championship womenCategories:', championships[0]?.womenCategories?.length || 0);
      console.log('First championship menCategories:', championships[0]?.menCategories?.length || 0);
    }
    console.log('');

    // Records
    console.log('=== RECORDS ===');
    const allRecords = data.allRecords || [];
    console.log(`allRecords count: ${allRecords.length}`);
    console.log('hasRecords:', data.hasRecords);
    console.log('newRecordsBroken:', data.newRecordsBroken);
    console.log('');

    // Check for empty arrays that might cause blank display
    console.log('=== EMPTINESS CHECK ===');
    const checks = [
      ['sessions', sessions.length],
      ['participants.championships', championships.length],
      ['allRecords', allRecords.length],
      ['sessions[0].athletes', sessions[0]?.athletes?.length || 0],
    ];
    for (const [name, count] of checks) {
      const status = count === 0 ? '❌ EMPTY' : `✅ ${count} items`;
      console.log(`  ${name}: ${status}`);
    }
    console.log('');

    // Dump full response if small enough
    const jsonStr = JSON.stringify(json, null, 2);
    if (jsonStr.length < 5000) {
      console.log('=== FULL RESPONSE (truncated) ===');
      console.log(jsonStr.substring(0, 5000));
    } else {
      console.log(`=== RESPONSE SIZE: ${jsonStr.length} bytes ===`);
      console.log('(too large to print, saving to tests/debug-startbook-response.json)');
      const fs = await import('fs');
      fs.writeFileSync('tests/debug-startbook-response.json', jsonStr);
    }

  } catch (err) {
    console.error('❌ FETCH ERROR:', err.message);
    console.error(err.stack);
  }
}

fetchStartbook();
