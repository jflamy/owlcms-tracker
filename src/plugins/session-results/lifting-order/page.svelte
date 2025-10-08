<script>
	import { onMount, onDestroy } from 'svelte';
	
	// Props passed from parent route
	export let data = {};
	export let config = {};
	export let options = {};
	
	// Timer state for countdown
	let timerSeconds = 0;
	let timerInterval;
	let timerStartTime = null; // When timer was started (client time)
	let timerInitialRemaining = 0; // Initial time remaining from server
	let lastTimerState = null; // Track last known timer state to detect changes
	
	// Update timer display - countdown from start time
	function updateTimer() {
		if (!data.timer) {
			timerSeconds = 0;
			return;
		}
		
		// If timer is stopped, show the time without counting down
		if (data.timer.state === 'stopped') {
			timerSeconds = Math.ceil((data.timer.timeRemaining || 0) / 1000);
			return;
		}
		
		// If timer is set (but not running), show the time without counting down
		if (data.timer.state === 'set') {
			timerSeconds = Math.ceil((data.timer.timeRemaining || 0) / 1000);
			return;
		}
		
		// Timer is running - count down
		if (data.timer.state === 'running') {
			// If timer just started, record the start time
			if (timerStartTime === null) {
				timerStartTime = Date.now();
				timerInitialRemaining = data.timer.timeRemaining || 60000;
			}
			
			// Calculate elapsed time and remaining time (client-side only, no server needed)
			const elapsed = Date.now() - timerStartTime;
			const remaining = Math.max(0, timerInitialRemaining - elapsed);
			timerSeconds = Math.ceil(remaining / 1000);
		}
	}
	
	onMount(() => {
		// Update timer every 100ms
		timerInterval = setInterval(updateTimer, 100);
		updateTimer(); // Initial update
	});
	
	onDestroy(() => {
		if (timerInterval) clearInterval(timerInterval);
	});
	
	$: currentAttempt = data.currentAttempt;
	$: allAthletes = data.liftingOrderAthletes || [];  // Use lifting order, not start number order
	
	// Only update timer when state actually changes (not on every data refresh)
	$: if (data.timer) {
		const currentState = `${data.timer.state}-${data.timer.timeRemaining}`;
		if (currentState !== lastTimerState) {
			lastTimerState = currentState;
			
			// Timer state changed - reset start time
			if (data.timer.state === 'running') {
				timerStartTime = null; // Force recalculation with new time
			} else {
				timerStartTime = null;
			}
			
			updateTimer();
		}
	}
	
	$: isRunning = data.timer?.state === 'running' && timerSeconds > 0;
	$: isWarning = timerSeconds > 0 && timerSeconds <= 30;
	
	// Format timer display
	$: timerDisplay = Math.floor(timerSeconds / 60) + ':' + String(timerSeconds % 60).padStart(2, '0');
	
	// Helper to get attempt status color from OWLCMS liftStatus
	function getAttemptClass(attempt) {
		if (!attempt || !attempt.liftStatus || attempt.liftStatus === 'empty' || attempt.liftStatus === 'request') {
			return 'empty';
		}
		if (attempt.liftStatus === 'fail') return 'failed';
		if (attempt.liftStatus === 'good') return 'success';
		return 'empty';
	}
	
	// Helper to display attempt value from OWLCMS stringValue
	function displayAttempt(attempt) {
		if (!attempt || !attempt.stringValue || attempt.stringValue === '') return '-';
		// Remove parentheses from failed attempts (OWLCMS sends "(62)" for failed 62kg)
		return attempt.stringValue.replace(/[()]/g, '');
	}
</script>

<svelte:head>
	<title>Lifting Order - {data.competition?.name || 'OWLCMS'}</title>
</svelte:head>

<div class="scoreboard">
	<!-- Current Lifter Header -->
	<header class="header">
		<div class="lifter-info">
			<span class="start-number">{currentAttempt?.startNumber || '-'}</span>
			<span class="lifter-name">{currentAttempt?.fullName || 'No athlete currently lifting'}</span>
			<span class="team">{currentAttempt?.teamName || ''}</span>
			<span class="attempt-label">{@html currentAttempt?.attempt || ''}</span>
			<span class="weight">{currentAttempt?.weight || '-'} kg</span>
			<span class="timer" class:running={isRunning} class:warning={isWarning}>{timerDisplay}</span>
		</div>
		<div class="session-info">
			Lifting Order - {data.competition?.groupInfo || 'Session'} - {allAthletes.filter(a => a.snatch1 || a.snatch2 || a.snatch3 || a.cleanJerk1 || a.cleanJerk2 || a.cleanJerk3).length} attempts done.
		</div>
	</header>

	<!-- Main Scoreboard Table -->
	<main class="main">
		{#if data.status === 'waiting'}
			<div class="waiting">
				<p>Waiting for competition data...</p>
			</div>
		{:else}
			<table class="scoreboard-table">
				<thead>
					<tr>
						<th class="col-start" rowspan="2">Start</th>
						<th class="col-name" rowspan="2">Name</th>
						<th class="col-cat" rowspan="2">Cat.</th>
						<th class="col-born" rowspan="2">Born</th>
						<th class="col-team" rowspan="2">Team</th>
						<th class="v-spacer" rowspan="2"></th>
						<th class="col-lift-group" colspan="4">Snatch</th>
						<th class="v-spacer" rowspan="2"></th>
						<th class="col-lift-group" colspan="4">Clean&Jerk</th>
						<th class="v-spacer" rowspan="2"></th>
						<th class="col-total" rowspan="2">Total</th>
						<th class="col-rank" rowspan="2">Rank</th>
					</tr>
					<tr>
						<th class="col-attempt">1</th>
						<th class="col-attempt">2</th>
						<th class="col-attempt">3</th>
						<th class="col-best">✓</th>
						<th class="col-attempt">1</th>
						<th class="col-attempt">2</th>
						<th class="col-attempt">3</th>
						<th class="col-best">✓</th>
					</tr>
				</thead>
				<tbody>
					{#each allAthletes as athlete}
						{#if athlete.isSpacer}
							<!-- Spacer row for category separation -->
							<tr class="spacer">
								<td colspan="18">&nbsp;</td>
							</tr>
						{:else}
							<tr 
								class:current={athlete.classname && athlete.classname.includes('current')}
								class:next={athlete.classname && athlete.classname.includes('next')}
							>
								<td class="start-num">{athlete.startNumber}</td>
								<td class="name">{athlete.fullName}</td>
								<td class="cat">{athlete.category || ''}</td>
								<td class="born">{athlete.yearOfBirth || ''}</td>
								<td class="team-name">{athlete.teamName || ''}</td>
								
								<!-- Vertical spacer before Snatch -->
								<td class="v-spacer"></td>
								
								<!-- Snatch attempts -->
								<td class="attempt {getAttemptClass(athlete.sattempts?.[0])}">{displayAttempt(athlete.sattempts?.[0])}</td>
								<td class="attempt {getAttemptClass(athlete.sattempts?.[1])}">{displayAttempt(athlete.sattempts?.[1])}</td>
								<td class="attempt {getAttemptClass(athlete.sattempts?.[2])}">{displayAttempt(athlete.sattempts?.[2])}</td>
								<td class="best">{athlete.bestSnatch || '-'}</td>
								
								<!-- Vertical spacer before Clean & Jerk -->
								<td class="v-spacer"></td>
								
								<!-- Clean & Jerk attempts -->
								<td class="attempt {getAttemptClass(athlete.cattempts?.[0])}">{displayAttempt(athlete.cattempts?.[0])}</td>
								<td class="attempt {getAttemptClass(athlete.cattempts?.[1])}">{displayAttempt(athlete.cattempts?.[1])}</td>
								<td class="attempt {getAttemptClass(athlete.cattempts?.[2])}">{displayAttempt(athlete.cattempts?.[2])}</td>
								<td class="best">{athlete.bestCleanJerk || '-'}</td>
								
								<!-- Vertical spacer before Total -->
								<td class="v-spacer"></td>
								
								<td class="total">{athlete.total || '-'}</td>
								<td class="rank">{athlete.totalRank || '-'}</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
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
	
	/* Header - Current Lifter */
	.header {
		background: #000;
		padding: 0.75rem 1.5rem;
		border-bottom: 0.125rem solid #333;
	}
	
	.lifter-info {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 0.25rem;
	}
	
	.start-number {
		background: #dc2626; /* Red background */
		color: #fff;
		padding: 0.5rem 1rem;
		font-size: 1.5rem;
		font-weight: bold;
		border-radius: 0.25rem;
		text-align: center;
		min-width: 3rem;
	}
	
	.lifter-name {
		font-size: 1.5rem;
		font-weight: bold;
		color: #fff;
		flex: 1;
	}
	
	.team {
		font-size: 1.5rem; /* Same as lifter name */
		font-weight: bold;
		color: #ccc;
	}
	
	.attempt-label {
		font-size: 1.5rem; /* Same as lifter name */
		font-weight: bold;
		color: #aaa;
	}
	
	.weight {
		font-size: 1.5rem;
		font-weight: bold;
		color: #4ade80;
	}
	
	.timer {
		font-size: 1.8rem;
		font-weight: bold;
		color: #fbbf24;
		background: #1a1a1a;
		padding: 0.4rem 1rem;
		border-radius: 0.25rem;
		min-width: 5rem;
		text-align: center;
	}
	
	.timer.running {
		color: #4ade80;
	}
	
	.timer.warning {
		color: #fbbf24;
		animation: pulse 0.5s infinite;
	}
	
	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.7; }
	}
	
	.session-info {
		font-size: 0.9rem;
		color: #888;
	}
	
	/* Main Table */
	.main {
		flex: 1;
		overflow-y: auto;
		padding: 8px; /* Fixed black margin around table */
		background: #000; /* Black background for margin */
	}
	
	.scoreboard-table {
		width: 100%;
		border-collapse: separate; /* Changed from collapse to allow border-spacing */
		border-spacing: 0;
		font-size: 1.1rem;
	}
	
	.scoreboard-table thead {
		background: #3a3a3a;
		position: sticky;
		top: 0;
		z-index: 10;
	}
	
	.scoreboard-table thead tr {
		background: #3a3a3a;
	}
	
	.scoreboard-table th {
		padding: 0.4rem 0.3rem;
		text-align: center;
		font-weight: bold;
		border: 1px solid #555;
		color: #fff !important;
		background: #3a3a3a !important;
		font-size: 1rem;
	}
	
	.col-lift-group {
		background: #2a2a2a !important;
		font-size: 1.1rem;
		padding: 0.5rem 0.3rem;
	}
	
	.scoreboard-table td {
		padding: 0.375rem 0.25rem;
		text-align: center;
		border: 1px solid #444;
		background: #1a1a1a;
		font-size: 1.1rem;
	}
	
	/* Column widths - responsive */
	.col-start { min-width: 3rem; }
	.col-name { min-width: 11rem; text-align: left; }
	.col-cat { min-width: 3.75rem; }
	.col-born { min-width: 3.5rem; }
	.col-team { min-width: 5.5rem; }
	.col-attempt { min-width: 2.5rem; }
	.col-best { min-width: 2.75rem; }
	.col-total { min-width: 3.5rem; }
	.col-rank { min-width: 3rem; }
	
	/* Vertical spacer columns */
	.v-spacer {
		width: 8px;
		min-width: 8px;
		max-width: 8px;
		padding: 0 !important;
		background: #000 !important;
		border: none !important;
	}
	
	/* Ensure v-spacer in header also has black background */
	.scoreboard-table thead th.v-spacer {
		background: #000 !important;
	}
	
	/* Spacer rows for category separation */
	.scoreboard-table tbody tr.spacer {
		height: 8px;
		background: #000 !important;
	}
	
	.scoreboard-table tbody tr.spacer td {
		padding: 0;
		height: 8px;
		line-height: 0;
		font-size: 0;
		background: #000 !important;
		border: none;
	}
	
	/* Current lifter highlight (green) */
	.scoreboard-table tbody tr.current {
		background: inherit !important;
	}
	
	/* Only highlight the athlete info columns (Start, Name, Cat, Born, Team) */
	.scoreboard-table tbody tr.current td.start-num,
	.scoreboard-table tbody tr.current td.name,
	.scoreboard-table tbody tr.current td.cat,
	.scoreboard-table tbody tr.current td.born,
	.scoreboard-table tbody tr.current td.team-name {
		background: #22c55e !important;
		color: #000 !important;
		font-weight: bold !important;
	}
	
	/* Next lifter highlight (orange) */
	.scoreboard-table tbody tr.next {
		background: inherit !important;
	}
	
	.scoreboard-table tbody tr.next td.start-num,
	.scoreboard-table tbody tr.next td.name,
	.scoreboard-table tbody tr.next td.cat,
	.scoreboard-table tbody tr.next td.born,
	.scoreboard-table tbody tr.next td.team-name {
		background: #f97316 !important;
		color: #000 !important;
		font-weight: bold !important;
	}
	
	/* Attempt cells */
	.attempt {
		font-weight: bold;
	}
	
	.attempt.empty {
		background: #4a4a4a !important;
		color: #aaa;
	}
	
	.attempt.success {
		background: #fff !important;
		color: #000;
	}
	
	.attempt.failed {
		background: #dc2626 !important;
		color: #fff;
	}
	
	.best {
		background: #2a2a2a !important;
		font-weight: bold;
		color: #fff;
	}
	
	.total {
		background: #2a2a2a !important;
		font-weight: bold;
		font-size: 1rem;
		color: #fff !important;
	}
	
	.rank {
		background: #2a2a2a !important;
		color: #fff !important;
	}
	
	/* Name column - left aligned */
	.name {
		text-align: left !important;
		font-weight: bold;
		padding-left: 0.625rem;
	}
	
	.start-num {
		font-weight: bold;
		color: #fbbf24;
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
</style>
