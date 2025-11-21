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
	
	// Sync timer with server when data changes
	$: if (data.timer) {
		timer.syncWithServer(data.timer);
	}
</script>

<svelte:head>
	<title>{data.scoreboardName || 'Scoreboard'} - {data.competition?.name || 'OWLCMS'}</title>
</svelte:head>

<div class="scoreboard">
	<!-- Current Attempt Header (top line only) -->
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
</style>
