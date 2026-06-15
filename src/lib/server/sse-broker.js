/**
 * SSE Broker - Central hub event listener and client broadcaster
 * 
 * Architecture:
 * - Listens to competitionHub events (hub_ready_broadcast, fop_update, etc.)
 * - Maintains a set of send functions for connected clients
 * - Broadcasts events to all connected clients
 */

import { competitionHub } from './competition-hub.js';
import { logger } from '@owlcms/tracker-core';

const SCOREBOARD_CLIENT_IDLE_MS = 30 * 60 * 1000;
const IDLE_REAPER_INTERVAL_MS = 60 * 1000;

class SSEBroker {
  constructor() {
    this.clients = new Set(); // Set of { send, connectionId, clientId, fopName } objects
    this.hubListenersAttached = false;
    this.reaperInterval = null;
  }

  startIdleReaper() {
    if (this.reaperInterval) return;

    this.reaperInterval = setInterval(() => this.reapIdleClients(), IDLE_REAPER_INTERVAL_MS);
    if (typeof this.reaperInterval.unref === 'function') {
      this.reaperInterval.unref();
    }
  }

  /**
   * Attach listeners to competition hub (called once on first client)
   */
  attachHubListeners() {
    if (this.hubListenersAttached) return;
    
    logger.debug('[SSE Broker] Attaching hub event listeners');

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
      logger.debug('[SSE Broker] hub_ready_broadcast received, broadcasting to', this.clients.size, 'clients');
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
   * Register an external event source (e.g., OBS controller)
   * @param {EventEmitter} emitter - EventEmitter that emits events
   * @param {string} eventName - Event name to listen for
   */
  registerExternalSource(emitter, eventName) {
    emitter.on(eventName, (eventData) => {
      this.broadcast(eventData);
    });
  }

  /**
   * Register a new SSE client connection
   * @param {Function} sendFn - Function to send data to this client
   * @param {string} connectionId - Unique connection identifier
   * @param {string|null} fopName - FOP name to filter events (null = global events only)
   * @param {string[]|null} types - Optional list of event types to receive (null = all)
   * @param {Object} options - Optional client metadata
   * @param {string|null} options.clientId - Stable browser-tab id shared with /api/scoreboard
   * @param {Function|null} options.close - Function that closes this SSE stream
   * @returns {Function} Unregister function
   */
  registerClient(sendFn, connectionId, fopName = null, types = null, options = {}) {
    // Attach hub listeners on first client
    if (!this.hubListenersAttached) {
      this.attachHubListeners();
    }
    this.startIdleReaper();
    
    const typeSet = Array.isArray(types) && types.length > 0 ? new Set(types) : null;
    const clientId = options?.clientId || null;
    const close = typeof options?.close === 'function' ? options.close : null;
    const client = {
      send: sendFn,
      connectionId,
      clientId,
      fopName,
      types: typeSet,
      lastSeen: clientId ? Date.now() : null,
      close
    };
    this.clients.add(client);
    
    const fopLabel = fopName ? `FOP ${fopName}` : 'GLOBAL';
    const clientLabel = clientId ? `clientId=${clientId}` : 'clientId=none';
    logger.info(`[SSE Broker] Client ${connectionId} CONNECTED to ${fopLabel} (${clientLabel})`);
    this.logClientDistribution('After connect');
    
    return () => {
      this.clients.delete(client);
      logger.info(`[SSE Broker] Client ${connectionId} DISCONNECTED (${clientLabel})`);
      this.logClientDistribution('After disconnect');
    };
  }

  markSeen(clientId) {
    if (!clientId) return 0;

    const now = Date.now();
    let seen = 0;
    for (const client of this.clients) {
      if (client.clientId === clientId) {
        client.lastSeen = now;
        seen++;
      }
    }
    logger.debug(`[SSE Broker] markSeen clientId=${clientId} matched=${seen}`);
    return seen;
  }

  reapIdleClients() {
    if (this.clients.size === 0) return;

    const now = Date.now();
    for (const client of Array.from(this.clients)) {
      if (!client.clientId || !client.lastSeen) continue;

      const idleMs = now - client.lastSeen;
      if (idleMs < SCOREBOARD_CLIENT_IDLE_MS) continue;

      logger.info(`[SSE Broker] Reaping idle scoreboard client ${client.connectionId} (clientId=${client.clientId}, idleMs=${idleMs})`);
      if (client.close) {
        client.close();
      } else {
        this.clients.delete(client);
      }
    }
  }

  /**
   * Broadcast message to connected clients (optimized with FOP filtering)
   * Serializes JSON once and encodes once, then sends same bytes to matching clients
   * 
   * FOP Filtering Rules:
  * - message.fop is null (global event) → send to ALL clients
  * - message.fop is set → send to exact FOP subscribers and all-FOP subscribers ('*')
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
      // - FOP-specific events go to exact FOP subscribers and all-FOP subscribers
      const isGlobalEvent = eventFop === null;
      const clientMatchesFop = client.fopName === eventFop;
      const clientWantsAllFops = client.fopName === '*';
      const clientWantsType = !client.types || client.types.has(message.type);
      
      if (clientWantsType && (isGlobalEvent || clientMatchesFop || clientWantsAllFops)) {
        try {
          client.send(encodedBytes);
          
          // Track for logging
          if (client.fopName === null) {
            globalRecipients++;
          } else {
            recipientsByFop[client.fopName] = (recipientsByFop[client.fopName] || 0) + 1;
          }
        } catch (error) {
          logger.debug(`[SSE Broker] Error sending to client ${client.connectionId}:`, error.message);
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
      
      logger.debug(`[SSE Broker] ➜ ${eventLabel}: ${totalRecipients}/${this.clients.size} clients (${recipientParts.join(', ')})`);
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
    logger.debug(parts.join(' | '));
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
} else {
  Object.setPrototypeOf(globalThis.__sseBroker, SSEBroker.prototype);
  globalThis.__sseBroker.reaperInterval ??= null;
}

export const sseBroker = globalThis.__sseBroker;
