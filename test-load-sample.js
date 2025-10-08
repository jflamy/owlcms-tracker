import fs from 'fs';
import path from 'path';

/**
 * Simple test script to load sample OWLCMS data
 */

const SAMPLE_FILE = 'samples/2025-10-07T23-06-04-943Z-DATABASE-SWITCHGROUP.json';

async function loadSampleData() {
  try {
    // Read the sample file
    const samplePath = path.join(process.cwd(), SAMPLE_FILE);
    const sampleData = JSON.parse(fs.readFileSync(samplePath, 'utf-8'));
    
    console.log('Loading sample data:', Object.keys(sampleData).length, 'fields');
    
    // Convert to form data
    const formData = new URLSearchParams();
    for (const [key, value] of Object.entries(sampleData)) {
      formData.append(key, value);
    }
    
    // Send to database endpoint
    const response = await fetch('http://localhost:8096/database', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Sample data loaded successfully');
      console.log('Response:', result);
      console.log('\n🎯 Visit http://localhost:8096/scoreboard to see the scoreboard');
    } else {
      console.error('❌ Failed to load sample data');
      console.error('Status:', response.status);
      console.error('Response:', await response.text());
    }
    
  } catch (error) {
    console.error('❌ Error loading sample data:', error.message);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  loadSampleData();
}

export { loadSampleData };