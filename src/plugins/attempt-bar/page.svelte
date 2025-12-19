<script>
	import { createTimer } from '$lib/timer-logic.js';
	import { onMount, onDestroy } from 'svelte';
	import CurrentAttemptBar from '$lib/components/CurrentAttemptBar.svelte';
	
	// Props passed from parent route
	export let data = {};
	
	// Timer state using reusable timer logic
	let timerState = { seconds: 0, isRunning: false, isWarning: false, display: '0:00' };
	
	// Create timer instance
	const timer = createTimer();
	const unsubscribe = timer.subscribe(state => {
		timerState = state;
	});
	
	onMount(() => {
		timer.start(data.timer);
	});
	
	onDestroy(() => {
		timer.stop();
		unsubscribe();
	});
	
	$: currentAttempt = data.currentAttempt;
	$: decisionState = data.decision || {};
	
	// Use displayMode from server (computed by shared timer-decision-helpers)
	$: displayMode = data.displayMode || 'none';
	
	// Sync timer with server when data changes
	$: if (data.timer) {
		timer.syncWithServer(data.timer);
	}
</script>

<svelte:head>
	<title>{data.scoreboardName || 'Attempt Bar'} - {data.competition?.name || 'OWLCMS'}</title>
</svelte:head>

<div class="scoreboard">
	<!-- Current Attempt Bar (same as StandardScoreboard) -->
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
			showDecisionLights={true}
			showTimer={true}
			compactMode={false}
		/>
	{:else}
		<div class="waiting">
			<p>{data.message || 'Waiting for competition data...'}</p>
		</div>
	{/if}
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		background: transparent;
		color: #fff;
		font-family: Arial, sans-serif;
		overflow: hidden;
	}
	
	.scoreboard {
		width: 100vw;
		height: 100vh;
		background: transparent;
		color: #fff;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.waiting {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		font-size: 1.5rem;
		color: #888;
	}
</style>
