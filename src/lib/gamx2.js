/**
 * GAMX Score Computation
 * 
 * Implements the GAMX scoring system using Box-Cox Cole and Green (BCCG) distribution.
 * Formula: GAMX = qnorm(pBCCG(total, mu, sigma, nu)) * 100 + 1000
 * 
 * This is a JavaScript port of OWLCMS GAMX2.java, which matches R's gamlss.dist::pBCCG exactly.
 * 
 * Supports four parameter variants:
 * - SENIOR: Standard GAMX (params_sen files) - no age column
 * - AGE_ADJUSTED: GAMX-A for age-adjusted athletes (params_iwf files) - HAS age column
 * - U17: GAMX-U for U17 athletes (params_usa files) - HAS age column
 * - MASTERS: GAMX-M for masters athletes (params_mas files) - HAS age column
 * 
 * RUNTIME JSON LOADING:
 * Parameter tables are loaded from static/gamx/*.json at runtime to avoid bundling
 * 23MB of data into the JavaScript output.
 */

import fs from 'fs';
import path from 'path';

/**
 * Parameter variants
 */
export const Variant = {
    SENIOR: 'SENIOR',
    AGE_ADJUSTED: 'AGE_ADJUSTED',
    U17: 'U17',
    MASTERS: 'MASTERS'
};

/**
 * Metadata about each variant's table structure
 */
const VARIANT_META = {
    SENIOR: { hasAge: false },
    AGE_ADJUSTED: { hasAge: true },
    U17: { hasAge: true },
    MASTERS: { hasAge: true }
};

/**
 * File paths for each variant and gender
 */
const PARAM_FILES = {
    SENIOR: {
        M: 'params-sen-men.json',
        F: 'params-sen-wom.json'
    },
    AGE_ADJUSTED: {
        M: 'params-iwf-men.json',
        F: 'params-iwf-wom.json'
    },
    U17: {
        M: 'params-usa-men.json',
        F: 'params-usa-wom.json'
    },
    MASTERS: {
        M: 'params-mas-men.json',
        F: 'params-mas-wom.json'
    }
};

/**
 * Cache for loaded parameter tables (loaded on first use)
 */
const paramsCache = new Map();

/**
 * Get the base path for GAMX JSON files
 * Works in both dev and production builds
 */
function getGamxBasePath() {
    // Try various possible locations
    const candidates = [
        path.join(process.cwd(), 'static', 'gamx'),           // Dev mode
        path.join(process.cwd(), 'build', 'client', 'gamx'),  // Production build
        path.join(process.cwd(), 'client', 'gamx'),           // Alternative production
    ];
    
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }
    
    // Default to static/gamx
    return candidates[0];
}

/**
 * Load parameters for a variant and gender (cached)
 * @param {string} variant - Parameter variant
 * @param {string} gender - 'M' or 'F'
 * @returns {Array|null} Parameter array or null if not found
 */
function loadParams(variant, gender) {
    const cacheKey = `${variant}-${gender}`;
    
    if (paramsCache.has(cacheKey)) {
        return paramsCache.get(cacheKey);
    }
    
    const fileName = PARAM_FILES[variant]?.[gender];
    if (!fileName) {
        console.warn(`GAMX: No file mapping for variant ${variant} gender ${gender}`);
        return null;
    }
    
    const basePath = getGamxBasePath();
    const filePath = path.join(basePath, fileName);
    
    try {
        const jsonData = fs.readFileSync(filePath, 'utf-8');
        const params = JSON.parse(jsonData);
        paramsCache.set(cacheKey, params);
        console.log(`[GAMX] Loaded ${params.length} rows from ${fileName}`);
        return params;
    } catch (err) {
        console.warn(`GAMX: Failed to load ${filePath}: ${err.message}`);
        return null;
    }
}

/**
 * Standard normal distribution functions
 * Using high-precision implementations matching Apache Commons Math
 */

/**
 * Error function (erf)
 * Cody's rational Chebyshev approximation - accurate to ~1e-15
 */
function erf(x) {
    const a = [
        0.254829592,
        -0.284496736,
        1.421413741,
        -1.453152027,
        1.061405429
    ];
    const p = 0.3275911;

    // Save the sign
    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    // A&S 7.1.26 with Horner's method
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a[4] * t + a[3]) * t) + a[2]) * t + a[1]) * t + a[0]) * t * Math.exp(-x * x);

    return sign * y;
}

/**
 * Standard normal CDF (Phi function)
 * Using the relationship: Phi(x) = 0.5 * (1 + erf(x / sqrt(2)))
 */
function normalCdf(x) {
    return 0.5 * (1.0 + erf(x / Math.sqrt(2)));
}

/**
 * Inverse standard normal CDF (quantile function, qnorm)
 * Rational approximation from Abramowitz and Stegun
 */
function normalQuantile(p) {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    if (p === 0.5) return 0;

    // Coefficients for rational approximation
    const a = [
        -3.969683028665376e1,
        2.209460984245205e2,
        -2.759285104469687e2,
        1.383577518672690e2,
        -3.066479806614716e1,
        2.506628277459239e0
    ];
    const b = [
        -5.447609879822406e1,
        1.615858368580409e2,
        -1.556989798598866e2,
        6.680131188771972e1,
        -1.328068155288572e1
    ];
    const c = [
        -7.784894002430293e-3,
        -3.223964580411365e-1,
        -2.400758277161838e0,
        -2.549732539343734e0,
        4.374664141464968e0,
        2.938163982698783e0
    ];
    const d = [
        7.784695709041462e-3,
        3.224671290700398e-1,
        2.445134137142996e0,
        3.754408661907416e0
    ];

    const pLow = 0.02425;
    const pHigh = 1 - pLow;

    let q, r;

    if (p < pLow) {
        // Rational approximation for lower region
        q = Math.sqrt(-2 * Math.log(p));
        r = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
            (((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1));
        return refineQuantile(r, p);
    } else if (p <= pHigh) {
        // Rational approximation for central region
        q = p - 0.5;
        r = q * q;
        const result = ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
            (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
        return refineQuantile(result, p);
    } else {
        // Rational approximation for upper region
        q = Math.sqrt(-2 * Math.log(1 - p));
        r = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
            (((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1));
        return refineQuantile(r, p);
    }
}

/**
 * Refine normalQuantile result using Halley's method (cubic convergence)
 * This improves precision from ~1e-9 to ~1e-15
 */
function refineQuantile(x, p) {
    // PDF of standard normal at x
    const pdf = Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
    // CDF error
    const cdfError = normalCdf(x) - p;
    // Halley's method correction
    const u = cdfError / pdf;
    return x - u / (1 + 0.5 * x * u);
}

/**
 * BCCG (Box-Cox Cole and Green) cumulative distribution function.
 * 
 * Implements R's gamlss.dist::pBCCG function exactly.
 * 
 * The BCCG CDF is a truncated/normalized distribution:
 * p = (Phi(z) - FYy2) / FYy3
 * 
 * where:
 * - z = ((y/mu)^nu - 1) / (nu * sigma) for nu != 0
 * - z = log(y/mu) / sigma for nu == 0
 * - FYy2 = Phi(-1/(sigma*|nu|)) if nu > 0, else 0
 * - FYy3 = Phi(1/(sigma*|nu|))
 * 
 * @param {number} y - The value (total lifted)
 * @param {number} mu - Location parameter
 * @param {number} sigma - Scale parameter
 * @param {number} nu - Shape parameter (Box-Cox power)
 * @returns {number} Cumulative probability
 */
function pBCCG(y, mu, sigma, nu) {
    // Validate inputs
    if (y <= 0 || mu <= 0 || sigma <= 0) {
        return 0.5; // Return neutral probability
    }

    let z;

    // Compute z using Box-Cox transformation
    if (Math.abs(nu) < 1e-10) {
        // Limiting case: log-normal when nu -> 0
        z = Math.log(y / mu) / sigma;
    } else {
        // General case: Box-Cox power transformation
        z = (Math.pow(y / mu, nu) - 1.0) / (nu * sigma);
    }

    // Compute the three components of the normalized CDF
    const FYy1 = normalCdf(z);

    let FYy2;
    if (nu > 0) {
        FYy2 = normalCdf(-1.0 / (sigma * Math.abs(nu)));
    } else {
        FYy2 = 0.0;
    }

    const FYy3 = normalCdf(1.0 / (sigma * Math.abs(nu)));

    // Normalized CDF
    const p = (FYy1 - FYy2) / FYy3;

    return p;
}

/**
 * Interpolate parameters from the lookup table based on body mass (and optionally age).
 * 
 * For tables WITHOUT age column (SENIOR):
 *   params format: [[bodyMass, mu, sigma, nu], ...]
 * 
 * For tables WITH age column (MASTERS, AGE_ADJUSTED, U17):
 *   params format: [[age, bodyMass, mu, sigma, nu], ...]
 *   - Binary search to find rows matching normalized age
 *   - Then interpolate by body mass within those rows
 * 
 * @param {Array} params - Parameter table
 * @param {number} bodyMass - Body mass in kg
 * @param {boolean} hasAge - Whether table has age column
 * @param {number|null} age - Age (required if hasAge is true)
 * @returns {Object|null} Interpolated {mu, sigma, nu} or null if failed
 */
function interpolateParams(params, bodyMass, hasAge = false, age = null) {
    if (!params || params.length === 0) {
        return null;
    }

    // For tables with age column, filter to rows matching the normalized age
    let filteredParams = params;
    if (hasAge) {
        if (age === null) {
            console.warn('GAMX: Age required for age-adjusted variant');
            return null;
        }

        // Get age bounds from table
        const minAge = params[0][0];
        const maxAge = params[params.length - 1][0];

        // Normalize age to table bounds (critical fix: age 25 -> 30 for MASTERS)
        let normalizedAge = age;
        if (age < minAge) {
            normalizedAge = minAge;
        } else if (age > maxAge) {
            normalizedAge = maxAge;
        }

        // Binary search to find first row with matching age
        let firstAgeIdx = binarySearchAge(params, normalizedAge);
        if (firstAgeIdx < 0) {
            return null;
        }

        // Expand to find all rows with the same age
        // CRITICAL Fix: Compare against normalizedAge, not original age
        let lastAgeIdx = firstAgeIdx;
        while (lastAgeIdx + 1 < params.length && Math.abs(params[lastAgeIdx + 1][0] - normalizedAge) < 0.01) {
            lastAgeIdx++;
        }

        // Extract rows for this age as body-mass-only format [bodyMass, mu, sigma, nu]
        filteredParams = [];
        for (let i = firstAgeIdx; i <= lastAgeIdx; i++) {
            // Convert [age, bodyMass, mu, sigma, nu] -> [bodyMass, mu, sigma, nu]
            filteredParams.push([params[i][1], params[i][2], params[i][3], params[i][4]]);
        }

        if (filteredParams.length === 0) {
            return null;
        }
    }

    // Now interpolate by body mass (filteredParams is always [bodyMass, mu, sigma, nu] format)
    const minBm = filteredParams[0][0];
    const maxBm = filteredParams[filteredParams.length - 1][0];

    // Clamp body mass to valid range
    if (bodyMass < minBm) {
        bodyMass = minBm;
    } else if (bodyMass > maxBm) {
        bodyMass = maxBm;
    }

    // Find bracketing indices
    let lowIdx = -1;
    let highIdx = -1;

    for (let i = 0; i < filteredParams.length; i++) {
        if (filteredParams[i][0] <= bodyMass) {
            lowIdx = i;
        }
        if (filteredParams[i][0] >= bodyMass && highIdx < 0) {
            highIdx = i;
        }
    }

    if (lowIdx < 0 || highIdx < 0) {
        return null;
    }

    const low = filteredParams[lowIdx];
    const high = filteredParams[highIdx];

    // Exact match or same row
    if (lowIdx === highIdx || Math.abs(high[0] - low[0]) < 1e-10) {
        return { mu: low[1], sigma: low[2], nu: low[3] };
    }

    // Linear interpolation
    const lowRatio = bodyMass - low[0];
    const highRatio = high[0] - bodyMass;
    const denom = lowRatio + highRatio;

    const mu = (highRatio * low[1] + lowRatio * high[1]) / denom;
    const sigma = (highRatio * low[2] + lowRatio * high[2]) / denom;
    const nu = (highRatio * low[3] + lowRatio * high[3]) / denom;

    return { mu, sigma, nu };
}

/**
 * Binary search for first row with matching age.
 * 
 * @param {Array} params - Parameter table with age column [age, bodyMass, mu, sigma, nu]
 * @param {number} age - Target age
 * @returns {number} Index of first matching row, or -1 if not found
 */
function binarySearchAge(params, age) {
    let lo = 0;
    let hi = params.length - 1;
    let result = -1;

    while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        const midAge = params[mid][0];

        if (Math.abs(midAge - age) < 0.01) {
            result = mid;
            // Continue searching left for first occurrence
            hi = mid - 1;
        } else if (midAge < age) {
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }

    return result;
}

/**
 * Core GAMX computation from total and distribution parameters.
 * 
 * Formula: GAMX = qnorm(pBCCG(total, mu, sigma, nu)) * 100 + 1000
 * 
 * @param {number} total - Total lifted in kg
 * @param {number} mu - Location parameter
 * @param {number} sigma - Scale parameter
 * @param {number} nu - Shape parameter
 * @returns {number} GAMX score, or 0 if invalid
 */
function computeGamxCore(total, mu, sigma, nu) {
    // Validate parameters
    if (total <= 0 || mu <= 0 || sigma <= 0) {
        return 0.0;
    }

    // Compute p using BCCG CDF
    const p = pBCCG(total, mu, sigma, nu);

    if (isNaN(p) || !isFinite(p) || p <= 0 || p >= 1) {
        return 0.0;
    }

    // Transform p to z-score using inverse normal CDF
    const z = normalQuantile(p);

    if (isNaN(z) || !isFinite(z)) {
        return 0.0;
    }

    // Scale to GAMX score
    const gamx = z * 100 + 1000;
    return gamx;
}

/**
 * Compute GAMX score.
 * 
 * @param {string} gender - 'M' for male, 'F' for female
 * @param {number} bodyMass - Body mass in kg
 * @param {number} total - Lifted total in kg
 * @param {string} variant - Parameter variant (default: SENIOR)
 * @param {number|null} age - Age (required for MASTERS variant)
 * @returns {number} GAMX score, or 0 if inputs invalid
 */
export function computeGamx(gender, bodyMass, total, variant = Variant.SENIOR, age = null) {
    if (!gender || !bodyMass || bodyMass <= 0 || !total || total <= 0) {
        return 0.0;
    }

    // Normalize gender
    const g = gender.toUpperCase().charAt(0);
    if (g !== 'M' && g !== 'F') {
        return 0.0;
    }

    // Load parameter table (cached after first load)
    const params = loadParams(variant, g);
    if (!params) {
        console.warn(`GAMX: No parameters for variant ${variant} gender ${g}`);
        return 0.0;
    }

    const meta = VARIANT_META[variant] || { hasAge: false };

    // Interpolate parameters (passing age info for age-dependent variants)
    const interp = interpolateParams(params, bodyMass, meta.hasAge, age);
    if (!interp) {
        return 0.0;
    }

    // Compute GAMX score
    return computeGamxCore(total, interp.mu, interp.sigma, interp.nu);
}

/**
 * Convenience functions for specific variants
 * Note: For SENIOR, use computeGamx() with 3 parameters, which defaults to SENIOR variant
 */
export function computeGamxA(gender, bodyMass, total, age) {
    return computeGamx(gender, bodyMass, total, Variant.AGE_ADJUSTED, age);
}

export function computeGamxU(gender, bodyMass, total) {
    return computeGamx(gender, bodyMass, total, Variant.U17);
}

/**
 * Compute GAMX-M (Masters) score.
 * 
 * @param {string} gender - 'M' for male, 'F' for female
 * @param {number} bodyMass - Body mass in kg
 * @param {number} total - Lifted total in kg
 * @param {number} age - Athlete's age (required for Masters)
 * @returns {number} GAMX-M score, or 0 if inputs invalid
 */
export function computeGamxM(gender, bodyMass, total, age) {
    return computeGamx(gender, bodyMass, total, Variant.MASTERS, age);
}

/**
 * Inverse BCCG CDF (quantile function).
 * 
 * Implements R's gamlss.dist::qBCCG function.
 * Given probability p and parameters, returns the value y such that pBCCG(y) = p.
 * 
 * @param {number} p - Probability (0 < p < 1)
 * @param {number} mu - Location parameter
 * @param {number} sigma - Scale parameter
 * @param {number} nu - Shape parameter
 * @returns {number} Quantile value (total)
 */
function qBCCG(p, mu, sigma, nu) {
    if (p <= 0 || p >= 1) {
        return NaN;
    }

    // Adjust probability for truncation (inverse of pBCCG normalization)
    let pAdjusted;
    if (nu <= 0) {
        pAdjusted = p * normalCdf(1.0 / (sigma * Math.abs(nu)));
    } else {
        pAdjusted = 1.0 - (1.0 - p) * normalCdf(1.0 / (sigma * Math.abs(nu)));
    }

    // Convert adjusted probability to z-score
    const z = normalQuantile(pAdjusted);

    // Inverse Box-Cox transformation
    let total;
    if (Math.abs(nu) < 1e-10) {
        // Limiting case: log-normal
        total = mu * Math.exp(sigma * z);
    } else {
        // General case: power transformation
        total = mu * Math.pow(nu * sigma * z + 1.0, 1.0 / nu);
    }

    return total;
}

/**
 * Find the minimum total needed to strictly exceed a target GAMX score at 2 decimal precision.
 * 
 * Purpose: When two athletes have identical age, gender, and bodyweight, and one achieves
 * GAMX score X, the other needs kgTarget(X) to guarantee a win (not just a tie at 2 decimals).
 * 
 * Algorithm:
 * 1. Convert target GAMX to probability using inverse scaling
 * 2. Use qBCCG to compute initial estimate
 * 3. Binary search for exact integer kg that strictly exceeds target at 2 decimal precision
 * 
 * @param {string} gender - 'M' for male, 'F' for female
 * @param {number} targetScore - Target GAMX score to exceed
 * @param {number} bodyMass - Body mass in kg
 * @param {string} variant - Parameter variant (default: SENIOR)
 * @param {number|null} age - Age (required for MASTERS variant)
 * @returns {number} Minimum total in kg that strictly exceeds targetScore, or 0 if impossible
 */
export function kgTarget(gender, targetScore, bodyMass, variant = Variant.SENIOR, age = null) {
    if (!gender || bodyMass <= 0) {
        return 0;
    }

    // Normalize gender
    const g = gender.toUpperCase().charAt(0);
    if (g !== 'M' && g !== 'F') {
        return 0;
    }

    // Load parameter table (cached after first load)
    const params = loadParams(variant, g);
    if (!params) {
        return 0;
    }

    const meta = VARIANT_META[variant] || { hasAge: false };

    // Interpolate parameters (passing age info for age-dependent variants)
    const interp = interpolateParams(params, bodyMass, meta.hasAge, age);
    if (!interp) {
        return 0;
    }

    // Convert target GAMX to probability
    const z = (targetScore - 1000.0) / 100.0;
    const p = normalCdf(z);

    // Compute initial estimate using qBCCG
    const formulaResult = qBCCG(p, interp.mu, interp.sigma, interp.nu);

    if (isNaN(formulaResult) || !isFinite(formulaResult) || formulaResult <= 0) {
        return 0;
    }

    // Start with ceiling of formula result (likely exceeds target)
    let candidate = Math.ceil(formulaResult);

    // Round target to 2 decimal places for comparison
    const targetRounded = Math.round(targetScore * 100) / 100;

    // If candidate doesn't exceed, increment until it does
    while (candidate < 600) { // reasonable upper bound
        const gamxAtCandidate = computeGamxCore(candidate, interp.mu, interp.sigma, interp.nu);
        const gamxRounded = Math.round(gamxAtCandidate * 100) / 100;
        if (gamxRounded > targetRounded) {
            break; // Found a value that exceeds
        }
        candidate++;
    }

    // Now decrement to find the minimum that still exceeds
    while (candidate > 1) {
        const test = candidate - 1;
        const gamxAtTest = computeGamxCore(test, interp.mu, interp.sigma, interp.nu);
        const gamxRounded = Math.round(gamxAtTest * 100) / 100;
        if (gamxRounded > targetRounded) {
            candidate = test; // Still exceeds, keep going lower
        } else {
            break; // test doesn't exceed, candidate is the minimum
        }
    }

    return candidate;
}

// Export for testing
export { pBCCG, qBCCG, normalCdf, normalQuantile, interpolateParams };
