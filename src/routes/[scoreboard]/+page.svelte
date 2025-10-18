<script>
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { translations } from '$lib/stores.js';
	import { subscribeSSE, connectSSE } from '$lib/sse-client.js';
	import { onMount, onDestroy } from 'svelte';
	
	export let data;
	
	let scoreboardData = null;
	let unsubscribeSSE = null;
	
	// Get language preference from URL parameter (default: 'en')
	$: language = $page.url.searchParams.get('lang') || 'en';
	
	// Build API URL with all parameters
	$: apiUrl = `/api/scoreboard?type=${data.scoreboardType}&fop=${data.fopName}` +
		Object.entries(data.options).map(([k, v]) => `&${k}=${v}`).join('');
	
	// Fetch scoreboard data from API
	async function fetchData() {
		const fetchId = Math.random().toString(36).substr(2, 9);
		const startTime = Date.now();
		
		try {
			console.log(`[Scoreboard Fetch] 🔄 Fetch ${fetchId} starting: ${apiUrl}`);
			
			const fetchStartTime = Date.now();
			const response = await fetch(apiUrl);
			const fetchElapsed = Date.now() - fetchStartTime;
			console.log(`[Scoreboard Fetch] 📡 Fetch ${fetchId} received response (HTTP ${response.status}, ${fetchElapsed}ms)`);
			
			const parseStartTime = Date.now();
			const result = await response.json();
			const parseElapsed = Date.now() - parseStartTime;
			console.log(`[Scoreboard Fetch] 📝 Fetch ${fetchId} parsed JSON (${parseElapsed}ms)`);
			
			if (result.success) {
				scoreboardData = result.data;
				const totalElapsed = Date.now() - startTime;
				console.log(`[Scoreboard Fetch] ✅ Fetch ${fetchId} completed in ${totalElapsed}ms, data has ${Object.keys(scoreboardData).length} fields`);
			} else {
				const totalElapsed = Date.now() - startTime;
				console.error(`[Scoreboard Fetch] ❌ Fetch ${fetchId} API error after ${totalElapsed}ms:`, result.error);
			}
		} catch (err) {
			const totalElapsed = Date.now() - startTime;
			console.error(`[Scoreboard Fetch] ❌ Fetch ${fetchId} error after ${totalElapsed}ms:`, err);
		}
	}
	
	onMount(() => {
		// Initial fetch
		console.log(`[Scoreboard Mount] 🔄 onMount starting, calling fetchData for ${data.scoreboardType}`);
		fetchData();
		
		// Connect to shared SSE (browser only)
		if (browser) {
			console.log(`[Scoreboard Mount] Setting up shared SSE connection for lang=${language}`);
			connectSSE(language);
			
			// Subscribe to SSE messages
			unsubscribeSSE = subscribeSSE((message) => {
				// Handle translation updates
				if (message.type === 'translations') {
					console.log(`[Scoreboard SSE] Received translations for locale '${message.locale}' (${message.keyCount} keys)`);
					translations.setLocale(message.locale, message.data);
				}
				
				// Refresh data on any competition update
				if (message.type === 'fop_update' || message.type === 'state_update' || message.type === 'competition_update') {
					const eventType = message.data?.athleteTimerEventType || message.data?.uiEvent || message.type;
					console.log(`[Scoreboard SSE] Event received (${eventType}), triggering fetchData`);
					fetchData();
				}
			});
		}
	});
	
	onDestroy(() => {
		if (unsubscribeSSE) {
			console.log('[Scoreboard Destroy] Unsubscribing from SSE');
			unsubscribeSSE();
		}
	});
	
	// Reconnect SSE if language changes (browser only)
	$: if (browser && language) {
		console.log(`[Scoreboard Language] 🔄 Language changed to ${language}, reconnecting SSE`);
		connectSSE(language);
	}
</script>

<svelte:head>
	<title>{data.scoreboardName} - FOP {data.fopName}</title>
</svelte:head>

{#if scoreboardData}
	<!-- Dynamically import the scoreboard component -->
	{#await import(`../../plugins/${data.scoreboardType}/page.svelte`)}
		<div class="loading">Loading scoreboard...</div>
	{:then module}
		<svelte:component this={module.default} data={scoreboardData} config={data.config} options={data.options} />
	{:catch error}
		<div class="error">
			<h1>Error Loading Scoreboard</h1>
			<p>{error.message}</p>
			<p>Scoreboard type: <code>{data.scoreboardType}</code></p>
		</div>
	{/await}
{:else}
	<div class="loading">
		<h1>Loading {data.scoreboardName}...</h1>
		<p>FOP: {data.fopName}</p>
	</div>
{/if}

<style>
	.loading, .error {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		background: #1a1a1a;
		color: white;
		font-family: Arial, sans-serif;
	}
	
	.error {
		background: #2a1a1a;
	}
	
	.error code {
		background: #3a2a2a;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-family: 'Courier New', monospace;
	}
	
	h1 {
		font-size: 2rem;
		margin-bottom: 1rem;
	}
	
	p {
		font-size: 1.2rem;
		color: #aaa;
	}
</style>
