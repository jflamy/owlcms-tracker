import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { 
	computeAttemptBarVisibility, 
	hasCurrentAthlete, 
	logAttemptBarDebug 
} from '../../src/lib/server/attempt-bar-visibility.js';

/**
 * Integration-style tests for attempt bar visibility logic
 * 
 * Uses real sample data from OWLCMS to verify visibility behavior:
 * - No session selected (INACTIVE) → hide attempt bar
 * - Session selected but not started → show attempt bar
 * - Session active with current athlete → show attempt bar
 * - Session done → show attempt bar (with completion message)
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '../fixtures/attempt-bar-visibility');

/**
 * Load a sample JSON file from fixtures
 * @param {string} filename - Sample filename
 * @returns {Object} Parsed JSON
 */
function loadSample(filename) {
	const filePath = join(FIXTURES_DIR, filename);
	return JSON.parse(readFileSync(filePath, 'utf-8'));
}

/**
 * Helper to log test context for validation
 */
function logTestContext(label, fopUpdate, sessionStatus = null) {
	const fopState = fopUpdate?.fopState || 'undefined';
	const currentAthleteKey = fopUpdate?.currentAthleteKey ?? 'null';
	const fullName = fopUpdate?.fullName || 'null';
	const sessionName = fopUpdate?.sessionName || 'null';
	
	console.log(`\n  📋 ${label}:`);
	console.log(`     fopState: ${fopState}`);
	console.log(`     currentAthleteKey: ${currentAthleteKey}`);
	console.log(`     fullName: ${fullName}`);
	console.log(`     sessionName: ${sessionName}`);
	if (sessionStatus) {
		console.log(`     sessionStatus.isDone: ${sessionStatus.isDone}`);
	}
	
	const cssClass = computeAttemptBarVisibility(fopUpdate);
	const hasCurrent = sessionStatus ? hasCurrentAthlete(fopUpdate, sessionStatus) : 'N/A';
	
	console.log(`     → attemptBarClass: "${cssClass || '(empty=visible)'}" | hasCurrentAthlete: ${hasCurrent}`);
	
	return { cssClass, hasCurrent };
}

describe('Attempt Bar Visibility - Unit Tests', () => {
	describe('computeAttemptBarVisibility()', () => {
		it('returns hide class when fopState is INACTIVE and no currentAthleteKey', () => {
			const fopUpdate = {
				fopState: 'INACTIVE',
				currentAthleteKey: null
			};
			
			expect(computeAttemptBarVisibility(fopUpdate)).toBe('hide-because-null-session');
		});

		it('returns empty string (visible) when fopState is INACTIVE but currentAthleteKey present', () => {
			// Edge case: transitioning state
			const fopUpdate = {
				fopState: 'INACTIVE',
				currentAthleteKey: '12345'
			};
			
			expect(computeAttemptBarVisibility(fopUpdate)).toBe('');
		});

		it('returns empty string (visible) when fopState is CURRENT_ATHLETE_DISPLAYED', () => {
			const fopUpdate = {
				fopState: 'CURRENT_ATHLETE_DISPLAYED',
				currentAthleteKey: '12345',
				fullName: 'DOE, John'
			};
			
			expect(computeAttemptBarVisibility(fopUpdate)).toBe('');
		});

		it('returns empty string (visible) when fopState is BREAK (between sessions)', () => {
			const fopUpdate = {
				fopState: 'BREAK',
				currentAthleteKey: null
			};
			
			expect(computeAttemptBarVisibility(fopUpdate)).toBe('');
		});

		it('returns hide class when fopUpdate is undefined', () => {
			expect(computeAttemptBarVisibility(undefined)).toBe('hide-because-null-session');
		});

		it('returns hide class when fopUpdate is null', () => {
			expect(computeAttemptBarVisibility(null)).toBe('hide-because-null-session');
		});
	});

	describe('hasCurrentAthlete()', () => {
		it('returns true when fullName present, not INACTIVE, session not done', () => {
			const fopUpdate = {
				fopState: 'CURRENT_ATHLETE_DISPLAYED',
				fullName: 'DOE, John'
			};
			const sessionStatus = { isDone: false };
			
			expect(hasCurrentAthlete(fopUpdate, sessionStatus)).toBe(true);
		});

		it('returns false when fopState is INACTIVE', () => {
			const fopUpdate = {
				fopState: 'INACTIVE',
				fullName: 'DOE, John'
			};
			const sessionStatus = { isDone: false };
			
			expect(hasCurrentAthlete(fopUpdate, sessionStatus)).toBe(false);
		});

		it('returns false when session is done', () => {
			const fopUpdate = {
				fopState: 'CURRENT_ATHLETE_DISPLAYED',
				fullName: 'DOE, John'
			};
			const sessionStatus = { isDone: true };
			
			expect(hasCurrentAthlete(fopUpdate, sessionStatus)).toBe(false);
		});

		it('returns false when fullName is empty', () => {
			const fopUpdate = {
				fopState: 'CURRENT_ATHLETE_DISPLAYED',
				fullName: ''
			};
			const sessionStatus = { isDone: false };
			
			expect(hasCurrentAthlete(fopUpdate, sessionStatus)).toBe(false);
		});

		it('returns false when fopUpdate is undefined', () => {
			expect(hasCurrentAthlete(undefined, { isDone: false })).toBe(false);
		});
	});
});

describe('Attempt Bar Visibility - Integration Tests with Samples', () => {
	let databaseSample;
	let switchGroupInactiveSample;
	let startLiftingSample;
	let liftingOrderActiveSample;

	beforeEach(() => {
		// Load all required samples
		databaseSample = loadSample('2025-12-18T13-52-13-909-DATABASE.json');
		switchGroupInactiveSample = loadSample('2025-12-18T13-58-21-398-UPDATE-SWITCHGROUP.json');
		startLiftingSample = loadSample('2025-12-18T14-05-16-652-UPDATE-STARTLIFTING.json');
		liftingOrderActiveSample = loadSample('2025-12-18T14-05-16-672-UPDATE-LIFTINGORDERUPDATED.json');
	});

	describe('Scenario 1: No session selected (initial state after database load)', () => {
		it('EXPECT: attempt bar HIDDEN when fopState=INACTIVE and no currentAthleteKey', () => {
			// Simulate initial state: database loaded but no session selected yet
			const fopUpdate = {
				fopState: 'INACTIVE',
				currentAthleteKey: null,
				fullName: null,
				sessionName: null
			};
			
			const { cssClass } = logTestContext('Initial state - no session', fopUpdate);
			
			console.log(`     ✓ CONCLUSION: Attempt bar should be HIDDEN (no session selected)`);
			expect(cssClass).toBe('hide-because-null-session');
		});

		it('EXPECT: hasCurrentAthlete=false when INACTIVE', () => {
			const fopUpdate = {
				fopState: 'INACTIVE',
				currentAthleteKey: null,
				fullName: null
			};
			const sessionStatus = { isDone: false };
			
			const { hasCurrent } = logTestContext('No session - checking hasCurrentAthlete', fopUpdate, sessionStatus);
			
			console.log(`     ✓ CONCLUSION: No current athlete (no session active)`);
			expect(hasCurrent).toBe(false);
		});
	});

	describe('Scenario 2: Session selected via SwitchGroup (fopState=INACTIVE but currentAthleteKey set)', () => {
		it('VERIFY: SwitchGroup sample has expected fields', () => {
			console.log('\n  📋 SwitchGroup sample inspection:');
			console.log(`     uiEvent: ${switchGroupInactiveSample.uiEvent}`);
			console.log(`     fopState: ${switchGroupInactiveSample.fopState}`);
			console.log(`     currentAthleteKey: ${switchGroupInactiveSample.currentAthleteKey}`);
			console.log(`     fullName: ${switchGroupInactiveSample.fullName}`);
			console.log(`     sessionName: ${switchGroupInactiveSample.sessionName}`);
			
			expect(switchGroupInactiveSample.fopState).toBe('INACTIVE');
			expect(switchGroupInactiveSample.fullName).toBe('KJELLEVAND, Jørgen');
			expect(switchGroupInactiveSample.sessionName).toBe('P4.3');
		});

		it('EXPECT: attempt bar VISIBLE when SwitchGroup has currentAthleteKey (even if INACTIVE)', () => {
			// SwitchGroup message: session selected, OWLCMS has identified the first lifter
			// fopState=INACTIVE but currentAthleteKey is present → show attempt bar
			// This allows displaying "next up" information before lifting starts
			
			const { cssClass } = logTestContext('SwitchGroup with currentAthleteKey', switchGroupInactiveSample);
			
			console.log(`     ✓ CONCLUSION: Attempt bar VISIBLE (currentAthleteKey=${switchGroupInactiveSample.currentAthleteKey} overrides INACTIVE)`);
			expect(cssClass).toBe('');
		});

		it('EXPECT: hasCurrentAthlete=false during SwitchGroup (not actively lifting yet)', () => {
			const sessionStatus = { isDone: false };
			
			const { hasCurrent } = logTestContext('SwitchGroup - checking hasCurrentAthlete', switchGroupInactiveSample, sessionStatus);
			
			console.log(`     ✓ CONCLUSION: hasCurrentAthlete=false (INACTIVE means not actively lifting, just "next up")`);
			expect(hasCurrent).toBe(false);
		});
	});

	describe('Scenario 3: Lifting started via StartLifting (fopState=CURRENT_ATHLETE_DISPLAYED)', () => {
		it('VERIFY: StartLifting sample has expected fields', () => {
			console.log('\n  📋 StartLifting sample inspection:');
			console.log(`     uiEvent: ${startLiftingSample.uiEvent}`);
			console.log(`     fopState: ${startLiftingSample.fopState}`);
			console.log(`     currentAthleteKey: ${startLiftingSample.currentAthleteKey}`);
			console.log(`     fullName: ${startLiftingSample.fullName}`);
			console.log(`     athleteTimerEventType: ${startLiftingSample.athleteTimerEventType}`);
			console.log(`     athleteMillisRemaining: ${startLiftingSample.athleteMillisRemaining}`);
			
			expect(startLiftingSample.fopState).toBe('CURRENT_ATHLETE_DISPLAYED');
			expect(startLiftingSample.uiEvent).toBe('StartLifting');
		});

		it('EXPECT: attempt bar VISIBLE when session is active (CURRENT_ATHLETE_DISPLAYED)', () => {
			const { cssClass } = logTestContext('StartLifting - active session', startLiftingSample);
			
			console.log(`     ✓ CONCLUSION: Attempt bar VISIBLE (active session with current athlete)`);
			expect(cssClass).toBe('');
		});

		it('EXPECT: hasCurrentAthlete=true during active lifting', () => {
			const sessionStatus = { isDone: false };
			
			const { hasCurrent } = logTestContext('StartLifting - checking hasCurrentAthlete', startLiftingSample, sessionStatus);
			
			console.log(`     ✓ CONCLUSION: hasCurrentAthlete=true (athlete is actively lifting)`);
			expect(hasCurrent).toBe(true);
		});

		it('VERIFY: timer is set after StartLifting', () => {
			console.log('\n  📋 Timer state after StartLifting:');
			console.log(`     athleteTimerEventType: ${startLiftingSample.athleteTimerEventType}`);
			console.log(`     athleteMillisRemaining: ${startLiftingSample.athleteMillisRemaining}ms`);
			console.log(`     timeAllowed: ${startLiftingSample.timeAllowed}ms`);
			
			expect(startLiftingSample.athleteTimerEventType).toBe('SetTime');
			expect(startLiftingSample.athleteMillisRemaining).toBe(60000);
		});
	});

	describe('Scenario 4: Switch back to no session (clear selection)', () => {
		it('EXPECT: attempt bar HIDDEN when switching from active to INACTIVE with no currentAthleteKey', () => {
			// Simulate: was active, now INACTIVE with cleared currentAthleteKey
			const afterClear = {
				fopState: 'INACTIVE',
				currentAthleteKey: null,
				fullName: null,
				sessionName: null
			};
			
			const { cssClass } = logTestContext('After clearing session', afterClear);
			
			console.log(`     ✓ CONCLUSION: Attempt bar HIDDEN (session cleared, back to initial state)`);
			expect(cssClass).toBe('hide-because-null-session');
		});

		it('EXPECT: hasCurrentAthlete=false after clearing session', () => {
			const afterClear = {
				fopState: 'INACTIVE',
				fullName: null
			};
			const sessionStatus = { isDone: false };
			
			const { hasCurrent } = logTestContext('After clearing - checking hasCurrentAthlete', afterClear, sessionStatus);
			
			console.log(`     ✓ CONCLUSION: hasCurrentAthlete=false (no session active)`);
			expect(hasCurrent).toBe(false);
		});
	});

	describe('Scenario 5: Session done (GROUP_DONE break)', () => {
		it('EXPECT: attempt bar VISIBLE when session done (fopState=BREAK, not INACTIVE)', () => {
			// When session completes, fopState changes to BREAK with breakType=GROUP_DONE
			const sessionDone = {
				fopState: 'BREAK',
				breakType: 'GROUP_DONE',
				currentAthleteKey: null,
				fullName: 'Session Complete',
				sessionName: 'P4.3'
			};
			
			const { cssClass } = logTestContext('Session done (GROUP_DONE)', sessionDone);
			
			console.log(`     ✓ CONCLUSION: Attempt bar VISIBLE (BREAK is not INACTIVE, can show completion message)`);
			expect(cssClass).toBe('');
		});

		it('EXPECT: hasCurrentAthlete=false when session is done', () => {
			const sessionDone = {
				fopState: 'BREAK',
				breakType: 'GROUP_DONE',
				fullName: 'Session Complete'
			};
			const sessionStatus = { isDone: true };
			
			const { hasCurrent } = logTestContext('Session done - checking hasCurrentAthlete', sessionDone, sessionStatus);
			
			console.log(`     ✓ CONCLUSION: hasCurrentAthlete=false (session is done, no one lifting)`);
			expect(hasCurrent).toBe(false);
		});
	});

	describe('Scenario 6: Ongoing lifting (LiftingOrderUpdated during session)', () => {
		it('VERIFY: LiftingOrderUpdated sample has active state', () => {
			console.log('\n  📋 LiftingOrderUpdated sample inspection:');
			console.log(`     uiEvent: ${liftingOrderActiveSample.uiEvent}`);
			console.log(`     fopState: ${liftingOrderActiveSample.fopState}`);
			console.log(`     currentAthleteKey: ${liftingOrderActiveSample.currentAthleteKey}`);
			console.log(`     fullName: ${liftingOrderActiveSample.fullName}`);
			
			expect(liftingOrderActiveSample.fopState).toBe('CURRENT_ATHLETE_DISPLAYED');
			expect(liftingOrderActiveSample.uiEvent).toBe('LiftingOrderUpdated');
		});

		it('EXPECT: attempt bar VISIBLE during ongoing lifting order updates', () => {
			const { cssClass } = logTestContext('LiftingOrderUpdated - ongoing session', liftingOrderActiveSample);
			
			console.log(`     ✓ CONCLUSION: Attempt bar VISIBLE (session active, athletes lifting)`);
			expect(cssClass).toBe('');
		});

		it('EXPECT: hasCurrentAthlete=true during lifting order updates', () => {
			const sessionStatus = { isDone: false };
			
			const { hasCurrent } = logTestContext('LiftingOrderUpdated - checking hasCurrentAthlete', liftingOrderActiveSample, sessionStatus);
			
			console.log(`     ✓ CONCLUSION: hasCurrentAthlete=true (athlete is currently on platform)`);
			expect(hasCurrent).toBe(true);
		});
	});
});

describe('Attempt Bar Visibility - Edge Cases', () => {
	describe('State transitions', () => {
		it('handles rapid state changes correctly', () => {
			const states = [
				{ fopState: 'INACTIVE', currentAthleteKey: null },  // Hidden
				{ fopState: 'CURRENT_ATHLETE_DISPLAYED', currentAthleteKey: '123' },  // Visible
				{ fopState: 'BREAK', currentAthleteKey: null },  // Visible (break, not inactive)
				{ fopState: 'INACTIVE', currentAthleteKey: null },  // Hidden
			];
			
			const expected = [
				'hide-because-null-session',
				'',
				'',
				'hide-because-null-session'
			];
			
			states.forEach((state, i) => {
				expect(computeAttemptBarVisibility(state)).toBe(expected[i]);
			});
		});
	});

	describe('Malformed data handling', () => {
		it('handles empty object', () => {
			expect(computeAttemptBarVisibility({})).toBe('hide-because-null-session');
		});

		it('handles missing fopState with only currentAthleteKey', () => {
			const fopUpdate = { currentAthleteKey: '123' };
			// fopState defaults to INACTIVE, but currentAthleteKey present → visible
			expect(computeAttemptBarVisibility(fopUpdate)).toBe('');
		});

		it('handles fopState with unexpected value', () => {
			const fopUpdate = { fopState: 'UNKNOWN_STATE', currentAthleteKey: null };
			// Not INACTIVE, so should be visible
			expect(computeAttemptBarVisibility(fopUpdate)).toBe('');
		});
	});
});
