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
	const unsubscribe = timer.subscribe((state) => {
		timerState = state;
	});

	// Language is handled server-side via data.headers
	// No client-side translation needed

	onMount(() => {
		timer.start(data.timer);
	});

	onDestroy(() => {
		timer.stop();
		unsubscribe();
	});

	$: currentAttempt = data.currentAttempt;
	$: teams = data.teams || [];
	$: showPredicted = data.options?.showPredicted ?? true;
	$: scoringSystem = data.options?.scoringSystem || 'Sinclair';
	// Default to hidden until data arrives (prevents flash of attempt bar on page load)
	$: attemptBarClass = data.attemptBarClass ?? 'hide-because-null-session';

	// Sync timer with server when data changes
	$: if (data.timer) {
		timer.syncWithServer(data.timer);
	}

	// liftStatus values from hub can be used directly as CSS classes:
	// 'good', 'bad', 'current', 'next', 'request', 'empty'
	function getAttemptClass(attempt) {
		return attempt?.liftStatus || 'empty';
	}

	function displayAttempt(attempt) {
		if (!attempt) return '\u00A0';
		
		let val = attempt.stringValue;
		// Treat '0' as '-'
		if (val === '0') val = '-';
		
		if (!val || val === '') return '\u00A0';
		
		// If value is '-', only show it if it's a failed lift (bad)
		if (val === '-') {
			if (attempt.liftStatus === 'bad') return '-';
			return '\u00A0';
		}

		if (attempt.liftStatus === 'empty') return '\u00A0';
		const sanitized = val.replace(/[()]/g, '');
		return attempt.liftStatus === 'bad' ? `(${sanitized})` : sanitized;
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
		// For TeamPoints scoring, display as integer (no decimals)
		// Use floor to truncate tiebreaker decimals (0.1 per 1st, 0.01 per 2nd, etc.)
		if (scoringSystem === 'TeamPoints') {
			return num > 0 ? String(Math.floor(num)) : '-';
		}
		// For other scoring systems, display with 2 decimals
		return num > 0 ? num.toFixed(2) : '-';
	}

	// Format score for display - uses precomputed isDefinitiveZero flag from backend
	function formatScoreDisplay(value, isDefinitiveZero = false) {
		const num = parseFormattedNumber(value);
		// For TeamPoints scoring, display as integer (no decimals)
		// Use floor to truncate tiebreaker decimals
		if (scoringSystem === 'TeamPoints') {
			if (num > 0) return String(Math.floor(num));
			if (isDefinitiveZero && num === 0) return '0';
			return '-';
		}
		// For other scoring systems, display with 2 decimals
		if (num > 0) return num.toFixed(2);
		if (isDefinitiveZero && num === 0) return '0.00';
		return '-';
	}

</script>

<script context="module">
// Helper: only render flag images when they are not data: placeholders
export function shouldRenderFlag(url) {
	if (!url) return false;
	if (typeof url === 'string' && url.startsWith('data:image/')) return false;
	return true;
}
</script>

<svelte:head>
	<title>{data.scoreboardName || 'Team Competition'} - {data.competition?.name || 'OWLCMS'}</title>
</svelte:head>

<div class="scoreboard">
	<div class="session-header-wrapper {attemptBarClass}">
		<CurrentAttemptBar 
			currentAttempt={data.currentAttempt}
				timerData={data.timer}
				breakTimerData={data.breakTimer}
				displayMode={data.displayMode || 'none'}
				decisionState={data.decision}
				scoreboardName={data.scoreboardName}
				sessionStatus={data.sessionStatus}
				competition={data.competition}
				breakTitle={data.breakTitle}
				showDecisionLights={true}
				showTimer={true}
				compactMode={true}
				showLifterInfo={data.attemptBarClass === 'hidden' ? false : (data.options?.currentAttemptInfo ?? true)}
				translations={{
					session: data.headers?.session || 'Session',
					snatch: data.headers?.snatch || 'Snatch',
					noAthleteLifting: data.headers?.noAthleteLifting || 'No athlete currently lifting'
				}}
			/>
		</div>

	<!-- Context menu disabled for DOM inspection -->

	<main class="main">
		{#if data.status === 'waiting'}
			<div class="waiting"><p>{data.headers?.waitingForData || data.message || 'Waiting for competition data...'}</p></div>
		{:else if data.hideHeaders}
			<!-- Minimal UI: show only the attempt bar (rendered above main), hide table headers -->
			<div class="waiting-for-session"></div>
		{:else}
			<div class="scoreboard-grid" class:compact-team-column={data.compactTeamColumn} class:hide-predicted={!showPredicted} role="grid" tabindex="0">
				<div class="grid-row header header-primary" role="row" tabindex="0">
					<div class="cell header col-start span-two" role="columnheader">{data.headers?.order || 'Order'}</div>
					<div class="cell header col-name span-two" role="columnheader">{data.headers?.name || 'Name'}</div>
					<div class="cell header col-cat span-two" role="columnheader">{data.headers?.category || 'Cat.'}</div>
					<div class="cell header col-born span-two" role="columnheader">{data.headers?.birth || 'Born'}</div>
					<div class="cell header col-team span-two" role="columnheader">{data.headers?.team || 'Team'}</div>
					<div class="cell header v-spacer v-spacer-snatch span-two" aria-hidden="true"></div>
					<div class="cell header col-group col-group-snatch" role="columnheader">{data.headers?.snatch || 'Snatch'}</div>
					<div class="cell header v-spacer v-spacer-middle span-two" aria-hidden="true"></div>
					<div class="cell header col-group col-group-cj" role="columnheader">{data.headers?.cleanJerk || 'Clean & Jerk'}</div>
					<div class="cell header v-spacer v-spacer-total span-two" aria-hidden="true"></div>
					<div class="cell header col-total span-two" role="columnheader">{data.headers?.total || 'Total'}</div>
					<div class="cell header col-score span-two" role="columnheader">{data.headers?.score || 'Score'}</div>
					<div class="cell header v-spacer v-spacer-next span-two" aria-hidden="true"></div>
					<div class="cell header col-next-total span-two" role="columnheader">{data.headers?.totalNextS || 'Total Next S'}</div>
					<div class="cell header col-next-score span-two" role="columnheader">{data.headers?.scoreNextS || 'Score Next S'}</div>
				</div>
				<div class="grid-row header header-secondary" role="row" tabindex="0">
					<div class="cell header col-name-portrait" role="columnheader">{data.headers?.name || 'Name'}</div>
					<div class="cell header v-spacer v-spacer-snatch" aria-hidden="true"></div>
					<div class="cell header col-attempt snatch-1" role="columnheader">1</div>
					<div class="cell header col-attempt snatch-2" role="columnheader">2</div>
					<div class="cell header col-attempt snatch-3" role="columnheader">3</div>
					<div class="cell header col-best snatch-best" role="columnheader">{data.headers?.best || '✔'}</div>
					<div class="cell header v-spacer v-spacer-middle" aria-hidden="true"></div>
					<div class="cell header col-attempt cj-1" role="columnheader">1</div>
					<div class="cell header col-attempt cj-2" role="columnheader">2</div>
					<div class="cell header col-attempt cj-3" role="columnheader">3</div>
					<div class="cell header col-best cj-best" role="columnheader">{data.headers?.best || '✔'}</div>
					<div class="cell header v-spacer v-spacer-total" aria-hidden="true"></div>
					<div class="cell header col-total-portrait" role="columnheader">{data.headers?.total || 'Total'}</div>
					<div class="cell header col-score-portrait" role="columnheader">{data.headers?.score || 'Score'}</div>
					<div class="cell header v-spacer v-spacer-next" aria-hidden="true"></div>
					<div class="cell header col-next-total-portrait" role="columnheader">{data.headers?.totalNextS || 'NEXT S'}</div>
					<div class="cell header col-next-score-portrait" role="columnheader">{data.headers?.scoreNextS || 'NEXT S'}</div>
				</div>

				{#if teams.length > 0}
					<div class="grid-row team-spacer top-spacer" aria-hidden="true">
						<div class="cell span-all"></div>
					</div>
				{/if}


			{#each teams as team}
				<div class="grid-row team-header" role="row">
					<div class="cell team-name-header" role="gridcell">
						{#if shouldRenderFlag(team.flagUrl)}
							<img src={team.flagUrl} alt={team.teamName} class="team-flag" />
						{/if}
						<span class="team-name-text">{team.teamName}</span>
					</div>
					<div class="cell team-stats" role="gridcell">{team.totalLabel}</div>
					<div class="cell team-score" role="gridcell">{formatScore(team.teamScore)}</div>
					<div class="cell team-gap" aria-hidden="true"></div>
					<div class="cell team-next-total" role="gridcell">&nbsp;</div>
					<div class="cell team-next-score" role="gridcell">{formatScore(team.teamNextScore)}</div>
				</div>
				{#each team.athletes as athlete}
							<div
							class="grid-row data-row team-athlete"
							class:current={athlete.classname && athlete.classname.includes('current')}
							class:next={athlete.classname && athlete.classname.includes('next')}
							role="row"
						>
							<div class="cell start-num" role="gridcell">{athlete.inCurrentSession ? (athlete.liftingOrder ?? '') : ''}</div>
							<div class="cell name" role="gridcell"><span class="name-text">{athlete.fullName}</span></div>
							<div class="cell cat" role="gridcell">{athlete.category || ''}</div>
							<div class="cell born" role="gridcell">{athlete.yearOfBirth || ''}</div>
							<div class="cell team-name" role="gridcell"><span class="team-name-text">{athlete.teamName || ''}</span></div>
							<div class="cell v-spacer" aria-hidden="true"></div>
							<div class="cell attempt {getAttemptClass(athlete.sattempts?.[0])}" role="gridcell"><span class="attempt-value">{displayAttempt(athlete.sattempts?.[0])}</span></div>
							<div class="cell attempt {getAttemptClass(athlete.sattempts?.[1])}" role="gridcell"><span class="attempt-value">{displayAttempt(athlete.sattempts?.[1])}</span></div>
							<div class="cell attempt {getAttemptClass(athlete.sattempts?.[2])}" role="gridcell"><span class="attempt-value">{displayAttempt(athlete.sattempts?.[2])}</span></div>
							<div class="cell best" role="gridcell">{athlete.bestSnatch || '-'}</div>
							<div class="cell v-spacer" aria-hidden="true"></div>
							<div class="cell attempt {getAttemptClass(athlete.cattempts?.[0])}" role="gridcell"><span class="attempt-value">{displayAttempt(athlete.cattempts?.[0])}</span></div>
							<div class="cell attempt {getAttemptClass(athlete.cattempts?.[1])}" role="gridcell"><span class="attempt-value">{displayAttempt(athlete.cattempts?.[1])}</span></div>
							<div class="cell attempt {getAttemptClass(athlete.cattempts?.[2])}" role="gridcell"><span class="attempt-value">{displayAttempt(athlete.cattempts?.[2])}</span></div>
							<div class="cell best" role="gridcell">{athlete.bestCleanJerk || '-'}</div>
						<div class="cell v-spacer" aria-hidden="true"></div>
						<div class="cell total" role="gridcell">{athlete.displayTotal ?? '-'}</div>
						<div class="cell score {athlete.scoreHighlightClass || ''}" role="gridcell">
							{scoringSystem === 'TeamPoints' ? athlete.displayTeamPoints : athlete.displayScore}
						</div>
					<div class="cell v-spacer" aria-hidden="true"></div>
					<div class="cell next-total" role="gridcell">{athlete.nextTotal ? athlete.nextTotal : '-'}</div>
					<div class="cell next-score {athlete.nextScoreHighlightClass || ''}" role="gridcell">
						{scoringSystem === 'TeamPoints' ? athlete.displayTeamPoints : athlete.displayNextScore}
					</div>
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

	.session-header-wrapper.hidden {
		display: none !important;
		visibility: hidden;
		height: 0;
		overflow: hidden;
		padding: 0;
		margin: 0;
	}

	.session-header-wrapper.hide-because-null-session {
		display: none !important;
		visibility: hidden;
		height: 0;
		overflow: hidden;
		padding: 0;
		margin: 0;
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
		--col-team-min: 0;
		--col-team-max: 0;
		--col-team: 0;
		--col-gap: var(--grid-gap-size);
		--col-attempt: 4.4rem;
		--col-best: 4.4rem;
		--col-total: 4.9rem;
		--col-score: 12ch;
		--col-next-total: 5.9rem;
		--col-next-score: 12ch;
		/* Header row heights: calculated to match session-results */
		--header-primary-vpad: 0.2rem; /* vertical padding for primary header cells */
		--header-primary-height: calc(1rem + (var(--header-primary-vpad) * 2));
		--header-secondary-vpad: 0.2rem; /* vertical padding used in secondary header cells */
		--header-secondary-height: calc(1rem + (var(--header-secondary-vpad) * 2));
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
			var(--col-score)
			var(--col-gap)
			var(--col-next-total)
			var(--col-next-score);
		grid-template-rows: var(--header-primary-height) var(--header-secondary-height) var(--template-rows);
		row-gap: 0;
		font-size: 1.2rem;
		line-height: 1;
	}

	.scoreboard-grid.compact-team-column {
		--col-team-min: 0;
		--col-team-max: 0;
		--col-team: 0;
	}

	/* Hide predicted total columns when showPredicted is false */
	.scoreboard-grid.hide-predicted {
		--col-next-total: 0;
		--col-next-score: 0;
	}

	.scoreboard-grid.hide-predicted .v-spacer-next,
	.scoreboard-grid.hide-predicted .col-next-total,
	.scoreboard-grid.hide-predicted .col-next-score,
	.scoreboard-grid.hide-predicted .col-next-total-portrait,
	.scoreboard-grid.hide-predicted .col-next-score-portrait,
	.scoreboard-grid.hide-predicted .next-total,
	.scoreboard-grid.hide-predicted .next-score,
	.scoreboard-grid.hide-predicted .team-gap,
	.scoreboard-grid.hide-predicted .team-next-total,
	.scoreboard-grid.hide-predicted .team-next-score {
		visibility: hidden;
		width: 0;
		padding: 0;
		border: none;
		overflow: hidden;
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
		align-self: stretch;
		padding: var(--header-primary-vpad) 0.15rem;
		min-height: 0;
	}

	.header-primary > .cell.span-two { grid-row: 1 / span 2; }

	.header-secondary > .cell {
		grid-row: 2;
		font-size: 1rem;
		padding: var(--header-secondary-vpad) 0.15rem;
		min-height: 0;
	}

	.col-group { justify-content: center; font-size: 1.1rem; }
	.span-two { align-self: stretch; }

	/* Center Next S column headers */
	.header-primary .col-next-total,
	.header-primary .col-next-score {
		justify-content: center;
		text-align: center;
	}

	.cell.v-spacer { background: #000; border: none; padding: 0; }
	.cell.span-all { grid-column: 1 / -1; }

	.cell.name,
	.cell.team-name {
		justify-content: flex-start;
		padding-left: 0.625rem;
		text-align: left;
		min-width: 0;
	}

	.cell.name .name-text {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
		flex: 1;
	}

	.cell.team-name .team-name-text {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
		flex: 1;
	}

	.cell.cat { justify-content: center; padding: 0; text-align: center; white-space: nowrap; }
	.cell.start-num { font-weight: bold; color: #fbbf24; }
	.cell.col-team { visibility: hidden; width: 0; padding: 0; border: none; }

	.cell.best,
	.cell.total,
	.cell.score,
	.cell.next-total,
	.cell.next-score { font-weight: bold; color: #fff; }

	.grid-row.current > .start-num,
	.grid-row.current > .name { color: #4ade80 !important; font-weight: bold; }

	.grid-row.next > .start-num,
	.grid-row.next > .name { color: #f97316 !important; font-weight: bold; }

	.attempt { font-weight: bold; white-space: nowrap; padding: 0 0.35rem; }
	.header-secondary .col-attempt { white-space: nowrap; padding: 0 0.35rem; }
	/* liftStatus values from hub: 'good', 'bad', 'current', 'next', 'request', 'empty' */
	.attempt.empty { background: transparent; color: #aaa !important; }
	.attempt.request { background: transparent; color: #aaa !important; }
	.attempt.good { background: #fff !important; color: #000; }
	.attempt.bad { background: darkred !important; color: #fff; }
	.attempt.next { background: transparent; color: #f97316 !important; }

	/* Current attempt - highlighted and blinking (text only) */
	.attempt.current {
		background: transparent;
		color: #4ade80 !important;
		font-weight: bold !important;
	}

	.attempt.current .attempt-value {
		animation: blink-text 2s ease-in-out infinite;
	}

	@keyframes blink-text {
		0%, 49% { opacity: 1; }
		50%, 100% { opacity: 0; }
	}

	/* Data row grid column positioning */
	.grid-row.data-row > .start-num { grid-column: 1; }
	.grid-row.data-row > .name { grid-column: 2; }
	.grid-row.data-row > .cat { grid-column: 3; }
	.grid-row.data-row > .born { grid-column: 4; }
	.grid-row.data-row > .team-name { grid-column: 5; visibility: hidden; width: 0; padding: 0; border: none; }
	.grid-row.data-row > .v-spacer:nth-of-type(1) { grid-column: 6; }
	.grid-row.data-row > .attempt:nth-of-type(1) { grid-column: 7; }
	.grid-row.data-row > .attempt:nth-of-type(2) { grid-column: 8; }
	.grid-row.data-row > .attempt:nth-of-type(3) { grid-column: 9; }
	.grid-row.data-row > .best:nth-of-type(1) { grid-column: 10; }
	.grid-row.data-row > .v-spacer:nth-of-type(2) { grid-column: 11; }
	.grid-row.data-row > .attempt:nth-of-type(4) { grid-column: 12; }
	.grid-row.data-row > .attempt:nth-of-type(5) { grid-column: 13; }
	.grid-row.data-row > .attempt:nth-of-type(6) { grid-column: 14; }
	.grid-row.data-row > .best:nth-of-type(2) { grid-column: 15; }
	.grid-row.data-row > .v-spacer:nth-of-type(3) { grid-column: 16; }
	.grid-row.data-row > .total { grid-column: 17; }
	.grid-row.data-row > .score { grid-column: 18; }
	.grid-row.data-row > .v-spacer:nth-of-type(4) { grid-column: 19; }
	.grid-row.data-row > .next-total { grid-column: 20; }
	.grid-row.data-row > .next-score { grid-column: 21; }

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
	.grid-row.team-header > .team-name-header { grid-column: 1 / span 5; justify-content: flex-start; font-size: 1.6rem; text-shadow: 1px 1px 2px rgba(0,0,0,0.7); border-left: 8px solid #4a5568; display: flex; align-items: center; gap: 0.75rem; overflow: visible; white-space: nowrap; }
	.grid-row.team-header > .team-name-header .team-flag { height: 1.5rem; max-width: 2rem; object-fit: contain; border: 1px solid white; }
	.grid-row.team-header > .team-name-header .team-name-text { flex: 1; min-width: 0; white-space: nowrap; overflow: visible; }

	/* Hide any data: URI flags (legacy placeholders) */
	.team-flag[src^="data:image/"] { display: none; }
	.grid-row.team-header > .team-stats { grid-column: 6 / 18; justify-content: flex-end; font-size: 0.95rem; color: #cbd5e0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
	.grid-row.team-header > .team-score { grid-column: 18; justify-content: center; font-size: 1.4rem; font-weight: bold; background: #1b5e20 !important; color: #fff; border: none !important; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.grid-row.team-header > .team-gap { grid-column: 19; background: #000; border: none; padding: 0; }
	.grid-row.team-header > .team-next-total { grid-column: 20; justify-content: center; font-size: 1.4rem; font-weight: bold; background: #4a5568 !important; color: #fff; border: none !important; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.grid-row.team-header > .team-next-score { grid-column: 21; justify-content: center; font-size: 1.4rem; font-weight: bold; border-right: 8px solid #4a5568; background: #831843 !important; color: #fff; border: none !important; border-right: 8px solid #4a5568 !important; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

	/* Highlight athlete scores that contribute to team score */
	/* Single gender mode or MF mode male contributors */
	.grid-row.data-row > .score.top-contributor,
	.grid-row.data-row > .score.top-contributor-m { background: #1b5e20 !important; color: #fff !important; font-weight: bold; }
	.grid-row.data-row > .next-score.top-contributor,
	.grid-row.data-row > .next-score.top-contributor-m { background: #831843 !important; color: #fff !important; font-weight: bold; }

	/* MF mode: lighter highlight colors for female contributors */
	.grid-row.data-row > .score.top-contributor-f { background: #57a05a !important; color: #fff !important; font-weight: bold; }
	.grid-row.data-row > .next-score.top-contributor-f { background: #c06da0 !important; color: #fff !important; font-weight: bold; }

	.grid-row.team-athlete > .cell:first-of-type { border-left: 8px solid #4a5568 !important; }
	.grid-row.team-athlete > .cell:last-of-type { border-right: 8px solid #4a5568 !important; }
	.grid-row.team-athlete > .cell { border-top: none; border-bottom: none; }

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
	.header-primary .v-spacer-next { grid-column: 19; }
	.header-primary .col-next-total { grid-column: 20; }
	.header-primary .col-next-score { grid-column: 21; }

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
	.header-secondary .v-spacer-next { grid-column: 19; }
	.header-secondary .col-next-total-portrait { grid-column: 20; }
	.header-secondary .col-next-score-portrait { grid-column: 21; }

	.header-secondary .col-name-portrait,
	.header-secondary .col-total-portrait,
	.header-secondary .col-score-portrait,
	.header-secondary .col-next-total-portrait,
	.header-secondary .col-next-score-portrait { visibility: hidden; pointer-events: none; padding: 0; height: 0; border: none; }
	.header-secondary .v-spacer { background: #000; border: none; height: 0; padding: 0; }

	/* Responsive adjustments for landscape mode */
	/* iPad landscape and 1366x768: Moderate reduction */
	@media (max-width: 1366px) and (orientation: landscape) {
		.main { --grid-gap-size: 0.55rem; }
		
		.scoreboard-grid {
			--col-start: 4.5rem;
			--col-name: minmax(12rem, 2.3fr);
			--col-cat: 12ch;
			--col-born: 12ch;
			--col-attempt: 4rem;
			--col-best: 4rem;
			--col-total: 4.5rem;
			--col-score: 11ch;
			--col-next-total: 5.5rem;
			--col-next-score: 11ch;
		}

		/* Tighter layout when predictions are shown to fit all columns */
		.scoreboard-grid:not(.hide-predicted) {
			--col-start: 3.5rem;
			--col-name: minmax(9rem, 1.8fr);
			--col-cat: 9ch;
			--col-born: 5ch;
			--col-attempt: 3.2rem;
			--col-best: 3.2rem;
			--col-total: 3.8rem;
			--col-score: 8ch;
			--col-next-total: 4.5rem;
			--col-next-score: 8ch;
		}

		.scoreboard-grid:not(.hide-predicted) .cell {
			font-size: 1rem;
		}

		.scoreboard-grid:not(.hide-predicted) .grid-row.team-header > .team-name-header {
			font-size: 1.3rem;
		}

		.scoreboard-grid:not(.hide-predicted) .grid-row.team-header > .team-score,
		.scoreboard-grid:not(.hide-predicted) .grid-row.team-header > .team-next-total,
		.scoreboard-grid:not(.hide-predicted) .grid-row.team-header > .team-next-score {
			font-size: 1.1rem;
		}

		.cell {
			font-size: 1.15rem;
		}

		.grid-row.team-header > .team-name-header {
			font-size: 1.5rem;
		}

		.grid-row.team-header > .team-score,
		.grid-row.team-header > .team-next-total,
		.grid-row.team-header > .team-next-score {
			font-size: 1.3rem;
		}

		.grid-row.team-header > .team-stats {
			font-size: 0.9rem;
		}
	}

	/* 720p (1280x720) and iPad Mini landscape: Tighter layout */
	@media (max-width: 1280px) and (orientation: landscape) {
		.main { --grid-gap-size: 0.5rem; }
		
		.scoreboard-grid {
			--col-start: 4rem;
			--col-name: minmax(11rem, 2.1fr);
			--col-cat: 10ch;
			--col-born: 10ch;
			--col-attempt: 3.6rem;
			--col-best: 3.6rem;
			--col-total: 4.2rem;
			--col-score: 10ch;
			--col-next-total: 5.2rem;
			--col-next-score: 10ch;
		}

		.cell {
			font-size: 1.05rem;
			padding: 0.3rem 0.2rem;
		}

		.header-secondary > .cell {
			font-size: 1rem;
		}

		.col-group {
			font-size: 1.05rem;
		}

		.grid-row.team-header > .team-name-header {
			font-size: 1.4rem;
		}

		.grid-row.team-header > .team-name-header .team-flag {
			height: 1.3rem;
			max-width: 1.8rem;
		}

		.grid-row.team-header > .team-score,
		.grid-row.team-header > .team-next-total,
		.grid-row.team-header > .team-next-score {
			font-size: 1.2rem;
		}

		.grid-row.team-header > .team-stats {
			font-size: 0.85rem;
		}
	}

	/* iPhone XR+ landscape (896x414) and smaller tablets: Compact layout */
	@media (max-width: 926px) and (orientation: landscape) {
		.main { --grid-gap-size: 0.4rem; }
		
		.scoreboard-grid {
			--col-start: 3.5rem;
			--col-name: minmax(9rem, 1.8fr);
			--col-cat: 8ch;
			--col-born: 0; /* Hide birth year on small screens */
			--col-attempt: 3.2rem;
			--col-best: 3.2rem;
			--col-total: 3.8rem;
			--col-score: 9ch;
			--col-next-total: 4.8rem;
			--col-next-score: 9ch;
			--header-primary-height: 2.3rem;
		}

		.cell {
			font-size: 0.95rem;
			padding: 0.25rem 0.15rem;
		}

		.header-secondary > .cell {
			font-size: 0.9rem;
		}

		.col-group {
			font-size: 1rem;
		}

		/* Hide birth year column on small screens */
		.header-primary .col-born,
		.grid-row.data-row > .born {
			display: none;
		}

		.grid-row.team-header > .team-name-header {
			font-size: 1.2rem;
		}

		.grid-row.team-header > .team-name-header .team-flag {
			height: 1.1rem;
			max-width: 1.5rem;
		}

		.grid-row.team-header > .team-score,
		.grid-row.team-header > .team-next-total,
		.grid-row.team-header > .team-next-score {
			font-size: 1.1rem;
		}

		.grid-row.team-header > .team-stats {
			font-size: 0.75rem;
		}

		.grid-row.team-header > .cell {
			padding: 0.25rem 0.4rem;
		}
	}
	
	/* Compact team column for small team sizes (< 7 athletes) */
	.scoreboard-grid.compact-team-column .grid-row.team-header > .team-name-header {
		grid-column: 1 / span 5;
		font-size: 1.4rem;
	}
	
	.scoreboard-grid.compact-team-column .grid-row.team-header > .team-stats {
		grid-column: 6 / 18;
	}
	
	.scoreboard-grid.compact-team-column .grid-row.team-athlete > .team-name {
		max-width: 3rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Context menu for gender selection (right-click on header) */
	.team-context-menu {
		background: #111;
		border: 1px solid #444;
		padding: 0.25rem;
		border-radius: 6px;
		box-shadow: 0 6px 18px rgba(0,0,0,0.6);
		min-width: 6rem;
		display: flex;
		flex-direction: column;
	}

	/* Context menu disabled for DOM inspection */
</style>
