/**
 * SSE Broker - Manages active SSE client connections
 * Provides metrics to status endpoint
 */

class SSEBroker {
  constructor() {
    this.activeClients = 0;
  }

  /**
   * Register a new SSE client connection
   */
  registerClient() {
    this.activeClients++;
    return () => this.unregisterClient();
  }

  /**
   * Unregister an SSE client connection
   */
  unregisterClient() {
    if (this.activeClients > 0) {
      this.activeClients--;
    }
  }

  /**
   * Get current active client count
   */
  getActiveClientCount() {
    return this.activeClients;
  }

  /**
   * Get metrics object
   */
  getMetrics() {
    return {
      activeClients: this.activeClients
    };
  }
}

// Singleton instance
if (!globalThis.__sseBroker) {
  globalThis.__sseBroker = new SSEBroker();
}

export const sseBroker = globalThis.__sseBroker;
