/**
 * SSE Broker - Central hub event listener and client broadcaster
 * 
 * Architecture:
 * - Listens to competitionHub events (hub_ready_broadcast, fop_update, etc.)
 * - Maintains a set of send functions for connected clients
 * - Broadcasts events to all connected clients
 */

import { competitionHub } from './competition-hub.js';

class SSEBroker {
  constructor() {
    this.clients = new Set(); // Set of { send, connectionId, fopName } objects
    this.hubListenersAttached = false;
  }

  /**
   * Attach listeners to competition hub (called once on first client)
   */
  attachHubListeners() {
    if (this.hubListenersAttached) return;
    
    console.log('[SSE Broker] Attaching hub event listeners');

    competitionHub.on('protocol_error', (eventData) => {
      this.broadcast({
        type: 'protocol_error',
        reason: eventData?.reason || 'Protocol error',
        received: eventData?.received || null,
        minimum: eventData?.minimum || null,
        source: eventData?.source || null,
        timestamp: eventData?.timestamp || Date.now()
      });
    });

    competitionHub.on('protocol_ok', (eventData) => {
      this.broadcast({
        type: 'protocol_ok',
        timestamp: eventData?.timestamp || Date.now()
      });
    });
    
    competitionHub.on('fop_update', (eventData) => {
      this.broadcast({
        type: 'fop_update',
        fop: eventData.fop,
        data: eventData.data,
        timestamp: eventData.timestamp
      });
    });

    competitionHub.on('timer', (eventData) => {
      this.broadcast({
        type: 'timer',
        fop: eventData.fop,
        timer: eventData.timer,
        displayMode: eventData.displayMode,
        timestamp: eventData.timestamp
      });
    });

    competitionHub.on('decision', (eventData) => {
      this.broadcast({
        type: 'decision',
        fop: eventData.fop,
        decision: eventData.decision,
        displayMode: eventData.displayMode,
        timestamp: eventData.timestamp
      });
    });

    competitionHub.on('competition_initialized', (eventData) => {
      this.broadcast({
        type: 'competition_initialized',
        payload: eventData.payload,
        timestamp: eventData.timestamp
      });
    });

    competitionHub.on('hub_ready_broadcast', (eventData) => {
      console.log('[SSE Broker] hub_ready_broadcast received, broadcasting to', this.clients.size, 'clients');
      this.broadcast({
        type: 'hub_ready',
        message: eventData.message,
        timestamp: eventData.timestamp
      });
    });

    competitionHub.on('waiting', (eventData) => {
      this.broadcast({
        type: 'waiting',
        message: eventData.message,
        timestamp: eventData.timestamp
      });
    });

    this.hubListenersAttached = true;
  }

  /**
   * Register a new SSE client connection
   * @param {Function} sendFn - Function to send data to this client
   * @param {string} connectionId - Unique connection identifier
   * @param {string|null} fopName - FOP name to filter events (null = global events only)
   * @param {string[]|null} types - Optional list of event types to receive (null = all)
   * @returns {Function} Unregister function
   */
  registerClient(sendFn, connectionId, fopName = null, types = null) {
    // Attach hub listeners on first client
    if (!this.hubListenersAttached) {
      this.attachHubListeners();
    }
    
    const typeSet = Array.isArray(types) && types.length > 0 ? new Set(types) : null;
    const client = { send: sendFn, connectionId, fopName, types: typeSet };
    this.clients.add(client);
    
    const fopLabel = fopName ? `FOP ${fopName}` : 'GLOBAL';
    console.log(`[SSE Broker] ✓ Client ${connectionId} CONNECTED to ${fopLabel}`);
    this.logClientDistribution('After connect');
    
    return () => {
      this.clients.delete(client);
      console.log(`[SSE Broker] ✗ Client ${connectionId} DISCONNECTED`);
      this.logClientDistribution('After disconnect');
    };
  }

  /**
   * Broadcast message to connected clients (optimized with FOP filtering)
   * Serializes JSON once and encodes once, then sends same bytes to matching clients
   * 
   * FOP Filtering Rules:
   * - message.fop is null (global event) → send to ALL clients
   * - message.fop is set → send only to clients where client.fopName === message.fop
   * - client.fopName is null → only receives global events (message.fop is null)
   */
  broadcast(message) {
    if (this.clients.size === 0) return;

    const eventFop = message.fop || null;  // null = global event

    // Serialize JSON once for all clients
    let jsonString;
    try {
      jsonString = JSON.stringify(message);
    } catch (error) {
      console.error('[SSE Broker] Failed to serialize message:', error.message);
      return;
    }

    // Format SSE message once
    const sseMessage = `data: ${jsonString}\n\n`;

    // Encode to bytes once
    const encoder = new TextEncoder();
    const encodedBytes = encoder.encode(sseMessage);

    // Track recipients per FOP for logging
    const recipientsByFop = {};
    let globalRecipients = 0;

    // Send to matching clients only
    for (const client of this.clients) {
      // FOP filtering:
      // - Global events (eventFop === null) go to everyone
      // - FOP-specific events go only to clients subscribed to that FOP
      const isGlobalEvent = eventFop === null;
      const clientMatchesFop = client.fopName === eventFop;
      const clientWantsType = !client.types || client.types.has(message.type);
      
      if (clientWantsType && (isGlobalEvent || clientMatchesFop)) {
        try {
          client.send(encodedBytes);
          
          // Track for logging
          if (client.fopName === null) {
            globalRecipients++;
          } else {
            recipientsByFop[client.fopName] = (recipientsByFop[client.fopName] || 0) + 1;
          }
        } catch (error) {
          console.error(`[SSE Broker] Error sending to client ${client.connectionId}:`, error.message);
          this.clients.delete(client);
        }
      }
    }

    // Log detailed delivery stats
    const totalRecipients = Object.values(recipientsByFop).reduce((a, b) => a + b, 0) + globalRecipients;
    if (totalRecipients > 0) {
      const eventLabel = `${message.type}${eventFop ? ` [FOP ${eventFop}]` : ' [GLOBAL]'}`;
      const recipientParts = [];
      
      if (globalRecipients > 0) {
        recipientParts.push(`GLOBAL=${globalRecipients}`);
      }
      
      const fopParts = Object.entries(recipientsByFop).sort(([a], [b]) => a.localeCompare(b));
      for (const [fop, count] of fopParts) {
        recipientParts.push(`${fop}=${count}`);
      }
      
      console.log(`[SSE Broker] ➜ ${eventLabel}: ${totalRecipients}/${this.clients.size} clients (${recipientParts.join(', ')})`);
    }
  }

  /**
   * Get detailed FOP distribution stats
   * @returns {Object} Stats with fopCounts, globalCount, totalClients
   */
  getClientStats() {
    const fopCounts = {};
    let globalCount = 0;

    for (const client of this.clients) {
      if (client.fopName === null) {
        globalCount++;
      } else {
        fopCounts[client.fopName] = (fopCounts[client.fopName] || 0) + 1;
      }
    }

    return {
      totalClients: this.clients.size,
      globalClients: globalCount,
      fopClients: fopCounts,
      fops: Object.keys(fopCounts).sort(),
      fopClientSummary: Object.entries(fopCounts).map(([fop, count]) => `${fop}:${count}`).join(', ')
    };
  }

  /**
   * Log current client distribution
   */
  logClientDistribution(context = 'Current') {
    const stats = this.getClientStats();
    const parts = [`[SSE Broker] ${context} client distribution:`, `Total=${stats.totalClients}`, `Global=${stats.globalClients}`];
    if (stats.fopClientSummary) {
      parts.push(`FOPs=[${stats.fopClientSummary}]`);
    }
    console.log(parts.join(' | '));
  }
  getActiveClientCount() {
    return this.clients.size;
  }

  /**
   * Get metrics object
   */
  getMetrics() {
    return {
      activeClients: this.clients.size
    };
  }
}

// Singleton instance
if (!globalThis.__sseBroker) {
  globalThis.__sseBroker = new SSEBroker();
}

export const sseBroker = globalThis.__sseBroker;
