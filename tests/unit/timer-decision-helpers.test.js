import { describe, it, expect } from 'vitest';
import { extractTimers, extractDecisionState, computeDisplayMode } from '../../src/lib/server/timer-decision-helpers.js';

describe('Timer and Decision Helpers', () => {
	describe('extractTimers - SESSION_DONE break', () => {
		it('hides both athlete and break timers during SESSION_DONE', () => {
			const fopUpdate = {
				mode: 'SESSION_DONE',
				fopState: 'BREAK',
				breakType: 'GROUP_DONE',
				athleteTimerEventType: 'SetTime',
				athleteMillisRemaining: 60000,
				breakTimerEventType: 'BreakSetTime',
				breakMillisRemaining: null,
				timeAllowed: 60000,
				breakTimeAllowed: 600000
			};

			const { timer, breakTimer } = extractTimers(fopUpdate, 'en');

			expect(timer.visible).toBe(false);
			expect(breakTimer.visible).toBe(false);
		});

		it('hides athlete timer during regular break (not SESSION_DONE)', () => {
			const fopUpdate = {
				mode: 'CURRENT_ATHLETE',
				fopState: 'BREAK',
				athleteTimerEventType: 'SetTime',
				athleteMillisRemaining: 60000,
				breakTimerEventType: 'BreakStartTime',
				breakMillisRemaining: 300000,
				timeAllowed: 60000,
				breakTimeAllowed: 300000,
				breakStartTimeMillis: Date.now()
			};

			const { timer, breakTimer } = extractTimers(fopUpdate, 'en');

			expect(timer.visible).toBe(false);
			expect(breakTimer.visible).toBe(true);
		});

		it('shows athlete timer when not in break', () => {
			const fopUpdate = {
				mode: 'CURRENT_ATHLETE',
				fopState: 'CURRENT_ATHLETE',
				athleteTimerEventType: 'StartTime',
				athleteMillisRemaining: 60000,
				breakTimerEventType: null,
				timeAllowed: 60000
			};

			const { timer } = extractTimers(fopUpdate, 'en');

			expect(timer.visible).toBe(true);
			expect(timer.state).toBe('running');
		});

		it('detects INTERRUPTION mode and sets displayText to STOP', () => {
			const fopUpdate = {
				mode: 'INTERRUPTION',
				fopState: 'BREAK',
				breakTimerEventType: 'BreakSetTime',
				breakMillisRemaining: 0,
				indefiniteBreak: true
			};

			const { breakTimer } = extractTimers(fopUpdate, 'en');

			expect(breakTimer.displayText).toBe('STOP');
			expect(breakTimer.visible).toBe(true); // INTERRUPTION mode shows break timer with STOP text
		});

		it('detects INTERRUPTION mode with Norwegian language', () => {
			const fopUpdate = {
				mode: 'INTERRUPTION',
				fopState: 'BREAK',
				breakTimerEventType: 'BreakSetTime'
			};

			const { breakTimer } = extractTimers(fopUpdate, 'no');

			expect(breakTimer.displayText).toBe('STOPP');
		});
	});

	describe('extractDecisionState - SESSION_DONE break', () => {
		it('hides decision lights during SESSION_DONE', () => {
			const fopUpdate = {
				mode: 'SESSION_DONE',
				athleteTimerEventType: 'SetTime',
				decisionsVisible: 'true',
				decisionEventType: 'FULL_DECISION',
				d1: 'true',
				d2: 'true',
				d3: 'false'
			};

			const decision = extractDecisionState(fopUpdate);

			expect(decision.visible).toBe(false);
		});

		it('hides decision lights when athlete timer starts', () => {
			const fopUpdate = {
				mode: 'CURRENT_ATHLETE',
				athleteTimerEventType: 'StartTime',
				decisionEventType: 'FULL_DECISION',
				d1: 'true'
			};

			const decision = extractDecisionState(fopUpdate);

			expect(decision.visible).toBe(false);
		});

		it('shows decision lights during normal attempt', () => {
			const fopUpdate = {
				mode: 'CURRENT_ATHLETE',
				athleteTimerEventType: 'SetTime',
				decisionEventType: 'FULL_DECISION',
				d1: 'true',
				d2: 'false',
				d3: 'true'
			};

			const decision = extractDecisionState(fopUpdate);

			expect(decision.visible).toBe(true);
			expect(decision.ref1).toBe('good');
			expect(decision.ref2).toBe('bad');
			expect(decision.ref3).toBe('good');
		});
	});

	describe('computeDisplayMode - SESSION_DONE break', () => {
		it('displays nothing (none) during SESSION_DONE', () => {
			const timer = { visible: false, isActive: true };
			const breakTimer = { visible: false, isActive: true };
			const decision = { visible: false };

			const { displayMode } = computeDisplayMode(timer, breakTimer, decision);

			expect(displayMode).toBe('none');
		});

		it('prioritizes decision over break timer', () => {
			const timer = { visible: true, isActive: true };
			const breakTimer = { visible: true, isActive: true };
			const decision = { visible: true };

			const { displayMode } = computeDisplayMode(timer, breakTimer, decision);

			expect(displayMode).toBe('decision');
		});

		it('prioritizes break timer over athlete timer', () => {
			const timer = { visible: true, isActive: true };
			const breakTimer = { visible: true, isActive: true };
			const decision = { visible: false };

			const { displayMode } = computeDisplayMode(timer, breakTimer, decision);

			expect(displayMode).toBe('break');
		});

		it('shows athlete timer when decision and break not visible', () => {
			const timer = { visible: true, isActive: true };
			const breakTimer = { visible: false };
			const decision = { visible: false };

			const { displayMode } = computeDisplayMode(timer, breakTimer, decision);

			expect(displayMode).toBe('athlete');
		});
	});
});
