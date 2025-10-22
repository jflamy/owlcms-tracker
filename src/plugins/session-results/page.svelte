<script>
	import { createTimer } from '$lib/timer-logic.js';
	import { translations } from '$lib/stores.js';
	import { page } from '$app/stores';
	import { onMount, onDestroy } from 'svelte';
	import RecordsSection from '$lib/components/RecordsSection.svelte';
	import CurrentAttemptBar from '$lib/components/CurrentAttemptBar.svelte';
	import AthletesGrid from '$lib/components/AthletesGrid.svelte';
	
	// Props passed from parent route
	export let data = {};
	
	// Timer state using reusable timer logic
	let timerState = { seconds: 0, isRunning: false, isWarning: false, display: '0:00' };
	
	// Create timer instance
	const timer = createTimer();
	const unsubscribe = timer.subscribe(state => {
		timerState = state;
	});
	
	// Current translations object (populated from store)
	let t = {};
	const unsubscribeTranslations = translations.subscribe(trans => {
		t = trans.en || {};
	});
	
	onMount(() => {
		timer.start(data.timer);
	});
	
	onDestroy(() => {
		timer.stop();
		unsubscribe();
		unsubscribeTranslations();
	});
	
	$: currentAttempt = data.currentAttempt;
	$: allAthletes = data.sortedAthletes || [];  // Standardized field name across all scoreboards
	$: decisionState = data.decision || {};
	
	// Read showLeaders from URL parameter (default: true)
	$: showLeadersParam = $page.url.searchParams.get('showLeaders');
	$: showLeaders = showLeadersParam !== 'false';  // Default true unless explicitly set to false
	$: hasLeaders = data.leaders && data.leaders.length > 0;
	
	// Read showRecords from URL parameter (default: true)
	$: showRecordsParam = $page.url.searchParams.get('showRecords');
	$: showRecords = showRecordsParam !== 'false';  // Default true unless explicitly set to false
	$: hasRecords = data.records && data.records.length > 0;
	
	// Compute grid template rows based on showLeaders URL parameter and available leaders
	// Frontend conditionally includes leader rows based on user preference
	$: computedGridTemplateRows = (() => {
		if (showLeaders && hasLeaders) {
			// Include leaders: results + elastic spacer + leader rows (title already counted in leaderRows)
			// resultRows = all result rows including category spacers
			// leaderRows = leader title + all leader rows including category spacers
			return `repeat(${data.resultRows || 0}, minmax(10px, auto)) repeat(1, 1fr) repeat(${data.leaderRows || 0}, minmax(10px, auto))`;
		} else {
			// Exclude leaders: only results (which include category spacers)
			// resultRows includes all athletes AND category spacer rows
			return `repeat(${data.resultRows || 0}, minmax(10px, auto)) repeat(1, 1fr)`;
		}
	})();
	
	// Debug: log compactTeamColumn value (scoreboard name from backend)
	$: console.log(`[${data.scoreboardName}] compactTeamColumn:`, data.compactTeamColumn);
	
	// Sync timer with server when data changes
	$: if (data.timer) {
		timer.syncWithServer(data.timer);
	}
</script>

<script context="module">
	export function shouldRenderFlag(url) {
		if (!url) return false;
		if (typeof url === 'string' && url.startsWith('data:image/')) return false;
		return true;
	}
</script>

<svelte:head>
	<title>{data.scoreboardName || 'Scoreboard'} - {data.competition?.name || 'OWLCMS'}</title>
</svelte:head>

<div class="scoreboard">
	<!-- Current Lifter Header (only show when we have data) -->
	{#if data.status !== 'waiting'}
		<CurrentAttemptBar 
			currentAttempt={data.currentAttempt}
			timerState={timerState}
			decisionState={data.decision}
			scoreboardName={data.scoreboardName}
			sessionStatus={data.sessionStatus}
			competition={data.competition}
			showDecisionLights={true}
			showTimer={true}
			compactMode={false}
		/>
	{/if}

	<!-- Main Scoreboard Table -->
	<main class="main">
		{#if data.status === 'waiting'}
			<div class="waiting">
				<p>{data.message || 'Waiting for competition data...'}</p>
			</div>
		{:else}
			<div style="--template-rows: {computedGridTemplateRows}">
				<AthletesGrid 
					allAthletes={allAthletes}
					translations={t}
					showLeaders={showLeaders}
					hasLeaders={hasLeaders}
					data={data}
				/>
			</div>

			<!-- Records Section (Below Grid, Not Part of Grid) -->
			{#if showRecords && hasRecords}
				<RecordsSection records={data.records} translations={t} />
			{/if}
		{/if}
	</main>
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		background: #000;
		color: #fff;
		font-family: Arial, sans-serif;
		overflow: hidden;
	}
	
	.scoreboard {
		width: 100vw;
		height: 100vh;
		background: #000;
		color: #fff;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	
	
	/* Main grid */
	.main {
		flex: 1;
		overflow-y: auto;
		padding: 8px;
		background: #000;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	/* Waiting state */
	.waiting {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		font-size: 1.5rem;
		color: #888;
	}

	/* Scrollbar styling */
	.main::-webkit-scrollbar {
		width: 0.625rem;
	}

	.main::-webkit-scrollbar-track {
		background: #000;
	}

	.main::-webkit-scrollbar-thumb {
		background: #333;
		border-radius: 0.3125rem;
	}

	.main::-webkit-scrollbar-thumb:hover {
		background: #555;
	}

	/* Responsive adjustments */
	@media (max-width: 1160px) {
		.main {
			padding: 8px;
		}
	}

	@media (max-width: 932px) {
		.main {
			padding: 8px;
		}
	}

	@media (max-width: 932px) and (orientation: portrait) {
		.main {
			padding: 8px;
		}
	}
</style>
