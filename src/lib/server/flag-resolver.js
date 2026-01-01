/**
 * Flag Resolver Shim - Re-exports tracker-core utils
 * 
 * This file is a shim to maintain backward compatibility with existing imports.
 * The actual implementation lives in @owlcms/tracker-core/utils.
 */

export { resolveFlagPath, getFlagUrl, getFlagHtml } from '@owlcms/tracker-core/utils';
