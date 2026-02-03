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

  // Extract all other parameters as options
  const options = {};
  for (const [key, value] of url.searchParams.entries()) {
    if (key !== 'plugin' && key !== 'action') {
      // Try to parse as boolean/number
      if (value === 'true') options[key] = true;
      else if (value === 'false') options[key] = false;
      else if (!isNaN(value) && value !== '') options[key] = parseFloat(value);
      else options[key] = value;
    }
  }

  try {
    const result = await scoreboard.handleAction({ action, options });
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
