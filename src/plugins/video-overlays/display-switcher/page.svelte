<script>
	/**
	 * Display Switcher - Combined Display and Control Page
	 * 
	 * Mode: display (default)
	 *   - Fullscreen output, purely SSE-reactive
	 *   - Switches between iframe (OWLCMS pages) and video elements
	 * 
	 * Mode: control
	 *   - Operator UI with pause/resume, manual control, configuration
	 * 
	 * URL: /display-switcher?fop=A&mode=display  (or mode=control)
	 */
	
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import config from './config.js';
	
	export let data;
	
	// Get default values from config
	const defaults = {};
	config.options.forEach(opt => {
		defaults[opt.key] = opt.default;
	});
	
	// === SHARED STATE ===
	let eventSource = null;
	$: fopName = $page.url.searchParams.get('fop') || data.fopName || 'A';
	$: mode = $page.url.searchParams.get('mode') || 'display';
	
	// === DISPLAY MODE STATE ===
	let displayType = 'iframe';
	let displayUrl = '';
	let displayState = 'scoreboard';
	let videoElement = null;
	
	// === CONTROL MODE STATE ===
	let automationState = 'unknown'; // auto, paused
	let currentState = 'scoreboard';
	let isConnected = false;
	let statusMessage = '';
	
	// Control form values - initialize from config defaults
	let manualIframeUrl = defaults.scoreboardPage;
	let manualVideoUrl = defaults.goodLiftVideo || '';
	let configScoreboardPage = defaults.scoreboardPage;
	let configReplayUrl = defaults.replayUrl;
	let configGoodLiftVideo = defaults.goodLiftVideo;
	let configBadLiftVideo = defaults.badLiftVideo;
	let configGoodLiftDuration = defaults.goodLiftDuration;
	let configBadLiftDuration = defaults.badLiftDuration;
	let configReplayDuration = defaults.replayDuration;
	
	// Set initial values from server data
	$: if (data?.currentUrl) {
		displayUrl = data.currentUrl;
		displayType = data.currentType || 'iframe';
	}
	
	// === DISPLAY MODE FUNCTIONS ===
	
	function handleDisplayCommand(command) {
		console.log('[Display] Received command:', command);
		
		if (command.fop && command.fop !== fopName) return;
		
		if (command.command === 'showIframe') {
			displayType = 'iframe';
			displayUrl = command.url;
			displayState = command.state || 'unknown';
		} else if (command.command === 'showVideo') {
			displayType = 'video';
			displayUrl = command.url;
			displayState = command.state || 'unknown';
		}
		
		// Also update control mode state
		currentState = displayState;
	}
	
	function handleVideoEnded() {
		console.log('[Display] Video ended');
	}
	
	// === CONTROL MODE FUNCTIONS ===
	
	function handleStateUpdate(stateData) {
		if (stateData.fop && stateData.fop !== fopName) return;
		
		automationState = stateData.automationPaused ? 'paused' : 'auto';
		currentState = stateData.currentState || 'unknown';
		isConnected = true;
	}
	
	async function sendAction(action, payload = {}) {
		try {
			const response = await fetch('/api/scoreboard', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action,
					fop: fopName,
					...payload
				})
			});
			const result = await response.json();
			if (!result.success) {
				statusMessage = `Error: ${result.error}`;
			} else {
				statusMessage = `${action} executed successfully`;
			}
			setTimeout(() => statusMessage = '', 3000);
			return result;
		} catch (err) {
			statusMessage = `Error: ${err.message}`;
			setTimeout(() => statusMessage = '', 3000);
		}
	}
	
	async function pauseAutomation() {
		await sendAction('display_pause');
	}
	
	async function resumeAutomation() {
		await sendAction('display_resume');
	}
	
	async function showIframe() {
		// Add /proxy prefix if not already present
		const url = manualIframeUrl.startsWith('/proxy') ? manualIframeUrl : `/proxy/${manualIframeUrl.replace(/^\//, '')}`;
		await sendAction('display_show_iframe', { url });
	}
	
	async function showVideo() {
		await sendAction('display_show_video', { url: manualVideoUrl });
	}
	
	async function updateConfig() {
		await sendAction('display_config', {
			scoreboardPage: configScoreboardPage,
			replayUrl: configReplayUrl,
			goodLiftVideo: configGoodLiftVideo,
			badLiftVideo: configBadLiftVideo,
			goodLiftDuration: configGoodLiftDuration,
			badLiftDuration: configBadLiftDuration,
			replayDuration: configReplayDuration
		});
	}
	
	async function refreshState() {
		const result = await sendAction('display_state');
		if (result?.success && result.state) {
			handleStateUpdate(result.state);
		}
	}
	
	// === SSE CONNECTION ===
	
	function connectSSE() {
		if (!browser) return;
		
		const sseUrl = `/api/client-stream?fop=${encodeURIComponent(fopName)}&mode=${encodeURIComponent(mode)}`;
		console.log('[Display] Connecting to SSE:', sseUrl);
		
		eventSource = new EventSource(sseUrl);
		
		eventSource.onmessage = (event) => {
			try {
				const eventData = JSON.parse(event.data);
				
				if (eventData.type === 'display_command') {
					handleDisplayCommand(eventData);
				}
				if (eventData.type === 'display_state') {
					handleStateUpdate(eventData);
				}
			} catch (err) {
				console.error('[Display] Error parsing SSE:', err);
			}
		};
		
		eventSource.onopen = () => {
			isConnected = true;
		};
		
		eventSource.onerror = (err) => {
			console.error('[Display] SSE error:', err);
			isConnected = false;
			setTimeout(() => {
				if (eventSource) {
					eventSource.close();
					connectSSE();
				}
			}, 3000);
		};
	}
	
	onMount(() => {
		if (data?.initialUrl) {
			displayUrl = data.initialUrl;
			displayType = 'iframe';
		}
		
		connectSSE();
		
		// In control mode, fetch initial state
		if (mode === 'control') {
			refreshState();
		}
	});
	
	onDestroy(() => {
		if (eventSource) {
			eventSource.close();
			eventSource = null;
		}
	});
</script>

<svelte:head>
	<title>{mode === 'control' ? 'Control' : 'Display'} - {fopName}</title>
	{#if mode === 'display'}
	<style>
		body {
			margin: 0;
			padding: 0;
			overflow: hidden;
			background: #000;
		}
	</style>
	{/if}
</svelte:head>

{#if mode === 'control'}
<!-- ========== CONTROL MODE UI ========== -->
<div class="control-container">
	<header>
		<h1>Display Switcher Control</h1>
		<div class="status-bar">
			<span class="fop-badge">FOP: {fopName}</span>
			<span class="connection-status" class:connected={isConnected}>
				{isConnected ? '● Connected' : '○ Disconnected'}
			</span>
			<span class="automation-badge" class:paused={automationState === 'paused'}>
				{automationState === 'paused' ? '⏸ Paused' : '▶ Auto'}
			</span>
			<span class="state-badge">{currentState}</span>
		</div>
		{#if statusMessage}
			<div class="status-message">{statusMessage}</div>
		{/if}
	</header>
	
	<main>
		<!-- Automation Control -->
		<section class="control-section">
			<h2>Automation Control</h2>
			<div class="button-row">
				<button 
					class="btn btn-pause" 
					on:click={pauseAutomation}
					disabled={automationState === 'paused'}
				>
					⏸ Pause Automation
				</button>
				<button 
					class="btn btn-resume"
					on:click={resumeAutomation}
					disabled={automationState !== 'paused'}
				>
					▶ Resume Automation
				</button>
				<button class="btn btn-refresh" on:click={refreshState}>
					🔄 Refresh State
				</button>
			</div>
		</section>
		
		<!-- Manual Control -->
		<section class="control-section">
			<h2>Manual Control</h2>
			<p class="hint">Manual control automatically pauses automation.</p>
			
			<div class="input-group">
				<label for="iframe-url">Show Iframe:</label>
				<input 
					type="text" 
					id="iframe-url"
					bind:value={manualIframeUrl} 
					placeholder="/proxy/display/scoreboard"
				/>
				<button class="btn" on:click={showIframe}>Show</button>
			</div>
			
			<div class="input-group">
				<label for="video-url">Show Video:</label>
				<input 
					type="text" 
					id="video-url"
					bind:value={manualVideoUrl} 
					placeholder="https://example.com/video.mp4"
				/>
				<button class="btn" on:click={showVideo}>Show</button>
			</div>
		</section>
		
		<!-- Configuration -->
		<section class="control-section">
			<h2>Configuration</h2>
			
			<div class="config-grid">
				<div class="config-item">
					<label for="config-scoreboard">Scoreboard Page:</label>
					<input type="text" id="config-scoreboard" bind:value={configScoreboardPage} />
				</div>
				
				<div class="config-item">
					<label for="config-replay">Replay URL:</label>
					<input type="text" id="config-replay" bind:value={configReplayUrl} placeholder="Optional" />
				</div>
				
				<div class="config-item">
					<label for="config-good-video">Good Lift Video:</label>
					<input type="text" id="config-good-video" bind:value={configGoodLiftVideo} />
				</div>
				
				<div class="config-item">
					<label for="config-bad-video">Bad Lift Video:</label>
					<input type="text" id="config-bad-video" bind:value={configBadLiftVideo} />
				</div>
				
				<div class="config-item">
					<label for="config-good-duration">Good Lift Duration (s):</label>
					<input type="number" id="config-good-duration" bind:value={configGoodLiftDuration} min="1" max="30" />
				</div>
				
				<div class="config-item">
					<label for="config-bad-duration">Bad Lift Duration (s):</label>
					<input type="number" id="config-bad-duration" bind:value={configBadLiftDuration} min="1" max="30" />
				</div>
				
				<div class="config-item">
					<label for="config-replay-duration">Replay Duration (s):</label>
					<input type="number" id="config-replay-duration" bind:value={configReplayDuration} min="1" max="60" />
				</div>
			</div>
			
			<button class="btn btn-save" on:click={updateConfig}>
				💾 Save Configuration
			</button>
		</section>
		
		<!-- Display Link -->
		<section class="control-section">
			<h2>Display Output</h2>
			<p>Open this URL on your display screen:</p>
			<code class="display-url">{browser ? `${window.location.origin}/display-switcher?fop=${fopName}` : '/display-switcher?fop=' + fopName}</code>
			<button class="btn" on:click={() => browser && window.open(`/display-switcher?fop=${fopName}`, '_blank')}>
				Open in New Window
			</button>
		</section>
	</main>
</div>

{:else}
<!-- ========== DISPLAY MODE UI ========== -->
<div class="display-container">
	{#if displayType === 'iframe' && displayUrl}
		<iframe
			src={displayUrl}
			title="OWLCMS Display"
			frameborder="0"
			allowfullscreen
		></iframe>
	{:else if displayType === 'video' && displayUrl}
		<video
			bind:this={videoElement}
			src={displayUrl}
			autoplay
			on:ended={handleVideoEnded}
		>
			<track kind="captions" />
		</video>
	{:else}
		<div class="waiting">
			<h1>Display Switcher</h1>
			<p>FOP: {fopName}</p>
			<p>Waiting for content...</p>
		</div>
	{/if}
</div>
{/if}

<style>
	/* ========== DISPLAY MODE STYLES ========== */
	.display-container {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background: #000;
		overflow: hidden;
	}
	
	.display-container iframe {
		width: 100%;
		height: 100%;
		border: none;
	}
	
	.display-container video {
		width: 100%;
		height: 100%;
		object-fit: contain;
		background: #000;
	}
	
	.waiting {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: #fff;
		font-family: system-ui, -apple-system, sans-serif;
	}
	
	.waiting h1 {
		font-size: 2rem;
		margin-bottom: 1rem;
	}
	
	.waiting p {
		font-size: 1.2rem;
		color: #888;
		margin: 0.5rem 0;
	}
	
	/* ========== CONTROL MODE STYLES ========== */
	.control-container {
		min-height: 100vh;
		background: #1a1a2e;
		color: #eee;
		font-family: system-ui, -apple-system, sans-serif;
		padding: 1rem;
	}
	
	header {
		margin-bottom: 2rem;
	}
	
	header h1 {
		margin: 0 0 1rem 0;
		font-size: 1.5rem;
	}
	
	.status-bar {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
		align-items: center;
	}
	
	.fop-badge {
		background: #3498db;
		padding: 0.25rem 0.75rem;
		border-radius: 4px;
		font-weight: bold;
	}
	
	.connection-status {
		color: #e74c3c;
	}
	.connection-status.connected {
		color: #2ecc71;
	}
	
	.automation-badge {
		background: #2ecc71;
		padding: 0.25rem 0.75rem;
		border-radius: 4px;
	}
	.automation-badge.paused {
		background: #f39c12;
	}
	
	.state-badge {
		background: #9b59b6;
		padding: 0.25rem 0.75rem;
		border-radius: 4px;
		text-transform: uppercase;
		font-size: 0.85rem;
	}
	
	.status-message {
		margin-top: 0.5rem;
		padding: 0.5rem;
		background: #2c3e50;
		border-radius: 4px;
		color: #f1c40f;
	}
	
	main {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		max-width: 800px;
	}
	
	.control-section {
		background: #16213e;
		padding: 1.5rem;
		border-radius: 8px;
	}
	
	.control-section h2 {
		margin: 0 0 1rem 0;
		font-size: 1.2rem;
		color: #3498db;
	}
	
	.hint {
		font-size: 0.9rem;
		color: #888;
		margin-bottom: 1rem;
	}
	
	.button-row {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}
	
	.btn {
		background: #3498db;
		color: white;
		border: none;
		padding: 0.6rem 1.2rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.95rem;
		transition: background 0.2s;
	}
	
	.btn:hover:not(:disabled) {
		background: #2980b9;
	}
	
	.btn:disabled {
		background: #555;
		cursor: not-allowed;
		opacity: 0.6;
	}
	
	.btn-pause {
		background: #f39c12;
	}
	.btn-pause:hover:not(:disabled) {
		background: #d68910;
	}
	
	.btn-resume {
		background: #2ecc71;
	}
	.btn-resume:hover:not(:disabled) {
		background: #27ae60;
	}
	
	.btn-refresh {
		background: #9b59b6;
	}
	.btn-refresh:hover:not(:disabled) {
		background: #8e44ad;
	}
	
	.btn-save {
		margin-top: 1rem;
		background: #2ecc71;
	}
	
	.input-group {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		margin-bottom: 0.75rem;
	}
	
	.input-group label {
		min-width: 100px;
		font-size: 0.9rem;
	}
	
	.input-group input {
		flex: 1;
		padding: 0.5rem;
		border: 1px solid #444;
		border-radius: 4px;
		background: #0f0f23;
		color: #eee;
		font-size: 0.9rem;
	}
	
	.config-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 1rem;
	}
	
	.config-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	
	.config-item label {
		font-size: 0.85rem;
		color: #aaa;
	}
	
	.config-item input {
		padding: 0.5rem;
		border: 1px solid #444;
		border-radius: 4px;
		background: #0f0f23;
		color: #eee;
	}
	
	.display-url {
		display: block;
		background: #0f0f23;
		padding: 0.75rem;
		border-radius: 4px;
		margin: 0.5rem 0 1rem 0;
		font-family: monospace;
		word-break: break-all;
	}
</style>
