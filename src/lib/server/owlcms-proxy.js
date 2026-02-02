/**
 * OWLCMS Reverse Proxy
 * 
 * Proxies requests to OWLCMS server, enabling:
 * - Vaadin pages to be embedded in iframes
 * - Vaadin PUSH (WebSocket) to work through the proxy
 * - Stripping of iframe-blocking headers
 * 
 * Usage:
 * - Dev: attachProxyToViteServer(server)
 * - Prod: app.use('/proxy', getProxyMiddleware())
 */

import { createProxyMiddleware } from 'http-proxy-middleware';

// Default OWLCMS target - can be overridden via environment variable
const DEFAULT_OWLCMS_URL = 'http://localhost:8080';

// Current target (mutable at runtime)
let currentTarget = process.env.OWLCMS_URL || DEFAULT_OWLCMS_URL;

// Store proxy instance for WebSocket upgrade handling
let proxyInstance = null;


/**
 * Get the OWLCMS target URL from environment or default
 */
export function getOwlcmsTarget() {
  return currentTarget;
}

/**
 * Update the OWLCMS target URL at runtime
 * @param {string} target - New OWLCMS base URL (e.g., http://192.168.1.42:8080)
 */
export function setOwlcmsTarget(target) {
  if (!target) return;
  currentTarget = target;
  if (proxyInstance?.options) {
    proxyInstance.options.target = target;
  }
  console.log(`[OWLCMS Proxy] Updated target to ${target}`);
}

/**
 * Create the proxy middleware for OWLCMS
 * @param {Object} options - Configuration options
 * @param {string} options.target - OWLCMS server URL (default: from env or localhost:8080)
 * @returns {Function} Express/Connect middleware
 */
export function createOwlcmsProxyMiddleware(options = {}) {
  const defaultTarget = options.target || getOwlcmsTarget();
  
  console.log(`[OWLCMS Proxy] Creating proxy with default target ${defaultTarget}`);
  
  proxyInstance = createProxyMiddleware({
    target: defaultTarget,
    changeOrigin: true,
    ws: true,  // Enable WebSocket proxying for Vaadin PUSH
    
    // Remove /proxy prefix when forwarding to OWLCMS
    pathRewrite: {
      '^/proxy': ''
    },
    
    // Dynamically set target based on _target query parameter
    // Plugins provide their target via: /proxy/path?_target=http://server:port
    router: (req) => {
      try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        
        // Plugin provides explicit target via _target query param
        const explicitTarget = url.searchParams.get('_target');
        if (explicitTarget) {
          // Remove _target before forwarding to OWLCMS
          url.searchParams.delete('_target');
          req.url = url.pathname + url.search;
          
          // Only log page requests, not assets
          const isAsset = req.url.includes('/VAADIN/') || req.url.includes('/icons/') || 
                          req.url.includes('/local/') || req.url.includes('v-r=uidl');
          if (!isAsset) {
            console.log(`[OWLCMS Proxy] ${req.url} → ${explicitTarget}`);
          }
          return explicitTarget;
        }
        
        // Fallback to default target
        const isAsset = req.url.includes('/VAADIN/') || req.url.includes('/icons/') || 
                        req.url.includes('/local/') || req.url.includes('v-r=uidl');
        if (!isAsset) {
          console.log(`[OWLCMS Proxy] ${req.url} → ${defaultTarget} (default)`);
        }
        
        return defaultTarget;
      } catch (error) {
        console.error(`[OWLCMS Proxy] Router error:`, error);
        return defaultTarget;
      }
    },
    
    // Strip headers that prevent iframe embedding
    onProxyRes: (proxyRes, req, res) => {
      delete proxyRes.headers['x-frame-options'];
      delete proxyRes.headers['content-security-policy'];
      delete proxyRes.headers['content-security-policy-report-only'];
      proxyRes.headers['x-frame-options'] = 'ALLOWALL';
    },

    // Log errors only
    onProxyReq: (proxyReq, req, res) => {
      // Silent - logging moved to router for page requests only
    },
    
    // Log proxy errors
    onError: (err, req, res) => {
      console.error(`[OWLCMS Proxy] Error proxying ${req.url}:`, err.message);
      if (res && res.writeHead) {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end(`Proxy error: Could not connect to OWLCMS`);
      }
    }
  });
  
  return proxyInstance;
}

/**
 * Attach proxy to a Vite dev server
 * @param {Object} server - Vite server instance
 */
export function attachProxyToViteServer(server) {
  const proxyMiddleware = createOwlcmsProxyMiddleware();
  
  // Attach HTTP middleware
  server.middlewares.use('/proxy', proxyMiddleware);
  
  // Handle WebSocket upgrades for /proxy paths
  const httpServer = server.httpServer;
  if (httpServer) {
    // Add upgrade listener that only handles /proxy paths
    // Must be added BEFORE other upgrade listeners to handle first
    // Use 'prependListener' to ensure we get first shot at /proxy paths
    httpServer.prependListener('upgrade', (request, socket, head) => {
      const url = request.url || '';
      
      if (url.startsWith('/proxy')) {
        // Mark as handled so other listeners skip it
        request._proxyHandled = true;
        // Only log first attempt, not retries
        if (!url.includes('X-Atmosphere-tracking-id=0')) {
          // This is a retry - don't log
        } else {
          console.log(`[OWLCMS Proxy] WebSocket upgrade for Vaadin PUSH`);
        }
        proxyMiddleware.upgrade(request, socket, head);
      }
      // For non-proxy paths, do nothing - let other handlers process
    });
    
    console.log('[OWLCMS Proxy] WebSocket upgrade handler attached');
  }
  
  console.log('[OWLCMS Proxy] Attached to Vite dev server at /proxy');
}

/**
 * Get proxy middleware for production HTTP server
 * For use with start-with-ws.js
 */
export function getProxyMiddleware() {
  return createOwlcmsProxyMiddleware();
}

