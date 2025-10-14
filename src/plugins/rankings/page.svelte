<script>
	import { createTimer } from '$lib/timer-logic.js';
	import { onMount, onDestroy } from 'svelte';
	
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
	$: allAthletes = data.sortedAthletes || [];  // Standardized field name across all scoreboards
	$: decisionState = data.decision || {};
	
	// Sync timer with server when data changes
	$: if (data.timer) {
		timer.syncWithServer(data.timer);
	}
	
	// Helper to get attempt status color from OWLCMS liftStatus
	function getAttemptClass(attempt) {
		if (!attempt || !attempt.liftStatus || attempt.liftStatus === 'empty' || attempt.liftStatus === 'request') {
			return 'empty';
		}
		if (attempt.liftStatus === 'fail') return 'failed';
		if (attempt.liftStatus === 'good') return 'success';
		return 'empty';
	}

	function getRefereeClass(value) {
		if (value === 'good') return 'good';
		if (value === 'bad') return 'bad';
		return 'pending';
	}
	
	// Helper to display attempt value from OWLCMS stringValue
	function displayAttempt(attempt) {
		if (!attempt || !attempt.stringValue || attempt.stringValue === '') return '-';
		// Remove parentheses from failed attempts (OWLCMS sends "(62)" for failed 62kg)
		return attempt.stringValue.replace(/[()]/g, '');
	}
</script>

<svelte:head>
	<title>{data.scoreboardName || 'Scoreboard'} - {data.competition?.name || 'OWLCMS'}</title>
</svelte:head>

<div class="scoreboard">
	<!-- Current Lifter Header (only show when we have data) -->
	{#if data.status !== 'waiting'}
	<header class="header">
		<div class="lifter-info">
			{#if data.sessionStatus?.isDone}
			<span class="lifter-name">{data.sessionStatusMessage || 'Session Done.'}</span>
			{:else}
			<span class="start-number">{currentAttempt?.startNumber || '-'}</span>
			<span class="lifter-name">{currentAttempt?.fullName || 'No athlete currently lifting'}</span>
			<span class="team">{currentAttempt?.teamName || ''}</span>
			<span class="attempt-label">{@html currentAttempt?.attempt || ''}</span>
			<span class="weight">{currentAttempt?.weight || '-'} kg</span>
			<div class="timer-decision-container">
				<div 
					class="timer-slot"
					class:visible={!decisionState?.visible && data.timer?.isActive}
					class:running={timerState.isRunning}
					class:warning={timerState.isWarning}
				>
					<span class="timer-display">{timerState.display}</span>
				</div>
				<div class="decision-slot" class:visible={decisionState?.visible}>
					<div class="decision-lights" aria-label="Referee decisions">
						{#if !decisionState?.isSingleReferee}
							<div class="referee-light {getRefereeClass(decisionState?.ref1)}"></div>
						{/if}
						<div class="referee-light {getRefereeClass(decisionState?.ref2)}"></div>
						{#if !decisionState?.isSingleReferee}
							<div class="referee-light {getRefereeClass(decisionState?.ref3)}"></div>
						{/if}
					</div>
				</div>
			</div>
			{/if}
		</div>
		<div class="session-info">
			{#if data.sessionStatus?.isDone}
				{@html '&nbsp;'}
			{:else}
				{data.scoreboardName || 'Scoreboard'} - {@html data.competition?.groupInfo || 'Session'} - {data.competition?.liftsDone || ''}
			{/if}
		</div>
	</header>
	{/if}

	<!-- Main Scoreboard Table -->
	<main class="main">
		{#if data.status === 'waiting'}
			<div class="waiting">
				<p>{data.message || 'Waiting for competition data...'}</p>
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
						<th class="col-lift-group snatch-header" colspan="4">Snatch</th>
						<th class="v-spacer" rowspan="2"></th>
						<th class="col-lift-group cj-header" colspan="4">Clean&Jerk</th>
						<th class="v-spacer" rowspan="2"></th>
						<th class="col-total" rowspan="2">Total</th>
						<th class="col-rank" rowspan="2">Rank</th>
					</tr>
					<tr>
						<th class="col-attempt col-name-portrait">Name</th>
						<th class="v-spacer v-spacer-snatch"></th>
						<th class="col-attempt">1</th>
						<th class="col-attempt">2</th>
						<th class="col-attempt">3</th>
						<th class="col-best">✓</th>
						<th class="v-spacer v-spacer-middle"></th>
						<th class="col-attempt">1</th>
						<th class="col-attempt">2</th>
						<th class="col-attempt">3</th>
						<th class="col-best">✓</th>
						<th class="v-spacer v-spacer-total"></th>
						<th class="col-total-portrait">Total</th>
						<th class="col-rank-portrait">Rank</th>
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
								<td class="v-spacer v-spacer-snatch"></td>
								
								<!-- Snatch attempts -->
								<td class="attempt {getAttemptClass(athlete.sattempts?.[0])}">{displayAttempt(athlete.sattempts?.[0])}</td>
								<td class="attempt {getAttemptClass(athlete.sattempts?.[1])}">{displayAttempt(athlete.sattempts?.[1])}</td>
								<td class="attempt {getAttemptClass(athlete.sattempts?.[2])}">{displayAttempt(athlete.sattempts?.[2])}</td>
								<td class="best">{athlete.bestSnatch || '-'}</td>
								
								<!-- Vertical spacer before Clean & Jerk -->
								<td class="v-spacer v-spacer-middle"></td>
								
								<!-- Clean & Jerk attempts -->
								<td class="attempt {getAttemptClass(athlete.cattempts?.[0])}">{displayAttempt(athlete.cattempts?.[0])}</td>
								<td class="attempt {getAttemptClass(athlete.cattempts?.[1])}">{displayAttempt(athlete.cattempts?.[1])}</td>
								<td class="attempt {getAttemptClass(athlete.cattempts?.[2])}">{displayAttempt(athlete.cattempts?.[2])}</td>
								<td class="best">{athlete.bestCleanJerk || '-'}</td>
								
								<!-- Vertical spacer before Total -->
								<td class="v-spacer v-spacer-total"></td>
								
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
	

	.timer-decision-container {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		width: 9rem;
		min-width: 9rem;
		height: 2.5rem;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.timer-slot,
	.decision-slot {
		display: none;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		border-radius: 0.25rem;
		padding: 0.35rem 0.75rem;
	}

	.timer-slot {
		background: #1a1a1a;
		color: #fbbf24;
		font-weight: bold;
	}

	.timer-slot.visible {
		display: flex;
	}

	.timer-slot.running {
		color: #4ade80;
	}

	.timer-slot.warning {
		color: #fbbf24;
		background: rgba(239, 68, 68, 0.2);
	}

	.timer-display {
		font-size: 1.5rem;
		font-family: 'Courier New', monospace;
		letter-spacing: 2px;
	}

	.decision-slot {
		background: rgba(26, 26, 26, 0.95);
	}

	.decision-slot.visible {
		display: flex;
	}

	.decision-lights {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.referee-light {
		width: 2.2rem;
		height: 2.2rem;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.1);
		border: 2px solid rgba(255, 255, 255, 0.2);
	}

	.referee-light.good {
		background: #ffffff;
		border-color: #ffffff;
	}

	.referee-light.bad {
		background: #dc2626;
		border-color: #dc2626;
	}

	.referee-light.pending {
		background: rgba(255, 255, 255, 0.1);
		border-color: rgba(255, 255, 255, 0.2);
	}
	
	.session-info {
		font-size: 1.2rem;
		color: #ccc;
		font-weight: bold;
		padding: 0.25rem 0;
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

	/* Hide portrait-only headers in landscape/desktop - completely remove from table flow */
	thead tr:nth-child(2) th.col-name-portrait,
	thead tr:nth-child(2) th.col-total-portrait,
	thead tr:nth-child(2) th.col-rank-portrait,
	thead tr:nth-child(2) th.v-spacer-snatch,
	thead tr:nth-child(2) th.v-spacer-middle,
	thead tr:nth-child(2) th.v-spacer-total {
		display: none;
		position: absolute;
		visibility: hidden;
		width: 0;
		height: 0;
		padding: 0;
		margin: 0;
		border: none;
	}
	
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

	/* Mobile responsive styles */
	
	/* Small screens - tablet and phone */
	@media (max-width: 932px) {
		.header {
			padding: 0.19rem;
			font-size: 0.49rem;
		}

		/* Hide the session info line on mobile */
		.session-info {
			display: none;
		}

		/* Current attempt section - reduce athlete info by 25% */
		.lifter-name,
		.team,
		.attempt-label,
		.weight {
			font-size: 1.125rem; /* 25% smaller than 1.5rem */
		}

		/* Make timer and start number match the new size */
		.timer-slot {
			min-width: 3.75rem;
		}

		.timer-display {
			font-size: 1.125rem; /* Match athlete info size */
		}

		.start-number {
			font-size: 1.125rem; /* Match athlete info size */
			padding: 0.15rem 0.25rem;
		min-width: 2.25rem;
	}

	/* Current athlete info - more compact */
	.current-athlete {
		padding: 0.2rem;
		font-size: 0.45rem;
		line-height: 1.1;
	}

	.scoreboard-table {
		font-size: 0.8rem;
		line-height: 1.3;
		font-weight: normal;
	}		.scoreboard-table th,
		.scoreboard-table td {
			padding: 0.08rem 0.17rem;
			line-height: 1.3;
			font-weight: normal;
		}

		/* Apply font size to all table body cells */
		.scoreboard-table tbody td {
			font-size: 0.8rem;
		}

		.scoreboard-table th {
			font-size: 0.44rem;
			padding: 0.13rem 0.17rem;
			font-weight: normal;
		}

		.scoreboard-table tbody tr {
			height: auto;
		}

		/* Make start number use same font size as rest of table */
		.scoreboard-table td.start-num {
			font-size: 0.8rem;
			padding: 0.05rem 0.15rem;
		}

		/* Hide born column on mobile - both header and data */
		.scoreboard-table th.col-born,
		.scoreboard-table td.born {
			display: none;
		}
	}

	/* Portrait phone - hide category, born, team, and rank columns */
	@media (max-width: 932px) and (orientation: portrait) {
		/* Larger fonts for portrait since we have more vertical space */
		.header {
			font-size: 0.75rem;
		}

		/* Hide team from current lifter info */
		.lifter-info .team {
			display: none;
		}

		/* Reduce spacing in lifter info */
		.lifter-info {
			gap: 0.3rem;
			line-height: 1.1;
		}

		.timer-display {
			font-size: 1.4rem;
		}

		.start-number {
			font-size: 0.75rem;
			padding: 0.2rem 0.3rem;
		}

		.scoreboard-table {
			font-size: 0.35rem;
			width: 100%;
			table-layout: auto;
		}

		.scoreboard-table th {
			font-size: 0.5rem;
		}

		.scoreboard-table th,
		.scoreboard-table td {
			padding: 0.12rem 0.2rem;
		}

		.scoreboard-table td.start-num {
			font-size: 0.65rem;
		}

		/* Hide the entire first header row (has colspan issues) */
		.scoreboard-table thead tr:first-child {
			display: none !important;
		}

		/* Show only the second header row with attempt numbers */
		.scoreboard-table thead tr:nth-child(2) {
			display: table-row !important;
		}

		/* Show portrait-only headers (Name and Total) - override desktop hiding */
		.scoreboard-table thead tr:nth-child(2) th.col-name-portrait,
		.scoreboard-table thead tr:nth-child(2) th.col-total-portrait,
		.scoreboard-table thead tr:nth-child(2) th.col-rank-portrait {
			display: table-cell !important;
			position: static !important;
			visibility: visible !important;
			width: auto !important;
			height: auto !important;
			font-size: 0.5rem;
			text-align: left;
			padding: 0.12rem 0.2rem !important;
			margin: 0 !important;
			border: 1px solid #555 !important;
		}

		.scoreboard-table th.col-name-portrait {
			min-width: 25%;
		}

		/* Adjust table for portrait - hide best columns which effectively changes colspan */
		
		/* Hide columns to save horizontal space */
		.scoreboard-table th.col-start,
		.scoreboard-table td.start-num,
		.scoreboard-table th.col-cat,
		.scoreboard-table td.cat,
		.scoreboard-table th.col-born,
		.scoreboard-table td.born,
		.scoreboard-table th.col-team,
		.scoreboard-table td.team-name,
		.scoreboard-table th.col-best,
		.scoreboard-table td.best {
			display: none !important;
			width: 0 !important;
			padding: 0 !important;
			margin: 0 !important;
			border: none !important;
		}

		/* Hide ALL spacer columns except the three we want to show */
		.scoreboard-table th.v-spacer:not(.v-spacer-snatch):not(.v-spacer-middle):not(.v-spacer-total),
		.scoreboard-table td.v-spacer:not(.v-spacer-snatch):not(.v-spacer-middle):not(.v-spacer-total) {
			display: none !important;
			width: 0 !important;
			padding: 0 !important;
			margin: 0 !important;
			border: none !important;
		}

		/* Show the three spacers: before snatch, between Snatch and C&J, before Total */
		.scoreboard-table thead tr:nth-child(2) th.v-spacer-snatch,
		.scoreboard-table td.v-spacer-snatch,
		.scoreboard-table thead tr:nth-child(2) th.v-spacer-middle,
		.scoreboard-table td.v-spacer-middle,
		.scoreboard-table thead tr:nth-child(2) th.v-spacer-total,
		.scoreboard-table td.v-spacer-total {
			display: table-cell !important;
			position: static !important;
			visibility: visible !important;
			width: 8px !important;
			min-width: 8px !important;
			max-width: 8px !important;
			height: auto !important;
			padding: 0 !important;
			margin: 0 !important;
			background: #000 !important;
			border: none !important;
		}

		/* Make Name column take available space */
		.scoreboard-table th.col-name,
		.scoreboard-table td.name {
			width: auto;
			min-width: 25%;
			max-width: 40%;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	}
</style>
