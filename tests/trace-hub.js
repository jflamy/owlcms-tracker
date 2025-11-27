import { CompetitionHub } from '../src/lib/server/competition-hub.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
    console.log('--- Starting Trace ---');
    const hub = new CompetitionHub();
    
    // Load sample data
    const samplePath = path.join(__dirname, '../samples/2025-11-27T14-03-16-261-UPDATE-LIFTINGORDERUPDATED.json');
    console.log(`Loading sample from: ${samplePath}`);
    
    if (!fs.existsSync(samplePath)) {
        console.error('Sample file not found!');
        return;
    }
    
    const rawData = fs.readFileSync(samplePath, 'utf8');
    const update = JSON.parse(rawData);
    
    console.log('Processing update...');
    const result = hub.processUpdate(update);
    console.log('Update processed result:', result);
    
    const fopUpdate = hub.getFopUpdate('A');
    
    if (fopUpdate && fopUpdate.startOrderAthletes) {
        console.log('Checking startOrderAthletes...');
        // Find an athlete with attempts
        const athlete = fopUpdate.startOrderAthletes.find(a => !a.isSpacer && a.sattempts && a.sattempts.length > 0);
        
        if (athlete) {
            console.log('Found athlete:', athlete.fullName);
            console.log('sattempts type:', typeof athlete.sattempts);
            console.log('sattempts value:', JSON.stringify(athlete.sattempts, null, 2));
            
            if (athlete.sattempts.length > 0) {
                const firstAttempt = athlete.sattempts[0];
                console.log('First attempt type:', typeof firstAttempt);
                if (typeof firstAttempt === 'object') {
                    console.log('First attempt is object. Keys:', Object.keys(firstAttempt));
                }
            }
        } else {
            console.log('No athletes with attempts found in startOrderAthletes');
        }
    } else {
        console.log('No startOrderAthletes in fopUpdate');
    }
    
    console.log('--- Trace Complete ---');
}

run().catch(err => console.error(err));
