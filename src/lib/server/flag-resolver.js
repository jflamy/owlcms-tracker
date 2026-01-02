/**
 * Flag Resolver Shim - Re-exports tracker-core utils with backward compatibility
 * 
 * This file adapts the tracker-core API to maintain backward compatibility with
 * existing owlcms-tracker code that uses positional string arguments.
 */

import { 
  getFlagUrl as coreGetFlagUrl,
  getFlagHtml as coreGetFlagHtml,
  getFlagPath as coreGetFlagPath
} from '@owlcms/tracker-core/utils';

/**
 * Get flag URL for team/country name
 * Backward compatible wrapper that accepts positional arguments
 * @param {string} teamName - Team or country name
 * @param {boolean} returnNull - If true, return null when not found; if false, return placeholder
 * @returns {string|null} URL to flag image or null/placeholder
 */
export function getFlagUrl(teamName, returnNull = false) {
  // Call tracker-core's getFlagUrl with object parameter
  const url = coreGetFlagUrl({ teamName });
  
  if (url) {
    return url;
  }
  
  // No flag found
  if (returnNull) {
    return null;
  }
  
  // Return placeholder (1x1 transparent PNG)
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
}

/**
 * Get flag path by team name
 * @param {string} teamName - Team or country name
 * @returns {string|null} Path to flag or null
 */
export function resolveFlagPath(teamName) {
  return coreGetFlagPath({ teamName });
}

/**
 * Get flag HTML element
 * @param {string} teamName - Team or country name
 * @param {string} altText - Alternative text
 * @param {string} className - CSS class
 * @returns {string} HTML or empty string
 */
export function getFlagHtml(teamName, altText = '', className = 'flag') {
  return coreGetFlagHtml({ teamName, className });
}
