<script>
	/**
	 * Display Output - Pure Fullscreen Display
	 * 
	 * Receives display_command SSE events and shows the content.
	 * No control logic, no API calls - just displays what it's told.
	 * 
	 * URL: /display-output?fop=A
	 */
	
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	
	export let data;
	
	// State
	let eventSource = null;
	let displayType = 'iframe';
	let displayUrl = '';
	let videoElement = null;
	
	$: fopName = $page.url.searchParams.get('fop') || data.fopName || 'A';
	
	// Set initial URL from server data
	$: if (data?.initialUrl && !displayUrl) {
		displayUrl = data.initialUrl;
		displayType = data.currentType || 'iframe';
	}
	
	function handleDisplayCommand(command) {
		console.log('[DisplayOutput] Received command:', command);
		
		// Filter by FOP
		if (command.fop && command.fop !== fopName) return;
		
		if (command.command === 'showIframe') {
			displayType = 'iframe';
			displayUrl = command.url;
		} else if (command.command === 'showVideo') {
			displayType = 'video';
			displayUrl = command.url;
		}
	}
	
	function handleVideoEnded() {
		console.log('[DisplayOutput] Video ended');
		// Control plugin handles timing - we just report the event
		// Future: could POST to API to notify control
	}
	
	function connectSSE() {
		if (!browser) return;
		
		// Connect with mode=display to only receive display_command events
		const sseUrl = `/api/client-stream?fop=${encodeURIComponent(fopName)}&mode=display`;
		console.log('[DisplayOutput] Connecting to SSE:', sseUrl);
		
		eventSource = new EventSource(sseUrl);
		
		eventSource.onmessage = (event) => {
			try {
				const eventData = JSON.parse(event.data);
				
				if (eventData.type === 'display_command') {
					handleDisplayCommand(eventData);
				}
			} catch (err) {
				console.error('[DisplayOutput] Error parsing SSE:', err);
			}
		};
		
		eventSource.onerror = (err) => {
			console.error('[DisplayOutput] SSE error:', err);
			// Reconnect after delay
			setTimeout(() => {
				if (eventSource) {
					eventSource.close();
					connectSSE();
				}
			}, 3000);
		};
	}
	
	onMount(() => {
		connectSSE();
	});
	
	onDestroy(() => {
		if (eventSource) {
			eventSource.close();
			eventSource = null;
		}
	});
</script>

<svelte:head>
	<title>Display - {fopName}</title>
	<style>
		body {
			margin: 0;
			padding: 0;
			overflow: hidden;
			background: #000;
		}
	</style>
</svelte:head>

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
			<h1>Display Output</h1>
			<p>FOP: {fopName}</p>
			<p>Waiting for content...</p>
		</div>
	{/if}
</div>

<style>
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
</style>
