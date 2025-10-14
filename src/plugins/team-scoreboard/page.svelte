<script>
	import { createTimer } from '$lib/timer-logic.js';
	import { onMount, onDestroy } from 'svelte';

	// Props passed from parent route
	export let data = {};

	// Timer state using reusable timer logic
	let timerState = { seconds: 0, isRunning: false, isWarning: false, display: '0:00' };

	// Create timer instance
	const timer = createTimer();
	const unsubscribe = timer.subscribe((state) => {
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
	$: teams = data.teams || [];

	// Sync timer with server when data changes
	$: if (data.timer) {
		timer.syncWithServer(data.timer);
	}

	function getAttemptClass(attempt) {
		if (!attempt || !attempt.liftStatus || attempt.liftStatus === 'empty') return 'empty';
		if (attempt.liftStatus === 'request') return 'request';
		if (attempt.liftStatus === 'fail') return 'failed';
		if (attempt.liftStatus === 'good') return 'success';
		return 'empty';
	}

	function displayAttempt(attempt) {
		if (!attempt || !attempt.stringValue || attempt.stringValue === '') return '-';
		return attempt.stringValue.replace(/[()]/g, '');
	}

	function parseFormattedNumber(value) {
		if (value === null || value === undefined || value === '' || value === '-') return 0;
		if (typeof value === 'number') return value;
		const normalized = String(value).replace(',', '.');
		const parsed = parseFloat(normalized);
		return isNaN(parsed) ? 0 : parsed;
	}

	function formatScore(value) {
		const num = parseFormattedNumber(value);
		return num > 0 ? num.toFixed(2) : '-';
	}
</script>

<svelte:head>
	<title>{data.scoreboardName || 'Team Scoreboard'} - {data.competition?.name || 'OWLCMS'}</title>
</svelte:head>

<div class="scoreboard">
	{#if data.status !== 'waiting'}
	<header class="header">
		<div class="lifter-info">
			<span class="start-number">{currentAttempt?.startNumber || '-'}</span>
			<span class="lifter-name">{currentAttempt?.fullName || 'No athlete currently lifting'}</span>
			<span class="team">{currentAttempt?.teamName || ''}</span>
			<span class="attempt-label">{@html currentAttempt?.attempt || ''}</span>
			<span class="weight">{currentAttempt?.weight || '-'} kg</span>
			<div class="timer"
				class:running={timerState.isRunning}
				class:warning={timerState.isWarning}
			>
				{timerState.display}
			</div>
		</div>
		<div class="session-info">
			{data.scoreboardName || 'Team Scoreboard'} - {@html data.competition?.groupInfo || 'Session'} - {data.competition?.liftsDone || ''}
		</div>
	</header>
	{/if}

	<main class="main">
		{#if data.status === 'waiting'}
			<div class="waiting"><p>{data.message || 'Waiting for competition data...'}</p></div>
		{:else}
			<div class="scoreboard-grid" role="grid">
				<div class="grid-row header header-primary" role="row">
					<div class="cell header col-start span-two" role="columnheader">Start</div>
					<div class="cell header col-name span-two" role="columnheader">Name</div>
					<div class="cell header col-cat span-two" role="columnheader">Cat.</div>
					<div class="cell header col-born span-two" role="columnheader">Born</div>
					<div class="cell header col-team span-two" role="columnheader">Team</div>
					<div class="cell header v-spacer v-spacer-snatch span-two" aria-hidden="true"></div>
					<div class="cell header col-group col-group-snatch" role="columnheader">Snatch</div>
					<div class="cell header v-spacer v-spacer-middle span-two" aria-hidden="true"></div>
					<div class="cell header col-group col-group-cj" role="columnheader">Clean &amp; Jerk</div>
					<div class="cell header v-spacer v-spacer-total span-two" aria-hidden="true"></div>
					<div class="cell header col-total span-two" role="columnheader">Total</div>
					<div class="cell header col-score span-two" role="columnheader">Score</div>
				</div>
				<div class="grid-row header header-secondary" role="row">
					<div class="cell header col-name-portrait" role="columnheader">Name</div>
					<div class="cell header v-spacer v-spacer-snatch" aria-hidden="true"></div>
					<div class="cell header col-attempt snatch-1" role="columnheader">1</div>
					<div class="cell header col-attempt snatch-2" role="columnheader">2</div>
					<div class="cell header col-attempt snatch-3" role="columnheader">3</div>
					<div class="cell header col-best snatch-best" role="columnheader">✓</div>
					<div class="cell header v-spacer v-spacer-middle" aria-hidden="true"></div>
					<div class="cell header col-attempt cj-1" role="columnheader">1</div>
					<div class="cell header col-attempt cj-2" role="columnheader">2</div>
					<div class="cell header col-attempt cj-3" role="columnheader">3</div>
					<div class="cell header col-best cj-best" role="columnheader">✓</div>
					<div class="cell header v-spacer v-spacer-total" aria-hidden="true"></div>
					<div class="cell header col-total-portrait" role="columnheader">Total</div>
					<div class="cell header col-score-portrait" role="columnheader">Score</div>
				</div>

				{#if teams.length > 0}
					<div class="grid-row team-spacer top-spacer" aria-hidden="true">
						<div class="cell span-all"></div>
					</div>
				{/if}

				{#each teams as team}
					<div class="grid-row team-header" role="row">
						<div class="cell team-name-header" role="gridcell">{team.teamName}</div>
						<div class="cell team-stats" role="gridcell">{team.athleteCount} athletes</div>
						<div class="cell team-score" role="gridcell">{formatScore(team.teamScore)}</div>
					</div>

					{#each team.athletes as athlete}
						<div
							class="grid-row data-row team-athlete"
							class:current={athlete.classname && athlete.classname.includes('current')}
							class:next={athlete.classname && athlete.classname.includes('next')}
							role="row"
						>
							<div class="cell start-num" role="gridcell">{athlete.startNumber}</div>
							<div class="cell name" role="gridcell">{athlete.fullName}</div>
							<div class="cell cat" role="gridcell">{athlete.category || ''}</div>
							<div class="cell born" role="gridcell">{athlete.yearOfBirth || ''}</div>
							<div class="cell team-name" role="gridcell">{athlete.teamName || ''}</div>
							<div class="cell v-spacer" aria-hidden="true"></div>
							<div class="cell attempt {getAttemptClass(athlete.sattempts?.[0])} {athlete.sattempts?.[0]?.className || ''}" role="gridcell">{displayAttempt(athlete.sattempts?.[0])}</div>
							<div class="cell attempt {getAttemptClass(athlete.sattempts?.[1])} {athlete.sattempts?.[1]?.className || ''}" role="gridcell">{displayAttempt(athlete.sattempts?.[1])}</div>
							<div class="cell attempt {getAttemptClass(athlete.sattempts?.[2])} {athlete.sattempts?.[2]?.className || ''}" role="gridcell">{displayAttempt(athlete.sattempts?.[2])}</div>
							<div class="cell best" role="gridcell">{athlete.bestSnatch || '-'}</div>
							<div class="cell v-spacer" aria-hidden="true"></div>
							<div class="cell attempt {getAttemptClass(athlete.cattempts?.[0])} {athlete.cattempts?.[0]?.className || ''}" role="gridcell">{displayAttempt(athlete.cattempts?.[0])}</div>
							<div class="cell attempt {getAttemptClass(athlete.cattempts?.[1])} {athlete.cattempts?.[1]?.className || ''}" role="gridcell">{displayAttempt(athlete.cattempts?.[1])}</div>
							<div class="cell attempt {getAttemptClass(athlete.cattempts?.[2])} {athlete.cattempts?.[2]?.className || ''}" role="gridcell">{displayAttempt(athlete.cattempts?.[2])}</div>
							<div class="cell best" role="gridcell">{athlete.bestCleanJerk || '-'}</div>
							<div class="cell v-spacer" aria-hidden="true"></div>
							<div class="cell total" role="gridcell">{athlete.total || '-'}</div>
							<div class="cell score" role="gridcell">{formatScore(athlete.globalScore || athlete.sinclair)}</div>
						</div>
					{/each}

					<div class="grid-row team-spacer" aria-hidden="true">
						<div class="cell span-all"></div>
					</div>
				{/each}
			</div>
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
		background: #dc2626;
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
		font-size: 1.5rem;
		font-weight: bold;
		color: #ccc;
	}

	.attempt-label {
		font-size: 1.5rem;
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

	.timer.running { color: #4ade80; }
	.timer.warning { color: #fbbf24; }

	.session-info {
		font-size: 0.9rem;
		color: #888;
	}

	/* Main grid */
	.main {
		--grid-gap-size: 0.65rem;
		flex: 1;
		overflow-y: auto;
		padding: 8px;
		background: #000;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.scoreboard-grid {
		--col-start: 4.9rem;
		--col-name: minmax(14rem, 2.5fr);
		--col-cat: 14ch;
		--col-born: 14ch;
		--col-team: minmax(8rem, 1.8fr);
		--col-gap: var(--grid-gap-size);
		--col-attempt: 4.4rem;
		--col-best: 4.4rem;
		--col-total: 4.9rem;
		--col-score: 12ch;
		--header-primary-height: 2.6rem;
		--header-secondary-height: 2.3rem;
		display: grid;
		width: 100%;
		flex: 0 0 auto;
		grid-template-columns:
			var(--col-start)
			var(--col-name)
			var(--col-cat)
			var(--col-born)
			var(--col-team)
			var(--col-gap)
			repeat(3, var(--col-attempt))
			var(--col-best)
			var(--col-gap)
			repeat(3, var(--col-attempt))
			var(--col-best)
			var(--col-gap)
			var(--col-total)
			var(--col-score);
		grid-auto-rows: minmax(0, auto);
		row-gap: 0;
		font-size: 1.1rem;
	}

	.grid-row { display: contents; }

	.cell {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.375rem 0.25rem;
		border: 1px solid #444;
		background: #1a1a1a;
		color: #fff;
	}

	.cell.header {
		background: #3a3a3a;
		border-color: #555;
		font-weight: bold;
	}

	.header-primary > .cell.header { text-transform: uppercase; }
	.header-secondary > .cell.header { background: #2a2a2a; }

	.header-primary > .cell {
		grid-row: 1;
		position: sticky;
		top: 0;
		z-index: 20;
		align-self: stretch;
	}

	.header-primary > .cell.span-two { grid-row: 1 / span 2; z-index: 21; }

	.header-secondary > .cell {
		grid-row: 2;
		position: sticky;
		top: calc(var(--header-primary-height) - 1px);
		z-index: 19;
		font-size: 1rem;
	}

	.col-group { justify-content: center; font-size: 1.1rem; }
	.span-two { align-self: stretch; }

	.cell.v-spacer { background: #000; border: none; padding: 0; }
	.cell.span-all { grid-column: 1 / -1; }

	.cell.name,
	.cell.team-name {
		justify-content: flex-start;
		padding-left: 0.625rem;
		text-align: left;
	}

	.cell.cat { justify-content: center; padding: 0; text-align: center; white-space: nowrap; }
	.cell.start-num { font-weight: bold; color: #fbbf24; }

	.cell.best,
	.cell.total,
	.cell.score { background: #2a2a2a; font-weight: bold; color: #fff; }

	.grid-row.current > .start-num,
	.grid-row.current > .name { background: #1a1a1a !important; color: #fbbf24 !important; font-weight: bold; }

	.grid-row.next > .start-num,
	.grid-row.next > .name { background: #1a1a1a !important; color: #f97316 !important; font-weight: bold; }

	.attempt { font-weight: bold; white-space: nowrap; padding: 0 0.35rem; }
	.header-secondary .col-attempt { white-space: nowrap; padding: 0 0.35rem; }
	.attempt.empty { background: #4a4a4a !important; color: #aaa; }
	.attempt.request { background: #4a4a4a !important; color: #ddd; }
	.attempt.success { background: #fff !important; color: #000; }
	.attempt.failed { background: #dc2626 !important; color: #fff; }

	.grid-row.current > .attempt.request.current,
	.grid-row.current > .attempt.request.blink { color: #fbbf24 !important; font-weight: bold !important; font-size: 1.3rem !important; }

	.grid-row.team-header > .cell {
		background: #4a5568 !important;
		border-color: #4a5568 !important;
		color: #fff;
		font-weight: bold;
		padding: 0.3rem 0.6rem;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
		border-top: 4px solid #4a5568;
		border-bottom: 4px solid #4a5568;
	}
	.grid-row.team-header > .team-name-header { grid-column: 1 / span 5; justify-content: flex-start; font-size: 1.6rem; text-shadow: 1px 1px 2px rgba(0,0,0,0.7); border-left: 8px solid #4a5568; }
	.grid-row.team-header > .team-stats { grid-column: 6 / 18; justify-content: flex-start; font-size: 0.95rem; color: #cbd5e0; }
	.grid-row.team-header > .team-score { grid-column: 18; justify-content: center; font-size: 1.6rem; border-right: 8px solid #4a5568; }

	.grid-row.team-athlete > .cell:first-of-type { border-left: 8px solid #4a5568 !important; }
	.grid-row.team-athlete > .cell:last-of-type { border-right: 8px solid #4a5568 !important; }
	.grid-row.team-athlete > .cell { border-top: 1px solid #444; border-bottom: 1px solid #444; }

	.grid-row.team-spacer > .cell { grid-column: 1 / -1; background: #000; border: none; height: calc(var(--grid-gap-size) * 2.4); padding: 0; border-top: 8px solid #4a5568; }
	.grid-row.team-spacer.top-spacer > .cell { height: var(--grid-gap-size); border-top: none; }

	.waiting { display: flex; align-items: center; justify-content: center; height: 100%; font-size: 1.5rem; color: #888; }

	.main::-webkit-scrollbar { width: 0.625rem; }
	.main::-webkit-scrollbar-track { background: #000; }
	.main::-webkit-scrollbar-thumb { background: #333; border-radius: 0.3125rem; }
	.main::-webkit-scrollbar-thumb:hover { background: #555; }

	/* Column positioning for headers */
	.header-primary .col-start { grid-column: 1; }
	.header-primary .col-name { grid-column: 2; }
	.header-primary .col-cat { grid-column: 3; }
	.header-primary .col-born { grid-column: 4; }
	.header-primary .col-team { grid-column: 5; }
	.header-primary .v-spacer-snatch { grid-column: 6; }
	.header-primary .col-group-snatch { grid-column: 7 / span 4; }
	.header-primary .v-spacer-middle { grid-column: 11; }
	.header-primary .col-group-cj { grid-column: 12 / span 4; }
	.header-primary .v-spacer-total { grid-column: 16; }
	.header-primary .col-total { grid-column: 17; }
	.header-primary .col-score { grid-column: 18; }

	.header-secondary .col-name-portrait { grid-column: 2; }
	.header-secondary .v-spacer-snatch { grid-column: 6; }
	.header-secondary .snatch-1 { grid-column: 7; }
	.header-secondary .snatch-2 { grid-column: 8; }
	.header-secondary .snatch-3 { grid-column: 9; }
	.header-secondary .snatch-best { grid-column: 10; }
	.header-secondary .v-spacer-middle { grid-column: 11; }
	.header-secondary .cj-1 { grid-column: 12; }
	.header-secondary .cj-2 { grid-column: 13; }
	.header-secondary .cj-3 { grid-column: 14; }
	.header-secondary .cj-best { grid-column: 15; }
	.header-secondary .v-spacer-total { grid-column: 16; }
	.header-secondary .col-total-portrait { grid-column: 17; }
	.header-secondary .col-score-portrait { grid-column: 18; }

	.header-secondary .col-name-portrait,
	.header-secondary .col-total-portrait,
	.header-secondary .col-score-portrait { visibility: hidden; pointer-events: none; padding: 0; height: 0; border: none; }
	.header-secondary .v-spacer { background: #000; border: none; height: 0; padding: 0; }

	@media (max-width: 1160px) {
		.main { --grid-gap-size: 0.55rem; }
		.scoreboard-grid {
			--col-name: minmax(12rem, 2.2fr);
			--col-team: minmax(7rem, 1.6fr);
			--col-cat: 12ch;
			--col-born: 12ch;
			--col-attempt: 3.8rem;
			--col-best: 3.8rem;
			--col-total: 4.5rem;
			--col-score: 12ch;
		}
	}

	@media (max-width: 932px) {
		.main { --grid-gap-size: 0.45rem; }
		.header { padding: 0.19rem; font-size: 0.49rem; }
		.session-info { display: none; }
		.lifter-name, .team, .attempt-label, .weight { font-size: 1.125rem; }
		.timer { font-size: 1.125rem; padding: 0.3rem 0.75rem; min-width: 3.75rem; }
		.start-number { font-size: 1.125rem; padding: 0.15rem 0.25rem; min-width: 2.25rem; }
		.scoreboard-grid {
			--col-name: minmax(10.5rem, 2fr);
			--col-team: minmax(6rem, 1.4fr);
			--col-attempt: 3.4rem;
			--col-best: 3.4rem;
			--col-born: 0;
			--col-score: 12ch;
			--header-primary-height: 2.5rem;
		}
		.cell { font-size: 0.95rem; padding: 0.25rem 0.2rem; }
		.header-secondary > .cell { font-size: 0.9rem; }
		.header-primary .col-born, .grid-row.data-row > .born { display: none; }
		.grid-row.team-header > .team-stats { font-size: 0.85rem; }
	}

	@media (max-width: 932px) and (orientation: portrait) {
		.header { font-size: 0.75rem; }
		.lifter-info { gap: 0.3rem; line-height: 1.1; }
		.lifter-info .team { display: none; }
		.timer { font-size: 1.4rem; }
		.start-number { font-size: 0.75rem; padding: 0.2rem 0.3rem; }
		.main { --grid-gap-size: 0.3rem; }
		.scoreboard-grid { --col-start: 0; --col-cat: 0; --col-team: 0; --col-best: 0; --col-attempt: 2.75rem; --header-primary-height: 2.3rem; }
		.header-primary .col-start,
		.grid-row.data-row > .start-num,
		.header-primary .col-cat,
		.grid-row.data-row > .cat,
		.header-primary .col-team,
		.grid-row.data-row > .team-name { display: none; }
		.grid-row.data-row > .best { display: none; }
		.header-secondary .col-name-portrait,
		.header-secondary .col-total-portrait,
		.header-secondary .col-score-portrait { visibility: visible; pointer-events: auto; height: auto; padding: 0.12rem 0.2rem; border: 1px solid #555; }
		.header-secondary .col-name-portrait { text-align: left; }
		.grid-row.team-header > .team-name-header { grid-column: 2 / 12; border-left-width: 0; font-size: 1.2rem; }
		.grid-row.team-header > .team-stats { grid-column: 12 / 18; font-size: 0.8rem; }
		.grid-row.team-header > .team-score { grid-column: 18; font-size: 1.2rem; border-right-width: 0; }
		.grid-row.team-athlete > .cell:first-of-type { border-left-width: 4px !important; }
		.grid-row.team-athlete > .cell:last-of-type { border-right-width: 4px !important; }
	}
</style>
