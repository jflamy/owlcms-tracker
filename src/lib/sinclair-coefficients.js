/**
 * Sinclair Coefficient Lookup Table
 * Based on sinclair2024.properties from OWLCMS
 * Reference: https://www.iwfmasters.org/uploads/1/2/9/7/129797858/iwf_master_age_factors_2019.pdf
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
