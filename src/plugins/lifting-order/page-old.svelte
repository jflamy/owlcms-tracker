<script>
	import { onMount } from 'svelte';
	import SystemStatus from '$lib/components/SystemStatus.svelte';
	import { competition } from '$lib/stores.js';
	import { formatTimeRemaining } from './helpers.client.js';
	
	// Props from server-side load function (initial data)
	export let data = {};
	
	// Start with server-side data, then switch to reactive store
	let scoreboardData = data?.scoreboardData || {};
	
	// Subscribe to live updates from the competition store
	$: if ($competition && Object.keys($competition).length > 0) {
		console.log('[Scoreboard] Raw competition data:', $competition);
		console.log('[Scoreboard] Available fields:', Object.keys($competition));
		
		// When we get live data, use it instead of initial server data
		scoreboardData = {
			competition: {
				name: $competition.competition?.name || $competition.competitionName || 'Competition',
				fop: $competition.competition?.fop || $competition.fop || 'A',
					sessionInfo: $competition.sessionInfo || ''
			},
			currentAthlete: $competition.fullName ? {
				name: $competition.fullName,
				team: $competition.teamName,
				startNumber: $competition.startNumber,
				category: $competition.categoryName,
				attempt: $competition.attempt,
				attemptNumber: $competition.attemptNumber,
				weight: $competition.weight,
				timeAllowed: $competition.timeAllowed
			} : null,
			timer: {
				state: $competition.athleteTimerEventType === 'Start' ? 'running' : 'stopped',
				timeRemaining: parseInt($competition.athleteMillisRemaining) || 0,
				duration: parseInt($competition.timeAllowed) || 60000
			},
			liftingOrderAthletes: parseLiftingOrder($competition.liftingOrderAthletes),
			status: 'ready'
		};
		
		console.log('[Scoreboard] Processed scoreboardData:', scoreboardData);
	}
	
	function parseLiftingOrder(jsonString) {
		if (!jsonString) return [];
		try {
			return JSON.parse(jsonString);
		} catch (err) {
			console.error('Failed to parse liftingOrderAthletes:', err);
			return [];
		}
	}
	
	// Extract reactive properties
	$: competition_data = scoreboardData.competition || {};
	$: currentAthlete = scoreboardData.currentAthlete;
	$: timer = scoreboardData.timer || { state: 'stopped', timeRemaining: 0 };
	$: liftingOrder = scoreboardData.liftingOrderAthletes || [];
	$: status = scoreboardData.status || 'waiting';
	
	// Timer countdown
	let displayTimeRemaining = 0;
	let timerInterval;
	
	$: if (timer.state === 'running' && timer.timeRemaining > 0) {
		startTimer();
	} else {
		stopTimer();
		displayTimeRemaining = timer.timeRemaining || 0;
	}
	
	function startTimer() {
		stopTimer();
		const startTime = Date.now();
		const initialRemaining = timer.timeRemaining;
		
		timerInterval = setInterval(() => {
			const elapsed = Date.now() - startTime;
			displayTimeRemaining = Math.max(0, initialRemaining - elapsed);
			
			if (displayTimeRemaining <= 0) {
				stopTimer();
			}
		}, 100);
	}
	
	function stopTimer() {
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
	}
	
	onMount(() => {
		console.log('Scoreboard mounted!');
		console.log('Initial server data:', data?.scoreboardData);
		
		return () => {
			stopTimer();
		};
	});
</script>

<svelte:head>
	<title>Scoreboard - {competition_data.name || 'OWLCMS'}</title>
</svelte:head>

<div class="scoreboard">
	<!-- System Status -->
	<div class="system-status">
		<SystemStatus />
	</div>
	
	<!-- Header -->
	<header class="header">
		<h1>{competition_data.name || 'Competition Scoreboard'}</h1>
		<div class="header-info">
			<span>FOP {competition_data.fop || 'A'}</span>
			<span>{competition_data.sessionInfo || competition_data.session || ''}</span>
		</div>
	</header>

	<!-- Main Content -->
	<main class="main">
		{#if status === 'waiting'}
			<div class="waiting">
				<p>Waiting for competition data...</p>
			</div>
		{:else if currentAthlete}
			<!-- Current Athlete -->
			<section class="current-athlete">
				<h2>Current Lifter</h2>
				<div class="athlete-card">
					<div class="athlete-name">{currentAthlete.name}</div>
					<div class="athlete-details">
						<span class="start-number">#{currentAthlete.startNumber}</span>
						<span>{currentAthlete.team || ''}</span>
						<span>{currentAthlete.category || ''}</span>
					</div>
					<div class="attempt-info">
						<span class="attempt">{@html currentAthlete.attempt || ''}</span>
						<span class="weight">{currentAthlete.weight} kg</span>
					</div>
				</div>
				
				<!-- Timer -->
				<div class="timer" class:running={timer.state === 'running'} class:warning={displayTimeRemaining > 0 && displayTimeRemaining <= 30000}>
					{formatTimeRemaining(displayTimeRemaining)}
				</div>
			</section>
		{:else}
			<div class="no-athlete">
				<p>No athlete currently lifting</p>
			</div>
		{/if}
		
		<!-- Lifting Order -->
		{#if liftingOrder && liftingOrder.length > 0}
			<section class="lifting-order">
				<h2>Lifting Order</h2>
				<div class="order-list">
					{#each liftingOrder.slice(0, 8) as athlete, index}
						{#if !athlete.isSpacer}
							<div class="order-item" class:current={athlete.classname?.includes('current')} class:next={athlete.classname?.includes('next')}>
								<span class="position">{index + 1}</span>
								<span class="name">{athlete.fullName}</span>
								<span class="team">{athlete.teamName}</span>
								<span class="weight">{athlete.sattempts?.[0]?.stringValue || athlete.cattempts?.[0]?.stringValue || '-'} kg</span>
							</div>
						{/if}
					{/each}
				</div>
			</section>
		{/if}
	</main>
</div>

<style>
	.scoreboard {
		min-height: 100vh;
		background: linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%);
		color: white;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	.system-status {
		position: fixed;
		top: 1rem;
		right: 1rem;
		z-index: 100;
	}

	.header {
		background: rgba(0, 0, 0, 0.3);
		padding: 1.5rem 2rem;
		border-bottom: 2px solid rgba(255, 255, 255, 0.2);
	}

	.header h1 {
		margin: 0 0 0.5rem 0;
		font-size: 2rem;
		font-weight: 700;
	}

	.header-info {
		display: flex;
		gap: 2rem;
		font-size: 0.9rem;
		opacity: 0.9;
	}

	.main {
		padding: 2rem;
		max-width: 1200px;
		margin: 0 auto;
	}

	.waiting, .no-athlete {
		text-align: center;
		padding: 4rem 2rem;
		font-size: 1.5rem;
		opacity: 0.8;
	}

	/* Current Athlete */
	.current-athlete {
		margin-bottom: 3rem;
	}

	.current-athlete h2 {
		font-size: 1.3rem;
		margin-bottom: 1rem;
		opacity: 0.9;
	}

	.athlete-card {
		background: rgba(255, 255, 255, 0.1);
		backdrop-filter: blur(10px);
		border-radius: 1rem;
		padding: 2rem;
		border: 1px solid rgba(255, 255, 255, 0.2);
		margin-bottom: 1.5rem;
	}

	.athlete-name {
		font-size: 2.5rem;
		font-weight: 700;
		margin-bottom: 1rem;
	}

	.athlete-details {
		display: flex;
		gap: 1.5rem;
		flex-wrap: wrap;
		margin-bottom: 1.5rem;
		font-size: 1.1rem;
		opacity: 0.9;
	}

	.start-number {
		background: rgba(255, 255, 255, 0.2);
		padding: 0.25rem 0.75rem;
		border-radius: 0.5rem;
		font-weight: 600;
	}

	.attempt-info {
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-top: 1px solid rgba(255, 255, 255, 0.2);
		padding-top: 1.5rem;
		margin-top: 0.5rem;
	}

	.attempt {
		font-size: 1.2rem;
	}

	.weight {
		font-size: 3rem;
		font-weight: 700;
		color: #fbbf24;
		text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
	}

	/* Timer */
	.timer {
		text-align: center;
		font-size: 4rem;
		font-weight: 700;
		padding: 1rem;
		background: rgba(0, 0, 0, 0.2);
		border-radius: 1rem;
		text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
	}

	.timer.running {
		background: rgba(34, 197, 94, 0.2);
		color: #86efac;
	}

	.timer.warning {
		background: rgba(239, 68, 68, 0.3);
		color: #fca5a5;
		animation: pulse 1s infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.7; }
	}

	/* Lifting Order */
	.lifting-order {
		margin-top: 3rem;
	}

	.lifting-order h2 {
		font-size: 1.3rem;
		margin-bottom: 1rem;
		opacity: 0.9;
	}

	.order-list {
		background: rgba(255, 255, 255, 0.05);
		backdrop-filter: blur(10px);
		border-radius: 1rem;
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.order-item {
		display: grid;
		grid-template-columns: 3rem 2fr 1.5fr 1fr;
		gap: 1rem;
		padding: 1rem 1.5rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		align-items: center;
		transition: all 0.3s;
	}

	.order-item:last-child {
		border-bottom: none;
	}

	.order-item:hover {
		background: rgba(255, 255, 255, 0.05);
	}

	.order-item.current {
		background: rgba(251, 191, 36, 0.2);
		border: 2px solid rgba(251, 191, 36, 0.5);
		font-weight: 600;
	}

	.order-item.next {
		background: rgba(34, 197, 94, 0.1);
	}

	.position {
		font-weight: 600;
		opacity: 0.7;
		text-align: center;
	}

	.name {
		font-weight: 500;
	}

	.team {
		opacity: 0.8;
		font-size: 0.9rem;
	}

	.order-item .weight {
		font-size: 1.1rem;
		text-align: right;
		color: #fbbf24;
	}

	@media (max-width: 768px) {
		.header h1 {
			font-size: 1.5rem;
		}

		.athlete-name {
			font-size: 2rem;
		}

		.timer {
			font-size: 3rem;
		}

		.order-item {
			grid-template-columns: 2rem 1.5fr 1fr 1fr;
			gap: 0.5rem;
			padding: 0.75rem 1rem;
			font-size: 0.9rem;
		}

		.order-item .weight {
			font-size: 1rem;
		}
	}
</style>