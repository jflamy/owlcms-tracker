/**
 * QPoints Coefficient Lookup Table (2025)
 * Based on Dr. Marianne Huebner's regression coefficients
 * QPoints = Total * Coefficient(bodyweight, gender) * AgeCoefficient
 */

export const QPOINTS_COEFFICIENTS = {
	men: {
		tmax: 492,
		beta0: 492.43,
		beta1: 15.827,
		beta2: 0.0514
	},
	women: {
		tmax: 359,
		beta0: 359.31,
		beta1: 11.54,
		beta2: 0.0375
	}
};

/**
 * QPoints Age Coefficients for men (30-95)
 */
export const QPOINTS_AGE_MEN = {
	30: 1.000, 31: 1.016, 32: 1.031, 33: 1.046, 34: 1.059,
	35: 1.072, 36: 1.083, 37: 1.096, 38: 1.109, 39: 1.122,
	40: 1.135, 41: 1.149, 42: 1.162, 43: 1.176, 44: 1.189,
	45: 1.203, 46: 1.218, 47: 1.233, 48: 1.248, 49: 1.263,
	50: 1.279, 51: 1.297, 52: 1.316, 53: 1.338, 54: 1.361,
	55: 1.385, 56: 1.411, 57: 1.437, 58: 1.462, 59: 1.488,
	60: 1.514, 61: 1.541, 62: 1.568, 63: 1.598, 64: 1.629,
	65: 1.663, 66: 1.699, 67: 1.738, 68: 1.779, 69: 1.823,
	70: 1.867, 71: 1.910, 72: 1.953, 73: 2.004, 74: 2.060,
	75: 2.117, 76: 2.181, 77: 2.255, 78: 2.336, 79: 2.419,
	80: 2.504, 81: 2.597, 82: 2.702, 83: 2.831, 84: 2.981,
	85: 3.153, 86: 3.352, 87: 3.580, 88: 3.843, 89: 4.145,
	90: 4.493, 91: 4.885, 92: 5.328, 93: 5.831, 94: 6.402,
	95: 7.052
};

/**
 * QPoints Age Coefficients for women (30-90)
 */
export const QPOINTS_AGE_WOMEN = {
	30: 1.000, 31: 1.016, 32: 1.031, 33: 1.046, 34: 1.059,
	35: 1.072, 36: 1.084, 37: 1.097, 38: 1.110, 39: 1.124,
	40: 1.138, 41: 1.153, 42: 1.170, 43: 1.187, 44: 1.205,
	45: 1.223, 46: 1.244, 47: 1.265, 48: 1.288, 49: 1.313,
	50: 1.340, 51: 1.369, 52: 1.401, 53: 1.435, 54: 1.470,
	55: 1.507, 56: 1.545, 57: 1.585, 58: 1.625, 59: 1.665,
	60: 1.705, 61: 1.744, 62: 1.778, 63: 1.808, 64: 1.839,
	65: 1.873, 66: 1.909, 67: 1.948, 68: 1.989, 69: 2.033,
	70: 2.077, 71: 2.120, 72: 2.163, 73: 2.214, 74: 2.270,
	75: 2.327, 76: 2.391, 77: 2.465, 78: 2.546, 79: 2.629,
	80: 2.714, 81: 2.804, 82: 2.899, 83: 3.000, 84: 3.107,
	85: 3.221, 86: 3.342, 87: 3.471, 88: 3.608, 89: 3.754,
	90: 3.910
};

/**
 * Calculate QPoints factor for an athlete
 * 
 * @param {number} bodyWeight - Athlete's bodyweight in kg
 * @param {string} gender - 'M' for male, 'F' for female
 * @param {number} age - Athlete's age (optional)
 * @returns {number} QPoints factor (multiplier)
 */
export function getQPointsFactor(bodyWeight, gender, age = 0) {
	if (!bodyWeight || bodyWeight <= 0) return 0;

	let factor = 0;
	if (gender === 'M') {
		factor = qPointsFactor(bodyWeight, QPOINTS_COEFFICIENTS.men);
	} else if (gender === 'F') {
		factor = qPointsFactor(bodyWeight, QPOINTS_COEFFICIENTS.women);
	} else {
		return 0;
	}

	// Apply age coefficient if applicable
	if (age >= 30) {
		const ageCoeff = getAgeGenderCoefficient(age, gender);
		factor *= ageCoeff;
	}

	return factor;
}

/**
 * Internal calculation of QPoints factor
 * qPointsFactor = (tMax / (beta0 - beta1 * Math.pow((bw / 100.0), -2) + beta2 * Math.pow((bw / 100.0), 2)))
 * 
 * @param {number} bw - Bodyweight
 * @param {Object} coeffs - Regression coefficients
 * @returns {number} QPoints factor
 */
function qPointsFactor(bw, coeffs) {
	const bw100 = bw / 100.0;
	const denominator = coeffs.beta0 - coeffs.beta1 * Math.pow(bw100, -2) + coeffs.beta2 * Math.pow(bw100, 2);
	return coeffs.tmax / denominator;
}

/**
 * Get age coefficient for QPoints
 * 
 * @param {number} age - Athlete's age
 * @param {string} gender - 'M' or 'F'
 * @returns {number} Age coefficient
 */
function getAgeGenderCoefficient(age, gender) {
	if (age < 30) return 1.0;
	
	const table = gender === 'M' ? QPOINTS_AGE_MEN : QPOINTS_AGE_WOMEN;
	const maxAge = gender === 'M' ? 95 : 90;
	
	if (age > maxAge) return table[maxAge];
	return table[age] || 1.0;
}

/**
 * Calculate QPoints for an athlete
 * 
 * @param {number} total - Athlete's total in kg
 * @param {number} bodyWeight - Athlete's bodyweight in kg
 * @param {string} gender - 'M' for male, 'F' for female
 * @param {number} age - Athlete's age (optional)
 * @returns {number} Calculated QPoints
 */
export function CalculateQPoints(total, bodyWeight, gender, age = 0) {
	const factor = getQPointsFactor(bodyWeight, gender, age);
	return total * factor;
}
