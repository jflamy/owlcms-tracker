/**
 * Validate a rendered OBS scene collection JSON for structural correctness.
 * Checks:
 *  1. scene_order entries all have matching scene sources
 *  2. Every scene-item references a defined source
 *  3. No leftover Mustache placeholders in any string value
 *  4. Required top-level keys present
 *  5. Every source has required fields (name, id)
 */
const fs = require('fs');
const path = require('path');

const file = process.argv[2] || path.resolve(__dirname, 'Streaming-rendered.json');
const data = JSON.parse(fs.readFileSync(file, 'utf-8'));

let errors = 0;
let warnings = 0;

function err(msg) { console.error('  ERROR:', msg); errors++; }
function warn(msg) { console.warn('  WARN:', msg); warnings++; }

console.log(`Validating: ${path.basename(file)}`);
console.log('');

// --- 1. Top-level keys ---
console.log('=== Top-level structure ===');
const requiredKeys = ['name', 'sources', 'scene_order', 'current_scene'];
for (const k of requiredKeys) {
  if (!(k in data)) err(`Missing required top-level key: "${k}"`);
}
console.log(`  name: "${data.name}"`);
console.log(`  version: ${data.version}`);
console.log(`  current_scene: "${data.current_scene}"`);
console.log(`  scene_order: ${(data.scene_order || []).length} scenes`);
console.log(`  sources: ${(data.sources || []).length} total`);

// --- 2. Categorize sources ---
console.log('\n=== Source analysis ===');
const scenes = data.sources.filter(s => s.id === 'scene');
const inputs = data.sources.filter(s => s.id !== 'scene');
console.log(`  Scenes: ${scenes.length}`);
console.log(`  Inputs: ${inputs.length}`);

// Build lookup of all source names
const sourceNames = new Set(data.sources.map(s => s.name));
const inputNames = new Set(inputs.map(s => s.name));

// --- 3. scene_order vs actual scenes ---
console.log('\n=== Scene order validation ===');
const sceneSourceNames = new Set(scenes.map(s => s.name));
for (const entry of (data.scene_order || [])) {
  if (!sceneSourceNames.has(entry.name)) {
    err(`scene_order references "${entry.name}" but no scene source exists`);
  }
}
for (const s of scenes) {
  const inOrder = (data.scene_order || []).some(e => e.name === s.name);
  if (!inOrder) warn(`Scene "${s.name}" exists but is not in scene_order`);
}
if (data.current_scene && !sceneSourceNames.has(data.current_scene)) {
  err(`current_scene "${data.current_scene}" is not a defined scene`);
}
console.log(`  All scene_order entries have matching sources: ${errors === 0 ? 'YES' : 'NO'}`);

// --- 4. Scene items reference valid sources ---
console.log('\n=== Scene item references ===');
let totalItems = 0;
let missingRefs = 0;
for (const scene of scenes) {
  const items = scene.settings?.items || [];
  for (const item of items) {
    totalItems++;
    if (!sourceNames.has(item.name)) {
      err(`Scene "${scene.name}" item references "${item.name}" which is not a defined source`);
      missingRefs++;
    }
  }
}
console.log(`  Total scene items: ${totalItems}`);
console.log(`  Missing references: ${missingRefs}`);

// --- 5. Source field validation ---
console.log('\n=== Source field validation ===');
for (const s of data.sources) {
  if (!s.name) err('Source without a name');
  if (!s.id) err(`Source "${s.name}" missing "id" field`);
}

// --- 6. Leftover placeholders ---
console.log('\n=== Placeholder check ===');
const jsonStr = JSON.stringify(data);
const leftover = jsonStr.match(/\{\{[^}]+\}\}/g);
if (leftover) {
  const unique = [...new Set(leftover)];
  err(`Unsubstituted placeholders: ${unique.join(', ')}`);
} else {
  console.log('  No leftover {{...}} placeholders');
}

// --- 7. Duplicate source names ---
console.log('\n=== Duplicate check ===');
const nameCounts = {};
for (const s of data.sources) {
  nameCounts[s.name] = (nameCounts[s.name] || 0) + 1;
}
const dupes = Object.entries(nameCounts).filter(([, c]) => c > 1);
if (dupes.length) {
  for (const [name, count] of dupes) {
    warn(`Duplicate source name: "${name}" appears ${count} times`);
  }
} else {
  console.log('  No duplicate source names');
}

// --- 8. List all input types ---
console.log('\n=== Input types ===');
const typeMap = {};
for (const s of inputs) {
  const kind = s.versioned_id || s.id;
  if (!typeMap[kind]) typeMap[kind] = [];
  typeMap[kind].push(s.name);
}
for (const [kind, names] of Object.entries(typeMap).sort()) {
  console.log(`  ${kind} (${names.length}): ${names.join(', ')}`);
}

// --- Summary ---
console.log('\n========================================');
if (errors === 0 && warnings === 0) {
  console.log('RESULT: VALID - No errors or warnings');
} else if (errors === 0) {
  console.log(`RESULT: VALID with ${warnings} warning(s)`);
} else {
  console.log(`RESULT: INVALID - ${errors} error(s), ${warnings} warning(s)`);
}
process.exit(errors > 0 ? 1 : 0);
