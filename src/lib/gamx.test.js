/**
 * Test GAMX JavaScript implementation against known reference values
 * These are the same test cases used in Java GAMX2ComparisonTest
 * 
 * Run with: node src/lib/gamx.test.js
 */

import { computeGamx, computeGamxM, kgTarget, pBCCG, normalCdf, normalQuantile, Variant } from './gamx.js';

// Test cases with expected values from Docker API (R reference implementation)
const MEN_TEST_CASES = [
	{ bodyMass: 55.0, total: 200, expected: 827.08 },
	{ bodyMass: 61.0, total: 250, expected: 892.88 },
	{ bodyMass: 67.0, total: 280, expected: 916.85 },
	{ bodyMass: 73.0, total: 310, expected: 961.73 },
	{ bodyMass: 81.0, total: 340, expected: 1020.74 },
	{ bodyMass: 89.0, total: 370, expected: 1094.89 },
	{ bodyMass: 96.0, total: 390, expected: 1134.51 },
	{ bodyMass: 102.0, total: 410, expected: 1183.90 },
	{ bodyMass: 109.0, total: 430, expected: 1230.90 },
	{ bodyMass: 120.0, total: 450, expected: 1300.98 }
];

// Women test cases - expected values from Docker API (R reference, sex=W)
const WOMEN_TEST_CASES = [
	{ bodyMass: 45.0, total: 130, expected: 842.70 },
	{ bodyMass: 49.0, total: 160, expected: 929.82 },
	{ bodyMass: 55.0, total: 180, expected: 951.52 },
	{ bodyMass: 59.0, total: 195, expected: 979.08 },
	{ bodyMass: 64.0, total: 210, expected: 1008.47 },
	{ bodyMass: 71.0, total: 230, expected: 1048.06 },
	{ bodyMass: 76.0, total: 245, expected: 1083.84 },
	{ bodyMass: 81.0, total: 255, expected: 1112.91 },
	{ bodyMass: 87.0, total: 270, expected: 1190.52 },
	{ bodyMass: 100.0, total: 290, expected: 1263.83 }
];

const TOLERANCE = 0.1; // Allow 0.1 GAMX points tolerance

function runTests() {
	let passed = 0;
	let failed = 0;

	console.log('Testing GAMX JavaScript implementation');
	console.log('======================================\n');

	// Test men
	console.log('Men test cases:');
	for (const tc of MEN_TEST_CASES) {
		const result = computeGamx('M', tc.bodyMass, tc.total);
		const diff = Math.abs(result - tc.expected);
		const status = diff <= TOLERANCE ? '✓' : '✗';
		
		console.log(`  ${status} bodyMass=${tc.bodyMass}, total=${tc.total}: ` +
			`expected=${tc.expected.toFixed(2)}, got=${result.toFixed(2)}, diff=${diff.toFixed(4)}`);
		
		if (diff <= TOLERANCE) {
			passed++;
		} else {
			failed++;
		}
	}

	console.log('\nWomen test cases:');
	for (const tc of WOMEN_TEST_CASES) {
		const result = computeGamx('F', tc.bodyMass, tc.total);
		const diff = Math.abs(result - tc.expected);
		const status = diff <= TOLERANCE ? '✓' : '✗';
		
		console.log(`  ${status} bodyMass=${tc.bodyMass}, total=${tc.total}: ` +
			`expected=${tc.expected.toFixed(2)}, got=${result.toFixed(2)}, diff=${diff.toFixed(4)}`);
		
		if (diff <= TOLERANCE) {
			passed++;
		} else {
			failed++;
		}
	}

	console.log('\n======================================');
	console.log(`GAMX Results: ${passed} passed, ${failed} failed\n`);
	
	return { passed, failed };
}

/**
 * Test kgTarget function
 */
function testKgTarget() {
	console.log('Testing kgTarget function');
	console.log('======================================\n');

	let passed = 0;
	let failed = 0;

	// Test cases: (gender, bodyMass, targetGAMX)
	const MEN_KGTARGET_CASES = [
		{ bodyMass: 100.0, targetGAMX: 800.0 },
		{ bodyMass: 85.0, targetGAMX: 750.0 },
		{ bodyMass: 73.0, targetGAMX: 900.0 },
		{ bodyMass: 120.0, targetGAMX: 1000.0 },
		{ bodyMass: 61.0, targetGAMX: 850.0 }
	];

	const WOMEN_KGTARGET_CASES = [
		{ bodyMass: 70.0, targetGAMX: 850.0 },
		{ bodyMass: 60.0, targetGAMX: 800.0 },
		{ bodyMass: 80.0, targetGAMX: 900.0 },
		{ bodyMass: 50.0, targetGAMX: 750.0 },
		{ bodyMass: 90.0, targetGAMX: 880.0 }
	];

	// Test men
	console.log('Men kgTarget test cases:');
	for (const tc of MEN_KGTARGET_CASES) {
		const computedTotal = kgTarget('M', tc.targetGAMX, tc.bodyMass);

		if (computedTotal === 0) {
			console.log(`  ✗ M/${tc.bodyMass}kg/target=${tc.targetGAMX}: kgTarget returned 0`);
			failed++;
			continue;
		}

		// Verify: GAMX at returned total must strictly exceed target at 2 decimal precision
		const actualGAMX = computeGamx('M', tc.bodyMass, computedTotal);
		const actualRounded = Math.round(actualGAMX * 100) / 100;
		const targetRounded = Math.round(tc.targetGAMX * 100) / 100;

		if (actualRounded > targetRounded) {
			console.log(`  ✓ M/${tc.bodyMass}kg/target=${tc.targetGAMX}: ` +
				`total=${computedTotal}kg, actualGAMX=${actualGAMX.toFixed(4)} (> target)`);
			passed++;
		} else {
			console.log(`  ✗ M/${tc.bodyMass}kg/target=${tc.targetGAMX}: ` +
				`total=${computedTotal}kg, actualGAMX=${actualGAMX.toFixed(4)} (<= target!)`);
			failed++;
		}
	}

	// Test women
	console.log('\nWomen kgTarget test cases:');
	for (const tc of WOMEN_KGTARGET_CASES) {
		const computedTotal = kgTarget('F', tc.targetGAMX, tc.bodyMass);

		if (computedTotal === 0) {
			console.log(`  ✗ W/${tc.bodyMass}kg/target=${tc.targetGAMX}: kgTarget returned 0`);
			failed++;
			continue;
		}

		// Verify: GAMX at returned total must strictly exceed target at 2 decimal precision
		const actualGAMX = computeGamx('F', tc.bodyMass, computedTotal);
		const actualRounded = Math.round(actualGAMX * 100) / 100;
		const targetRounded = Math.round(tc.targetGAMX * 100) / 100;

		if (actualRounded > targetRounded) {
			console.log(`  ✓ W/${tc.bodyMass}kg/target=${tc.targetGAMX}: ` +
				`total=${computedTotal}kg, actualGAMX=${actualGAMX.toFixed(4)} (> target)`);
			passed++;
		} else {
			console.log(`  ✗ W/${tc.bodyMass}kg/target=${tc.targetGAMX}: ` +
				`total=${computedTotal}kg, actualGAMX=${actualGAMX.toFixed(4)} (<= target!)`);
			failed++;
		}
	}

	console.log('\n======================================');
	console.log(`kgTarget Results: ${passed} passed, ${failed} failed\n`);

	return { passed, failed };
}

/**
 * Test that kgTarget returns total that strictly beats opponent (no ties)
 */
function testKgTargetStrictlyExceeds() {
	console.log('Testing kgTarget strictly exceeds (no ties at 2 decimals)');
	console.log('======================================\n');

	let passed = 0;
	let failed = 0;

	// Test cases: (gender, bodyMass, opponentTotal)
	const TEST_CASES = [
		{ gender: 'M', bodyMass: 85.0, opponentTotal: 300 },
		{ gender: 'M', bodyMass: 102.0, opponentTotal: 350 },
		{ gender: 'F', bodyMass: 64.0, opponentTotal: 200 },
		{ gender: 'F', bodyMass: 76.0, opponentTotal: 230 }
	];

	for (const tc of TEST_CASES) {
		// Compute opponent's GAMX score
		const opponentGAMX = computeGamx(tc.gender, tc.bodyMass, tc.opponentTotal);
		const opponentRounded = Math.round(opponentGAMX * 100) / 100;

		// Find total needed to beat opponent
		const totalToBeat = kgTarget(tc.gender, opponentGAMX, tc.bodyMass);

		// Compute our GAMX at that total
		const ourGAMX = computeGamx(tc.gender, tc.bodyMass, totalToBeat);
		const ourRounded = Math.round(ourGAMX * 100) / 100;

		// Must strictly exceed at 2 decimal precision (no ties)
		if (ourRounded > opponentRounded) {
			console.log(`  ✓ ${tc.gender}/${tc.bodyMass}kg: opponent=${tc.opponentTotal}kg(${opponentRounded.toFixed(2)}), ` +
				`toBeat=${totalToBeat}kg(${ourRounded.toFixed(2)}) - WIN by ${(ourRounded - opponentRounded).toFixed(2)}`);
			passed++;
		} else {
			console.log(`  ✗ ${tc.gender}/${tc.bodyMass}kg: opponent=${tc.opponentTotal}kg(${opponentRounded.toFixed(2)}), ` +
				`toBeat=${totalToBeat}kg(${ourRounded.toFixed(2)}) - TIE or LOSS!`);
			failed++;
		}
	}

	console.log('\n======================================');
	console.log(`Strict exceed Results: ${passed} passed, ${failed} failed\n`);

	return { passed, failed };
}

/**
 * Test MASTERS age normalization and kgTarget cross-age comparison
 * This is the critical test that catches the age vs normalizedAge bug
 * 
 * Reference values from Docker R API with exact parameters from params-mas-men.js:
 * - Age 58, BM 69: mu=163.770409487479, sigma=0.105472350251498, nu=0.53236001054616
 *   total=140 -> GAMX=857.35 (from R)
 * - Age 30, BM 69: mu=220.213456040162, sigma=0.0875215463380972, nu=1.22900006230725
 *   total=140 -> GAMX=603.13 (from R)
 */
function testMastersAgeNormalization() {
	console.log('Testing MASTERS age normalization');
	console.log('======================================\n');

	let passed = 0;
	let failed = 0;

	const BODY_MASS = 69.0;

	// Test 1: Age 58, total 140kg should give high GAMX (older = weaker = higher score)
	const gamx58 = computeGamxM('M', BODY_MASS, 140, 58);
	console.log(`  Age 58, 140kg -> GAMX = ${gamx58.toFixed(2)}`);
	
	// Expected from Docker API with exact JS params: 857.35
	if (Math.abs(gamx58 - 857.35) < 0.01) {
		console.log(`  ✓ Age 58 GAMX matches R reference 857.35`);
		passed++;
	} else {
		console.log(`  ✗ Age 58 GAMX differs from R reference 857.35 by ${Math.abs(gamx58 - 857.35).toFixed(4)}`);
		failed++;
	}

	// Test 2: Age 30, 140kg should give lower GAMX (younger = stronger = lower score)
	const gamx30 = computeGamxM('M', BODY_MASS, 140, 30);
	console.log(`  Age 30, 140kg -> GAMX = ${gamx30.toFixed(2)}`);
	
	// Expected from Docker API with exact JS params: 603.13
	if (Math.abs(gamx30 - 603.13) < 0.01) {
		console.log(`  ✓ Age 30 GAMX matches R reference 603.13`);
		passed++;
	} else {
		console.log(`  ✗ Age 30 GAMX differs from R reference 603.13 by ${Math.abs(gamx30 - 603.13).toFixed(4)}`);
		failed++;
	}

	// Test 3: Age 25 should normalize to age 30 (MASTERS table starts at 30)
	const gamx25 = computeGamxM('M', BODY_MASS, 140, 25);
	console.log(`  Age 25 (normalized to 30), 140kg -> GAMX = ${gamx25.toFixed(2)}`);
	
	// Age 25 should get same GAMX as age 30 (both use age 30 params)
	if (Math.abs(gamx25 - gamx30) < 0.01) {
		console.log(`  ✓ Age 25 normalized to age 30 correctly`);
		passed++;
	} else {
		console.log(`  ✗ Age 25 should equal age 30 but differs by ${Math.abs(gamx25 - gamx30).toFixed(4)}`);
		failed++;
	}

	// Test 4: kgTarget for age 30 to match age 58's GAMX should be ~193kg (much more than 140)
	const targetTotal30 = kgTarget('M', gamx58, BODY_MASS, Variant.MASTERS, 30);
	console.log(`  Age 30 needs ${targetTotal30}kg to match age 58's GAMX of ${gamx58.toFixed(2)}`);
	
	// Critical test: must be significantly more than 140kg
	if (targetTotal30 > 180) {
		console.log(`  ✓ Age 30 needs ${targetTotal30}kg (> 180kg as expected)`);
		passed++;
	} else {
		console.log(`  ✗ Age 30 target ${targetTotal30}kg should be > 180kg`);
		failed++;
	}

	// Test 5: kgTarget for age 25 to match age 58's GAMX (should also be ~193kg)
	const targetTotal25 = kgTarget('M', gamx58, BODY_MASS, Variant.MASTERS, 25);
	console.log(`  Age 25 (normalized to 30) needs ${targetTotal25}kg to match age 58's GAMX`);
	
	// Critical assertion: 25-year-old must need MORE kg than 58-year-old (NOT less or equal!)
	// This is the test that would have caught the original bug
	if (targetTotal25 > 140) {
		console.log(`  ✓ Age 25 needs ${targetTotal25}kg (> 140kg of age 58)`);
		passed++;
	} else {
		console.log(`  ✗ CRITICAL BUG: Age 25 target ${targetTotal25}kg should be > 140kg`);
		failed++;
	}

	// Test 6: Verify the GAMX at targetTotal25 exceeds age 58's GAMX
	const gamxAtTarget25 = computeGamxM('M', BODY_MASS, targetTotal25, 25);
	const gamx58Rounded = Math.round(gamx58 * 100) / 100;
	const gamxAtTarget25Rounded = Math.round(gamxAtTarget25 * 100) / 100;
	
	if (gamxAtTarget25Rounded > gamx58Rounded) {
		console.log(`  ✓ Age 25 at ${targetTotal25}kg gives GAMX ${gamxAtTarget25.toFixed(2)} > ${gamx58.toFixed(2)}`);
		passed++;
	} else {
		console.log(`  ✗ Age 25 at ${targetTotal25}kg gives GAMX ${gamxAtTarget25.toFixed(2)} <= ${gamx58.toFixed(2)}`);
		failed++;
	}

	console.log('\n======================================');
	console.log(`MASTERS Age Normalization Results: ${passed} passed, ${failed} failed\n`);

	return { passed, failed };
}

// Run all tests
const gamxResults = runTests();
const kgTargetResults = testKgTarget();
const strictResults = testKgTargetStrictlyExceeds();
const mastersResults = testMastersAgeNormalization();

const totalPassed = gamxResults.passed + kgTargetResults.passed + strictResults.passed + mastersResults.passed;
const totalFailed = gamxResults.failed + kgTargetResults.failed + strictResults.failed + mastersResults.failed;

console.log('======================================');
console.log(`TOTAL: ${totalPassed} passed, ${totalFailed} failed`);

if (totalFailed > 0) {
	process.exit(1);
}
