<script>
	import { page } from '$app/stores';
	import { onMount, onDestroy } from 'svelte';
	
	export let data;
	
	let scoreboardData = null;
	let eventSource;
	
	// Build API URL with all parameters
	$: apiUrl = `/api/scoreboard?type=${data.scoreboardType}&fop=${data.fopName}` +
		Object.entries(data.options).map(([k, v]) => `&${k}=${v}`).join('');
	
	// Fetch scoreboard data from API
	async function fetchData() {
		try {
			const response = await fetch(apiUrl);
			const result = await response.json();
			
			if (result.success) {
				scoreboardData = result.data;
			} else {
				console.error('[Scoreboard] API error:', result.error);
			}
		} catch (err) {
			console.error('[Scoreboard] Fetch error:', err);
		}
	}
	
	onMount(() => {
		// Initial fetch
		fetchData();
		
		// Subscribe to SSE for real-time updates
		eventSource = new EventSource('/api/client-stream');
		
		eventSource.onmessage = (event) => {
			const message = JSON.parse(event.data);
			
			// Refresh data on any competition update
			if (message.type === 'fop_update' || message.type === 'state_update' || message.type === 'competition_update') {
				console.log('[Scoreboard] SSE update received, fetching fresh data');
				fetchData();
			}
		};
		
		eventSource.onerror = (error) => {
			console.error('[Scoreboard] SSE error:', error);
		};
	});
	
	onDestroy(() => {
		if (eventSource) {
			eventSource.close();
		}
	});
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
