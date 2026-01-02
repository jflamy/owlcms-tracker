/**
 * Binary WebSocket frame handler shim
 * 
 * Re-exports tracker-core's binary handler with hub injection.
 * This maintains backward compatibility with existing imports that don't pass the hub.
 */

import { handleBinaryMessage as coreHandleBinaryMessage, competitionHub } from '@owlcms/tracker-core';

/**
 * Parse and route binary message from OWLCMS
 * Wraps tracker-core's handler and injects the hub automatically
 * @param {Buffer} buffer - Binary frame data
 */
export async function handleBinaryMessage(buffer) {
return coreHandleBinaryMessage(buffer, competitionHub);
}
