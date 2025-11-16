/**
 * Sinclair Coefficient Lookup Table
 * Based on IWF 2024 coefficients (updated April 2024)
 * These are the current official coefficients used for international competition
 */

export const SINCLAIR_COEFFICIENTS = {
	men: {
		coefficient: 0.722762521,
		maxWeight: 193.609
	},
	women: {
		coefficient: 0.787004341,
		maxWeight: 153.757
	}
};

/**
 * Sinclair Coefficient Lookup Table - 2020 version
 * Used specifically for SMHF (Sinclair Masters) calculations
 * Based on sinclair2020.properties from OWLCMS (2017-2020 coefficients)
 */
export const SINCLAIR_COEFFICIENTS_2020 = {
	men: {
		coefficient: 0.751945030,
		maxWeight: 175.508
	},
	women: {
		coefficient: 0.783497476,
		maxWeight: 153.655
	}
};

/**
 * Sinclair Meltzer-Faber (SMF) for men
 * Age-based multipliers from IWF Masters 2019
 */
export const SMF = {
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
	90: 4.493
};

/**
 * Sinclair Meltzer-Huebner-Faber (SMHF) for women
 * Age-based multipliers from IWF Masters 2019
 */
export const SMHF = {
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
	80: 2.714
};

/**
 * Calculate Sinclair factor for an athlete
 * Sinclair = coefficient * (total / (2 * coefficient * maxWeight))^exponent
 * Where exponent = 2 for Olympic lifting
 *
 * @param {number} bodyWeight - Athlete's bodyweight in kg
 * @param {string} gender - 'M' for male, 'F' for female
 * @returns {number} Sinclair factor (multiplier)
 */
export function getSinclairFactor(bodyWeight, gender) {
	if (!bodyWeight || bodyWeight <= 0) return 0;

	if (gender === 'M') {
		return sinclairFactor(bodyWeight, SINCLAIR_COEFFICIENTS.men.coefficient, SINCLAIR_COEFFICIENTS.men.maxWeight);
	} else if (gender === 'F') {
		return sinclairFactor(bodyWeight, SINCLAIR_COEFFICIENTS.women.coefficient, SINCLAIR_COEFFICIENTS.women.maxWeight);
	} else {
		return 0;
	}
}

/**
 * Internal calculation of Sinclair factor
 * sinclairFactor = coefficient * Math.pow(maxWeight / bodyWeight, 2 * coefficient)
 *
 * @param {number} bodyWeight - Athlete's actual bodyweight
 * @param {number} coefficient - Gender-specific coefficient
 * @param {number} maxWeight - Maximum bodyweight for the category
 * @returns {number} Sinclair factor
 */
function sinclairFactor(bodyWeight, coefficient, maxWeight) {
	if (bodyWeight > maxWeight) {
		// For heavier athletes, factor = 1
		return 1.0;
	}

	// Factor = coefficient * (maxWeight / bodyWeight) ^ (2 * coefficient)
	const exponent = 2 * coefficient;
	const factor = coefficient * Math.pow(maxWeight / bodyWeight, exponent);

	return factor;
}

/**
 * Calculate Sinclair score from total and athlete data
 *
 * @param {number} total - Snatch + Clean & Jerk total
 * @param {number} bodyWeight - Athlete's bodyweight in kg
 * @param {string} gender - 'M' or 'F'
 * @returns {number} Sinclair score
 */
export function calculateSinclairScore(total, bodyWeight, gender) {
	if (!total || total <= 0) return 0;

	const factor = getSinclairFactor(bodyWeight, gender);
	return total * factor;
}

/**
 * Calculate predicted Sinclair score using predicted total
 *
 * @param {number} predictedTotal - Predicted snatch + C&J total
 * @param {number} bodyWeight - Athlete's bodyweight in kg
 * @param {string} gender - 'M' or 'F'
 * @returns {number} Predicted Sinclair score
 */
export function calculatePredictedSinclair(predictedTotal, bodyWeight, gender) {
	return calculateSinclairScore(predictedTotal, bodyWeight, gender);
}

/**
 * Get Masters age factor for an athlete
 *
 * @param {number} age - Athlete's age in years
 * @param {string} gender - 'M' or 'F'
 * @returns {number} Age factor multiplier (1.0 or higher)
 */
export function getMastersAgeFactor(age, gender) {
	if (!age || age < 30) return 1.0;

	const table = gender === 'M' ? SMF : SMHF;
	const maxAge = gender === 'M' ? 90 : 80;
	
	// Cap age at table maximum
	const lookupAge = Math.min(age, maxAge);
	
	return table[lookupAge] || 1.0;
}

/**
 * Calculate Sinclair Masters (age-adjusted) score
 * Uses 2020 Sinclair coefficients for SMHF calculations
 *
 * @param {number} total - Snatch + Clean & Jerk total
 * @param {number} bodyWeight - Athlete's bodyweight in kg
 * @param {string} gender - 'M' or 'F'
 * @param {number} age - Athlete's age in years
 * @returns {number} Age-adjusted Sinclair score
 */
export function calculateSinclairMasters(total, bodyWeight, gender, age) {
	if (!total || total <= 0) return 0;
	if (!bodyWeight || bodyWeight <= 0) return 0;

	// Use 2020 coefficients for SMHF calculations
	const coeffs = gender === 'M' ? SINCLAIR_COEFFICIENTS_2020.men : SINCLAIR_COEFFICIENTS_2020.women;
	const sinclairFactor2020 = sinclairFactor(bodyWeight, coeffs.coefficient, coeffs.maxWeight);
	const sinclairScore = total * sinclairFactor2020;
	
	const ageFactor = getMastersAgeFactor(age, gender);
	
	return sinclairScore * ageFactor;
}
