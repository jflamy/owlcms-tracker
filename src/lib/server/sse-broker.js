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
    this.clients = new Set(); // Set of { send, connectionId } objects
    this.hubListenersAttached = false;
  }

  /**
   * Attach listeners to competition hub (called once on first client)
   */
  attachHubListeners() {
    if (this.hubListenersAttached) return;
    
    console.log('[SSE Broker] Attaching hub event listeners');
    
    competitionHub.on('fop_update', (eventData) => {
      this.broadcast({
        type: 'fop_update',
        fop: eventData.fop,
        data: eventData.data,
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
   * @returns {Function} Unregister function
   */
  registerClient(sendFn, connectionId) {
    // Attach hub listeners on first client
    if (!this.hubListenersAttached) {
      this.attachHubListeners();
    }
    
    const client = { send: sendFn, connectionId };
    this.clients.add(client);
    console.log(`[SSE Broker] Client ${connectionId} registered (${this.clients.size} active)`);
    
    return () => {
      this.clients.delete(client);
      console.log(`[SSE Broker] Client ${connectionId} unregistered (${this.clients.size} active)`);
    };
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(message) {
    for (const client of this.clients) {
      try {
        client.send(message);
      } catch (error) {
        console.error(`[SSE Broker] Error sending to client ${client.connectionId}:`, error.message);
        this.clients.delete(client);
      }
    }
  }

  /**
   * Get current active client count
   */
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
