<script>
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { translations } from '$lib/stores.js';
	import { subscribeSSE, connectSSE } from '$lib/sse-client.js';
	import { onMount, onDestroy } from 'svelte';
	
	export let data;
	
	let scoreboardData = null;
	let scoreboardError = null;
	let unsubscribeSSE = null;
	
	// Check if this is a document-type plugin (no live updates needed)
	// Use direct property access since this is needed at mount time
	const isDocument = data.config?.category === 'documents';
	
	// Get language preference from URL parameter or config default or fallback to 'en'
	$: language = $page.url.searchParams.get('lang') || $page.url.searchParams.get('language') || data.config?.options?.find(o => o.key === 'language')?.default || 'en';
	
	// Build API URL with all parameters (including lang)
	$: apiUrl = `/api/scoreboard?type=${data.scoreboardType}&fop=${data.fopName}&lang=${language}` +
		Object.entries(data.options).map(([k, v]) => `&${k}=${v}`).join('');
	
	// Fetch scoreboard data from API
	async function fetchData() {
		try {
			const response = await fetch(apiUrl);
			const result = await response.json();
			
			if (result.success) {
				console.log('[Scoreboard] API returned:', result.data?.currentAttempt?.weight || result.data?.weight || 'no weight');
				scoreboardData = result.data;
				scoreboardError = null;
			} else {
				console.error('[Scoreboard] API error:', result.error);
				scoreboardError = result.error || 'Scoreboard API error';
			}
		} catch (err) {
			console.error('[Scoreboard] Fetch error:', err);
			scoreboardError = err?.message || 'Network error fetching scoreboard data';
		}
	}
	
	onMount(() => {
		console.log('[Scoreboard] Mount - isDocument:', isDocument, 'category:', data.config?.category);
		
		// Initial fetch
		fetchData();
		
		// Connect to shared SSE (browser only) - skip for document-type plugins
		if (browser && !isDocument) {
			// Pass fopName so SSE broker only sends events for this FOP (+ global events)
			connectSSE(language, data.fopName);
			unsubscribeSSE = subscribeSSE((message) => {
				console.log('[Scoreboard] SSE received:', message.type, message.fop || '', JSON.stringify(message.timer || message.decision || {}).substring(0, 100));
				
				// Handle translation updates
				if (message.type === 'translations') {
					translations.setLocale(message.locale, message.data);
					return;
				}
				
				// Handle timer events directly (no API fetch)
				// Server provides displayMode computed with full FOP context
				if (message.type === 'timer' && message.fop === data.fopName) {
					if (scoreboardData) {
						scoreboardData = {
							...scoreboardData,
							timer: message.timer,
							displayMode: message.displayMode
						};
					}
					return;
				}
				
				// Handle decision events directly (no API fetch)
				// Server provides displayMode computed with full FOP context
				if (message.type === 'decision' && message.fop === data.fopName) {
					if (scoreboardData) {
						scoreboardData = {
							...scoreboardData,
							decision: message.decision,
							displayMode: message.displayMode
						};
					}
					return;
				}
				
				// Refresh data on any competition update or hub ready
				if (message.type === 'fop_update' || message.type === 'state_update' || message.type === 'competition_update' || message.type === 'hub_ready') {
					console.log('[Scoreboard] Triggering fetchData() for', message.type);
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
	$: if (browser && language && !isDocument) {
		connectSSE(language, data.fopName);
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
		{#if scoreboardError}
			<p class="error-note">{scoreboardError}</p>
		{/if}
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

	.error-note {
		margin-top: 0.75rem;
		max-width: 60rem;
		padding: 0.75rem 1rem;
		background: #2a1a1a;
		border: 1px solid #7f1d1d;
		border-radius: 6px;
		color: #fecaca;
		font-size: 1rem;
	}
</style>
