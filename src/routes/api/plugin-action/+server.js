/**
 * Generic Plugin Action API Endpoint
 * 
 * Dynamically routes action requests to plugin handlers.
 * Plugins export a `handleAction({ action, options })` function in helpers.data.js
 * 
 * GET/POST: /api/plugin-action?plugin=remoteControl&action=status&...options
 */

import { json } from '@sveltejs/kit';
import { scoreboardRegistry } from '$lib/server/scoreboard-registry.js';
import { buildOptions } from '$lib/server/build-options.js';

export async function GET({ url }) {
  return handleRequest(url);
}

export async function POST({ url }) {
  return handleRequest(url);
}

async function handleRequest(url) {
  const pluginName = url.searchParams.get('plugin');
  const action = url.searchParams.get('action') || 'status';

  if (!pluginName) {
    return json({
      success: false,
      error: 'missing_plugin',
      message: 'Plugin name is required. Example: ?plugin=remoteControl&action=status'
    }, { status: 400 });
  }

  // Initialize registry if needed
  await scoreboardRegistry.initialize();

  // Get the plugin
  const scoreboard = scoreboardRegistry.getScoreboard(pluginName);
  if (!scoreboard) {
    return json({
      success: false,
      error: 'plugin_not_found',
      message: `Plugin "${pluginName}" not found`
    }, { status: 404 });
  }

  // Check if plugin has an action handler
  if (typeof scoreboard.handleAction !== 'function') {
    return json({
      success: false,
      error: 'no_action_handler',
      message: `Plugin "${pluginName}" does not support actions`
    }, { status: 400 });
  }

  // Build options: config defaults (base then extension) + URL overrides
  const options = buildOptions({
    scoreboard,
    url,
    reservedKeys: new Set(['plugin', 'action']),
    registry: scoreboardRegistry
  });

  try {
    const result = await scoreboard.handleAction({ action, options });
    
    // Handle binary responses (e.g., Excel files)
    if (result.binary === true && result.buffer && result.contentType && result.filename) {
      const buffer = Buffer.from(result.buffer, 'base64');
      return new Response(buffer, {
        headers: {
          'Content-Type': result.contentType,
          'Content-Disposition': `attachment; filename="${result.filename}"`,
          'Cache-Control': 'no-cache'
        }
      });
    }
    
    // Default JSON response
    return json(result);
  } catch (error) {
    console.error(`[Plugin Action] Error in ${pluginName}.${action}:`, error);
    return json({
      success: false,
      error: 'action_failed',
      message: error.message
    }, { status: 500 });
  }
}
