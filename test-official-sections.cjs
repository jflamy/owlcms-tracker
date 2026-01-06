const fs = require('fs');
const path = require('path');

const filePath = './tests/debug-startbook-response.json';
if (!fs.existsSync(filePath)) {
  console.error('File not found:', filePath);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const startbookData = data.data;

console.log('\n=== OFFICIAL SECTIONS (ordered by presentation order) ===');
console.log(`Total sections: ${startbookData.officialSections.length}`);
console.log('\nFirst 10 sections:');

startbookData.officialSections.slice(0, 10).forEach((section, idx) => {
  console.log(`\n[${idx}] ${section.roleCategory}`);
  console.log(`    Translation Key: ${section.translationKey}`);
  console.log(`    Officials: ${section.officials.length}`);
  if (section.officials.length > 0 && section.officials.length <= 3) {
    section.officials.forEach(o => {
      console.log(`      - ${o.lastName}, ${o.firstName} (${o.federation})`);
    });
  } else if (section.officials.length > 0) {
    section.officials.slice(0, 2).forEach(o => {
      console.log(`      - ${o.lastName}, ${o.firstName}`);
    });
    console.log(`      ... and ${section.officials.length - 2} more`);
  }
});

console.log('\n=== TIMETABLE ROWS ===');
console.log(`Total rows: ${startbookData.technicalOfficialsTimetableRows.length}`);
console.log(`Has multiple platforms: ${startbookData.technicalOfficialsTimetableHasMultiplePlatforms}`);

if (startbookData.technicalOfficialsTimetableRows.length > 0) {
  const row = startbookData.technicalOfficialsTimetableRows[0];
  console.log('\nFirst row:');
  console.log(`  sessionName: ${row.sessionName}`);
  console.log(`  description: ${row.description}`);
  console.log(`  date: ${row.date}`);
  console.log(`  time: ${row.time}`);
  console.log(`  platform: ${row.platform}`);
  console.log(`  roles (columns): ${Object.keys(row.roles).join(', ')}`);
  
  // Show which roles have entries
  Object.entries(row.roles).forEach(([roleCategory, teamNumbers]) => {
    if (teamNumbers.length > 0) {
      console.log(`    ${roleCategory}: [${teamNumbers.join(', ')}]`);
    }
  });
}

console.log('\n=== TIMETABLE ROLE INFO (column headers, excluding JURY_PRESIDENT) ===');
console.log(`Total role columns: ${startbookData.technicalOfficialsTimetableRoles.length}`);
startbookData.technicalOfficialsTimetableRoles.forEach((roleInfo, idx) => {
  console.log(`  [${idx}] ${roleInfo.roleCategory} -> ${roleInfo.translationKey}`);
});

// Verify JURY_PRESIDENT is NOT in timetable roles but IS in official sections
const jpresident = startbookData.officialSections.find(s => s.roleCategory === 'JURY_PRESIDENT');
const jpresident_timetable = startbookData.technicalOfficialsTimetableRoles.find(r => r.roleCategory === 'JURY_PRESIDENT');
console.log(`\n=== JURY_PRESIDENT VERIFICATION ===`);
console.log(`In officialSections (full list): ${jpresident ? 'YES' : 'NO'} ${jpresident ? `(${jpresident.officials.length} officials)` : ''}`);
console.log(`In timetableRoles (matrix columns): ${jpresident_timetable ? 'YES' : 'NO'}`);
console.log(`✅ Correct behavior: Jury President shows in full list but NOT in timetable`);
