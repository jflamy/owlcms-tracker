/**
 * Format Detector - Detects OWLCMS database format version
 * 
 * Supports:
 * - V1 format: Legacy format with ID references
 * - V2 format: New format with name/code references (formatVersion: "2.0")
 */

/**
 * Detect which format version a database payload uses
 * @param {Object} params - Database payload from OWLCMS
 * @returns {string} Format version: 'v1' or 'v2'
 */
export function detectFormat(params) {
  // V2 format has explicit formatVersion field
  if (params.formatVersion === '2.0' || params.formatVersion === 2.0) {
    return 'v2';
  }
  
  // V1 format detection (legacy):
  // - No formatVersion field
  // - May have groupAthletes as string or object
  // - May have athletes array with numeric IDs
  return 'v1';
}

/**
 * Check if payload is V2 format
 * @param {Object} params - Database payload
 * @returns {boolean} True if V2 format
 */
export function isV2Format(params) {
  return detectFormat(params) === 'v2';
}

/**
 * Check if payload is V1 format
 * @param {Object} params - Database payload
 * @returns {boolean} True if V1 format
 */
export function isV1Format(params) {
  return detectFormat(params) === 'v1';
}
