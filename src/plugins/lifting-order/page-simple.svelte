<script>
	import SystemStatus from '$lib/components/SystemStatus.svelte';
	import { onMount, onDestroy } from 'svelte';
	
	// Props passed from parent route
	export let data = {};
	export let options = {};
	
	// Timer state for countdown
	let timerSeconds = 0;
	let timerInterval;
	
	// Update timer display
	function updateTimer() {
		if (!data.currentAttempt?.startTime || !data.currentAttempt?.timeAllowed) {
			timerSeconds = 0;
			return;
		}
		
		const elapsed = Date.now() - data.currentAttempt.startTime;
		const remainingMs = Math.max(0, data.currentAttempt.timeAllowed - elapsed);
		timerSeconds = Math.ceil(remainingMs / 1000);
	}
	
	onMount(() => {
		// Update timer every 100ms
		timerInterval = setInterval(updateTimer, 100);
	});
	
	onDestroy(() => {
		if (timerInterval) clearInterval(timerInterval);
	});
	
	$: currentAttempt = data.currentAttempt;
	$: liftingOrder = (data.liftingOrderAthletes || []).slice(0, options.maxLifters || 8);
	$: isRunning = timerSeconds > 0;
	$: isWarning = timerSeconds > 0 && timerSeconds <= 30;
</script>

<svelte:head>
	<title>Lifting Order - {data.competition?.name || 'OWLCMS'}</title>
</svelte:head>

<div class="scoreboard">
	<div class="system-status">
		<SystemStatus />
	</div>
	
	<header class="header">
		<h1>{data.competition?.name || 'Competition Scoreboard'}</h1>
		<div class="header-info">
			<span>FOP {data.competition?.fop || 'A'}</span>
			{#if data.competition?.sessionInfo}
				<span>{data.competition.sessionInfo}</span>
			{/if}
		</div>
	</header>

	<main class="main">
		{#if data.status === 'waiting'}
			<div class="waiting">
				<p>Waiting for competition data...</p>
			</div>
		{:else if currentAttempt}
			<!-- Current Lifter -->
			<section class="current-athlete">
				<h2>Current Lifter</h2>
				<div class="athlete-card">
					<div class="athlete-name">{currentAttempt.fullName || currentAttempt.name}</div>
					<div class="athlete-details">
						<span class="start-number">#{currentAttempt.startNumber}</span>
						<span>{currentAttempt.teamName || currentAttempt.team || ''}</span>
						<span>{currentAttempt.categoryName || currentAttempt.category || ''}</span>
					</div>
					<div class="attempt-info">
						<span class="attempt">{currentAttempt.attempt || ''}</span>
						<span class="weight">{currentAttempt.weight} kg</span>
					</div>
				</div>
				
				<!-- Timer -->
				<div class="timer" class:running={isRunning} class:warning={isWarning}>
					{#if isRunning}
						{timerSeconds}s
					{:else}
						--
					{/if}
				</div>
			</section>

			<!-- Lifting Order -->
			<section class="lifting-order">
				<h2>Lifting Order (Next {liftingOrder.length})</h2>
				<table>
					<thead>
						<tr>
							<th>#</th>
							<th>Name</th>
							<th>Team</th>
							<th>Category</th>
							<th>Attempt</th>
							<th>Weight</th>
						</tr>
					</thead>
					<tbody>
						{#each liftingOrder as athlete}
							{#if !athlete.isSpacer}
								<tr>
									<td>{athlete.startNumber}</td>
									<td>{athlete.fullName}</td>
									<td>{athlete.teamName || '--'}</td>
									<td>{athlete.categoryName || '--'}</td>
									<td>{athlete.attempt || '--'}</td>
									<td>{athlete.weight ? `${athlete.weight} kg` : '--'}</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</section>
		{:else}
			<div class="waiting">
				<p>No active lifter</p>
			</div>
		{/if}
	</main>
</div>

<style>
	.scoreboard {
		width: 100%;
		min-height: 100vh;
		background: #1a1a1a;
		color: white;
		font-family: 'Arial', sans-serif;
	}

	.system-status {
		position: fixed;
		top: 1rem;
		right: 1rem;
		z-index: 1000;
	}

	.header {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		padding: 2rem;
		text-align: center;
	}

	.header h1 {
		margin: 0 0 0.5rem 0;
		font-size: 2.5rem;
		font-weight: bold;
	}

	.header-info {
		display: flex;
		justify-content: center;
		gap: 2rem;
		font-size: 1.2rem;
	}

	.main {
		padding: 2rem;
		max-width: 1400px;
		margin: 0 auto;
	}

	.waiting {
		text-align: center;
		padding: 4rem;
		font-size: 1.5rem;
		color: #888;
	}

	.current-athlete {
		margin-bottom: 3rem;
	}

	.current-athlete h2 {
		font-size: 1.8rem;
		margin-bottom: 1rem;
		color: #667eea;
	}

	.athlete-card {
		background: #2a2a2a;
		border-radius: 12px;
		padding: 2rem;
		margin-bottom: 1.5rem;
	}

	.athlete-name {
		font-size: 3rem;
		font-weight: bold;
		margin-bottom: 1rem;
	}

	.athlete-details {
		display: flex;
		gap: 2rem;
		font-size: 1.3rem;
		color: #aaa;
		margin-bottom: 1.5rem;
	}

	.start-number {
		color: #667eea;
		font-weight: bold;
	}

	.attempt-info {
		display: flex;
		gap: 2rem;
		font-size: 1.5rem;
	}

	.attempt {
		color: #ffd700;
	}

	.weight {
		color: #fff;
		font-weight: bold;
	}

	.timer {
		font-size: 6rem;
		font-weight: bold;
		text-align: center;
		padding: 2rem;
		background: #2a2a2a;
		border-radius: 12px;
		color: #888;
	}

	.timer.running {
		color: #4ade80;
	}

	.timer.warning {
		color: #f87171;
		animation: pulse 1s infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.6; }
	}

	.lifting-order {
		margin-top: 3rem;
	}

	.lifting-order h2 {
		font-size: 1.8rem;
		margin-bottom: 1rem;
		color: #667eea;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		background: #2a2a2a;
		border-radius: 12px;
		overflow: hidden;
	}

	thead {
		background: #3a3a3a;
	}

	th, td {
		padding: 1rem;
		text-align: left;
	}

	th {
		font-weight: bold;
		color: #667eea;
	}

	tbody tr {
		border-bottom: 1px solid #3a3a3a;
	}

	tbody tr:last-child {
		border-bottom: none;
	}

	tbody tr:hover {
		background: #333;
	}
</style>
