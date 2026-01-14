<script>
	import { createTimer } from '$lib/timer-logic.js';
	import { page } from '$app/stores';
	import { onMount, onDestroy } from 'svelte';
	import RecordsSection from '$lib/components/RecordsSection.svelte';
	import CurrentAttemptBar from '$lib/components/CurrentAttemptBar.svelte';
	import AthletesGrid from '$lib/components/AthletesGrid.svelte';
	
	// Props passed from parent route
	export let data = {};
	
	// Timer state using reusable timer logic (not used directly, but kept for compatibility)
	let timerState = { seconds: 0, isRunning: false, isWarning: false, display: '0:00' };
	
	// Create timer instance
	const timer = createTimer();
	const unsubscribe = timer.subscribe(state => {
		timerState = state;
	});
	
	// Use pre-translated headers from server (optimized for cloud)
	$: headers = data.headers || {};
	
	onMount(() => {
		timer.start(data.timer);
	});
	
	onDestroy(() => {
		timer.stop();
		unsubscribe();
	});
	
	$: currentAttempt = data.currentAttempt;
	$: allAthletes = data.sortedAthletes || [];  // Standardized field name across all scoreboards
	$: decisionState = data.decision || {};
	
	// Use displayMode from server (computed by shared timer-decision-helpers)
	$: displayMode = data.displayMode || 'none';
	
	// Read showLeaders from URL parameter (default: true)
	$: showLeadersParam = $page.url.searchParams.get('showLeaders');
	$: showLeaders = showLeadersParam !== 'false';  // Default true unless explicitly set to false
	$: hasLeaders = data.leaders && data.leaders.length > 0;
	
	// Read showRecords from URL parameter (default: true)
	$: showRecordsParam = $page.url.searchParams.get('showRecords');
	$: showRecords = showRecordsParam !== 'false';  // Default true unless explicitly set to false
	$: hasRecords = data.records && data.records.length > 0;

	// Read vFill from URL parameter (default: true) - controls elastic spacer row
	// vFill=true: 1fr elastic row pushes leaders to bottom
	// vFill=false: 1.5em fixed height spacer
	$: vFillParam = $page.url.searchParams.get('vFill');
	$: vFill = vFillParam !== 'false';  // Default true unless explicitly set to false
	
	// Compute grid template rows based on showLeaders URL parameter and available leaders
	// vFill controls whether the spacer row is elastic (1fr) or fixed (1.5em)
	$: spacerSize = vFill ? '1fr' : '1.5em';
	$: computedGridTemplateRows = (() => {
		if (showLeaders && hasLeaders) {
			return `repeat(${data.resultRows || 0}, minmax(10px, auto)) ${spacerSize} repeat(${data.leaderRows || 0}, minmax(10px, auto))`;
		} else {
			return `repeat(${data.resultRows || 0}, minmax(10px, auto)) ${spacerSize}`;
		}
	})();
	
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
	<!-- Current Lifter Header (only show when we have data and session is selected) -->
	{#if data.status !== 'waiting' && data.attemptBarClass !== 'hide-because-null-session'}
		<CurrentAttemptBar 
			currentAttempt={data.currentAttempt}
			timerData={data.timer}
			breakTimerData={data.breakTimer}
			displayMode={displayMode}
			decisionState={data.decision}
			scoreboardName={data.scoreboardName}
			sessionStatus={data.sessionStatus}
			competition={data.competition}
			breakTitle={data.breakTitle}
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
		{:else if data.attemptBarClass === 'hide-because-null-session'}
			<div class="waiting">
				<p>!!Waiting for next session</p>
			</div>
		{:else}
			<div class="grid-container" class:no-vfill={!vFill} style="--template-rows: {computedGridTemplateRows}">
				<AthletesGrid 
					allAthletes={allAthletes}
					headers={headers} 
					showLeaders={showLeaders}
					hasLeaders={hasLeaders}
					data={data}
				/>
			</div>

			<!-- Records Section (Below Grid, Not Part of Grid) -->
			{#if showRecords && hasRecords}
				<RecordsSection records={data.records} headers={headers} />
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

	/* Grid container - must expand to fill .main for 1fr elastic spacer to work */
	.grid-container {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	/* When vFill=false, don't expand - let grid use natural height */
	.grid-container.no-vfill {
		flex: 0 0 auto;
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

	/* Responsive adjustments for landscape mode */
	@media (max-width: 1366px) and (orientation: landscape) {
		.main {
			padding: 6px;
		}
	}

	@media (max-width: 1280px) and (orientation: landscape) {
		.main {
			padding: 5px;
		}
	}

	@media (max-width: 926px) and (orientation: landscape) {
		.main {
			padding: 4px;
		}

		.waiting {
			font-size: 1.2rem;
		}
	}
</style>
