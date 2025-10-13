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
	$: teams = data.teams || [];  // Array of team objects
	
	// Helper to parse formatted numbers (handles decimal comma and dash)
	function parseFormattedNumber(value) {
		if (value === null || value === undefined || value === '' || value === '-') {
			return 0;
		}
		if (typeof value === 'number') {
			return value;
		}
		// Convert string: replace comma with period, then parse
		const normalized = String(value).replace(',', '.');
		const parsed = parseFloat(normalized);
		return isNaN(parsed) ? 0 : parsed;
	}
	
	// Helper to format score for display
	function formatScore(value) {
		const num = parseFormattedNumber(value);
		return num > 0 ? num.toFixed(2) : '-';
	}
	
	// Sync timer with server when data changes
	$: if (data.timer) {
		timer.syncWithServer(data.timer);
	}
	
	// Helper to get attempt status color from OWLCMS liftStatus
	function getAttemptClass(attempt) {
		if (!attempt || !attempt.liftStatus || attempt.liftStatus === 'empty') {
			return 'empty';
		}
		if (attempt.liftStatus === 'request') return 'request';
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
	<title>Team Scoreboard - {data.competition?.name || 'OWLCMS'}</title>
</svelte:head>

<div class="scoreboard">
	<!-- Current Lifter Header (conditionally shown) -->
	{#if data.options?.currentAttemptInfo && data.status !== 'waiting'}
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
				<span class="timer" class:running={timerState.isRunning} class:warning={timerState.isWarning}>{timerState.display}</span>
				{/if}
			</div>
			<div class="session-info">
				{#if data.sessionStatus?.isDone}
					{@html '&nbsp;'}
				{:else}
					Team Scoreboard - {data.competition?.groupInfo || 'Session'} - {allAthletes.filter(a => a.snatch1 || a.snatch2 || a.snatch3 || a.cleanJerk1 || a.cleanJerk2 || a.cleanJerk3).length} attempts done.
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
						<th class="col-score" rowspan="2">Score</th>
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
						<th class="col-score-portrait">Score</th>
					</tr>
				</thead>
				<tbody>
					{#each teams as team, teamIndex}
						<!-- Spacer row before first team -->
						{#if teamIndex === 0}
							<tr class="team-spacer">
								<td colspan="18">&nbsp;</td>
							</tr>
						{/if}
						
						<!-- Team header row -->
						<tr class="team-header">
							<td colspan="2" class="team-name-header">{team.teamName}</td>
							<td colspan="3" class="team-stats">{team.athleteCount} athletes</td>
							<td class="v-spacer v-spacer-snatch"></td>
						<td colspan="4"></td>
						<td class="v-spacer v-spacer-middle"></td>
						<td colspan="4"></td>
						<td class="v-spacer v-spacer-total"></td>
						<td></td>
						<td class="team-score">{formatScore(team.teamScore)}</td>
					</tr>						<!-- Athletes in this team -->
						{#each team.athletes as athlete}
							<tr 
								class="team-athlete"
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
								<td class="attempt {getAttemptClass(athlete.sattempts?.[0])} {athlete.sattempts?.[0]?.className || ''}">{displayAttempt(athlete.sattempts?.[0])}</td>
								<td class="attempt {getAttemptClass(athlete.sattempts?.[1])} {athlete.sattempts?.[1]?.className || ''}">{displayAttempt(athlete.sattempts?.[1])}</td>
								<td class="attempt {getAttemptClass(athlete.sattempts?.[2])} {athlete.sattempts?.[2]?.className || ''}">{displayAttempt(athlete.sattempts?.[2])}</td>
								<td class="best">{athlete.bestSnatch || '-'}</td>
								
								<!-- Vertical spacer before Clean & Jerk -->
								<td class="v-spacer v-spacer-middle"></td>
								
								<!-- Clean & Jerk attempts -->
								<td class="attempt {getAttemptClass(athlete.cattempts?.[0])} {athlete.cattempts?.[0]?.className || ''}">{displayAttempt(athlete.cattempts?.[0])}</td>
								<td class="attempt {getAttemptClass(athlete.cattempts?.[1])} {athlete.cattempts?.[1]?.className || ''}">{displayAttempt(athlete.cattempts?.[1])}</td>
								<td class="attempt {getAttemptClass(athlete.cattempts?.[2])} {athlete.cattempts?.[2]?.className || ''}">{displayAttempt(athlete.cattempts?.[2])}</td>
								<td class="best">{athlete.bestCleanJerk || '-'}</td>
								
							<!-- Vertical spacer before Total -->
							<td class="v-spacer v-spacer-total"></td>
							
							<td class="total">{athlete.total || '-'}</td>
							<td class="score">
								{formatScore(athlete.globalScore || athlete.sinclair)}
							</td>
						</tr>
					{/each}						<!-- Spacer row after each team (including last) -->
						<tr class="team-spacer">
							<td colspan="18">&nbsp;</td>
						</tr>
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
	}
	
	.session-info {
		font-size: 0.9rem;
		color: #888;
	}
	
	/* Main Table */
	.main {
		flex: 1;
		overflow-y: auto;
		padding: 32px; /* Increased padding around scoreboard */
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
	.col-score { min-width: 3rem; }

	/* Hide portrait-only headers in landscape/desktop - completely remove from table flow */
	thead tr:nth-child(2) th.col-name-portrait,
	thead tr:nth-child(2) th.col-total-portrait,
	thead tr:nth-child(2) th.col-score-portrait,
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
	
	/* Team header row */
	.scoreboard-table tbody tr.team-header {
		background: #4a5568 !important; /* Medium gray background */
		border-top: 4px solid #4a5568; /* Thick border same color as header */
		border-bottom: 4px solid #4a5568; /* Thick border same color as header */
		border-left: 4px solid #4a5568; /* Thick border same color as header */
		border-right: 4px solid #4a5568; /* Thick border same color as header */
		box-shadow: 0 2px 4px rgba(0,0,0,0.3);
	}
	
	.scoreboard-table tbody tr.team-header td {
		padding: 0.2rem 0.5rem;
		font-weight: bold;
		font-size: 1.2rem;
		color: #fff;
		background: inherit !important; /* Inherit the lighter gray from the row */
		border-color: #4a5568 !important; /* Match header color for unified look */
	}
	
	.scoreboard-table tbody tr.team-header td.team-name-header {
		font-size: 1.6rem;
		color: #fff; /* White color for team name */
		text-shadow: 1px 1px 2px rgba(0,0,0,0.7);
	}
	
	.scoreboard-table tbody tr.team-header td.team-stats {
		font-size: 0.95rem;
		color: #cbd5e0; /* Light gray for stats */
	}
	
	.scoreboard-table tbody tr.team-header td.team-score {
		font-size: 1.6rem;
		color: #fff; /* White for team score total */
		text-align: center;
		font-weight: bold;
	}
	
	/* Team athlete rows - add side borders to complete team block */
	.scoreboard-table tbody tr.team-athlete {
		border-left: 8px solid #4a5568; /* Extra thick side border */
		border-right: 8px solid #4a5568; /* Extra thick side border */
	}
	
	/* Apply thick borders to first and last cells in athlete rows */
	.scoreboard-table tbody tr.team-athlete td:first-child {
		border-left: 8px solid #4a5568 !important;
	}
	
	.scoreboard-table tbody tr.team-athlete td:last-child {
		border-right: 8px solid #4a5568 !important;
	}
	
	/* Team spacer row - thick border on top closes the team block */
	.scoreboard-table tbody tr.team-spacer {
		height: 48px;
		background: #000 !important;
		border-top: 8px solid #4a5568; /* Thick top border to close team block */
	}
	
	/* First spacer (before first team) should not have top border */
	.scoreboard-table tbody tr.team-spacer:first-child {
		border-top: none;
	}
	
	.scoreboard-table tbody tr.team-spacer td {
		padding: 0;
		height: 48px;
		line-height: 0;
		font-size: 0;
		background: #000 !important;
		border-left: none;
		border-right: none;
		border-bottom: none;
		border-top: 8px solid #4a5568 !important; /* Thick top border to close team block */
	}
	
	/* First spacer td should not have top border */
	.scoreboard-table tbody tr.team-spacer:first-child td {
		border-top: none !important;
	}
	
	/* Current lifter highlight (green) */
	.scoreboard-table tbody tr.current {
		background: inherit !important;
	}
	
	/* Only highlight start number and name for current athlete */
	.scoreboard-table tbody tr.current td.start-num,
	.scoreboard-table tbody tr.current td.name {
		background: #1a1a1a !important; /* Same as normal cells */
		color: #fbbf24 !important; /* Yellow font */
		font-weight: bold !important;
	}
	
	/* Next lifter highlight (orange) */
	.scoreboard-table tbody tr.next {
		background: inherit !important;
	}
	
	/* Only highlight start number and name for next athlete */
	.scoreboard-table tbody tr.next td.start-num,
	.scoreboard-table tbody tr.next td.name {
		background: #1a1a1a !important; /* Same as normal cells */
		color: #f97316 !important; /* Bright orange font */
		font-weight: bold !important;
	}
	
	/* Highlight current athlete's CURRENT requested weight (has className with "current") */
	.scoreboard-table tbody tr.current td.attempt.request.current,
	.scoreboard-table tbody tr.current td.attempt.request.blink {
		color: #fbbf24 !important; /* Yellow for current requested weight */
		font-weight: bold !important;
		font-size: 1.3rem !important;
	}
	
	/* Attempt cells */
	.attempt {
		font-weight: bold;
	}
	
	.attempt.empty {
		background: #4a4a4a !important;
		color: #aaa;
	}
	
	.attempt.request {
		background: #4a4a4a !important;
		color: #ddd; /* Default color for request */
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
	
	.score {
		background: #2a2a2a !important;
		color: #fff !important; /* White for score */
		font-weight: bold;
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
		.timer {
			font-size: 1.125rem; /* Match athlete info size */
			padding: 0.3rem 0.75rem;
			min-width: 3.75rem;
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

		.timer {
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

		/* Show portrait-only headers (Name, Total, Score) - override desktop hiding */
		.scoreboard-table thead tr:nth-child(2) th.col-name-portrait,
		.scoreboard-table thead tr:nth-child(2) th.col-total-portrait,
		.scoreboard-table thead tr:nth-child(2) th.col-score-portrait {
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
