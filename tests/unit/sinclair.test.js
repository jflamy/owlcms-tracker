import { describe, it, expect } from 'vitest';
import { CalculateSinclair2024 } from '../../src/lib/sinclair-coefficients.js';

/**
 * Reference calculations use the official 2024 Sinclair formula:
 * score = total * 10^(A * (log10(bodyWeight / maxWeight))^2)
 * where A/maxWeight are gender-specific (see sinclair-coefficients.js).
 */
describe('CalculateSinclair2024', () => {
	it('matches published 2024 figures for representative male lifter', () => {
		const score = CalculateSinclair2024(274, 82.29, 'M');
		expect(score).toBeCloseTo(344.780578, 6);
	});

	it('matches published 2024 figures for representative female lifter', () => {
		const score = CalculateSinclair2024(158, 58.7, 'F');
		expect(score).toBeCloseTo(216.917776, 6);
	});

	it('handles heavy lifters by capping factor at 1.0', () => {
		const score = CalculateSinclair2024(350, 210, 'M');
		expect(score).toBe(350);
	});

	it('returns zero when inputs are missing or invalid', () => {
		expect(CalculateSinclair2024(0, 82.29, 'M')).toBe(0);
		expect(CalculateSinclair2024(200, 0, 'M')).toBe(0);
		expect(CalculateSinclair2024(200, 70, 'X')).toBe(0);
	});
});
