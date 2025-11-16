<script>
	import { createTimer } from '$lib/timer-logic.js';
	import { translations } from '$lib/stores.js';
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

	// Current translations object (populated from store)
	let t = {};
	const unsubscribeTranslations = translations.subscribe(trans => {
		t = trans.en || {};
	});

	onMount(() => {
		timer.start(data.timer);
	});

	onDestroy(() => {
		timer.stop();
		unsubscribe();
		unsubscribeTranslations();
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

	function isLotInList(list, lotNumber) {
		if (!Array.isArray(list)) return false;
		if (lotNumber === undefined || lotNumber === null) return false;
		const normalized = String(lotNumber).trim();
		if (!normalized) return false;
		return list.includes(normalized);
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
	<title>{data.scoreboardName || 'NVF Lagkonkurranse'} - {data.competition?.name || 'OWLCMS'}</title>
</svelte:head>

<div class="scoreboard">
	{#if data.status !== 'waiting'}
		<CurrentAttemptBar 
			currentAttempt={data.currentAttempt}
			timerState={timerState}
			decisionState={{}}
			scoreboardName={data.scoreboardName}
			sessionStatus={data.sessionStatus}
			competition={data.competition}
			showDecisionLights={false}
			showTimer={true}
			compactMode={true}
		/>
	{/if}

	<main class="main">
		{#if data.status === 'waiting'}
			<div class="waiting"><p>{data.message || 'Waiting for competition data...'}</p></div>
		{:else}
			<div class="scoreboard-grid" class:compact-team-column={data.compactTeamColumn} role="grid">
				<div class="grid-row header header-primary" role="row">
					<div class="cell header col-start span-two" role="columnheader">{t.Order || t.Start || 'Order'}</div>
					<div class="cell header col-name span-two" role="columnheader">{t.Name || 'Name'}</div>
					<div class="cell header col-cat span-two" role="columnheader">{t.Category || 'Cat.'}</div>
					<div class="cell header col-born span-two" role="columnheader">{t.Birth || 'Born'}</div>
					<div class="cell header col-team span-two" role="columnheader">{t.Team || 'Team'}</div>
					<div class="cell header v-spacer v-spacer-snatch span-two" aria-hidden="true"></div>
					<div class="cell header col-group col-group-snatch" role="columnheader">{t.Snatch || 'Snatch'}</div>
					<div class="cell header v-spacer v-spacer-middle span-two" aria-hidden="true"></div>
					<div class="cell header col-group col-group-cj" role="columnheader">{t.Clean_and_Jerk || 'Clean & Jerk'}</div>
					<div class="cell header v-spacer v-spacer-total span-two" aria-hidden="true"></div>
					<div class="cell header col-total span-two" role="columnheader">{t.TOTAL || 'Total'}</div>
					<div class="cell header col-score span-two" role="columnheader">{t.Score || 'Score'}</div>
					<div class="cell header v-spacer v-spacer-next span-two" aria-hidden="true"></div>
					<div class="cell header col-next-total span-two" role="columnheader">{t.TOTAL || 'Total'}<br/>Next S</div>
					<div class="cell header col-next-score span-two" role="columnheader">{t.Score || 'Score'}<br/>Next S</div>
				</div>
				<div class="grid-row header header-secondary" role="row">
					<div class="cell header col-name-portrait" role="columnheader">{t.Name || 'Name'}</div>
					<div class="cell header v-spacer v-spacer-snatch" aria-hidden="true"></div>
					<div class="cell header col-attempt snatch-1" role="columnheader">1</div>
					<div class="cell header col-attempt snatch-2" role="columnheader">2</div>
					<div class="cell header col-attempt snatch-3" role="columnheader">3</div>
					<div class="cell header col-best snatch-best" role="columnheader">{t.Best || '✔'}</div>
					<div class="cell header v-spacer v-spacer-middle" aria-hidden="true"></div>
					<div class="cell header col-attempt cj-1" role="columnheader">1</div>
					<div class="cell header col-attempt cj-2" role="columnheader">2</div>
					<div class="cell header col-attempt cj-3" role="columnheader">3</div>
					<div class="cell header col-best cj-best" role="columnheader">{t.Best || '✔'}</div>
					<div class="cell header v-spacer v-spacer-total" aria-hidden="true"></div>
					<div class="cell header col-total-portrait" role="columnheader">{t.TOTAL || 'Total'}</div>
					<div class="cell header col-score-portrait" role="columnheader">{t.Score || 'Score'}</div>
					<div class="cell header v-spacer v-spacer-next" aria-hidden="true"></div>
					<div class="cell header col-next-total-portrait" role="columnheader">NEXT S</div>
					<div class="cell header col-next-score-portrait" role="columnheader">NEXT S</div>
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
						{team.teamName}
					</div>
					<div class="cell team-stats" role="gridcell">{team.athleteCount}</div>
					<div class="cell team-total" role="gridcell">&nbsp;</div>
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
						<div class="cell total" role="gridcell">{athlete.displayTotal ?? '-'}</div>
						<div class="cell score" class:in-top4-current={isLotInList(team.top4CurrentLotNumbers, athlete.lotNumber)} role="gridcell">{formatScore(athlete.globalScore || athlete.sinclair)}</div>
					<div class="cell v-spacer" aria-hidden="true"></div>
					<div class="cell next-total" role="gridcell">{athlete.nextTotal ? athlete.nextTotal : '-'}</div>
					<div class="cell next-score" class:in-top4-predicted={isLotInList(team.top4PredictedLotNumbers, athlete.lotNumber)} role="gridcell">{athlete.nextScore ? formatScore(athlete.nextScore) : '-'}</div>
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
		--col-team-min: 8rem;
		--col-team-max: 1.8fr;
		--col-team: minmax(var(--col-team-min), var(--col-team-max));
		--col-gap: var(--grid-gap-size);
		--col-attempt: 4.4rem;
		--col-best: 4.4rem;
		--col-total: 4.9rem;
		--col-score: 12ch;
		--col-next-total: 4.9rem;
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
		font-size: 1.1rem;
		line-height: 1;
	}

	.scoreboard-grid.compact-team-column {
		--col-team-min: 5rem;
		--col-team-max: 5rem;
		--col-team: 5rem;
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
	.cell.score,
	.cell.next-total,
	.cell.next-score { font-weight: bold; color: #fff; }

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

	/* Data row grid column positioning */
	.grid-row.data-row > .start-num { grid-column: 1; }
	.grid-row.data-row > .name { grid-column: 2; }
	.grid-row.data-row > .cat { grid-column: 3; }
	.grid-row.data-row > .born { grid-column: 4; }
	.grid-row.data-row > .team-name { grid-column: 5; }
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
	.grid-row.team-header > .team-name-header { grid-column: 1 / span 5; justify-content: flex-start; font-size: 1.6rem; text-shadow: 1px 1px 2px rgba(0,0,0,0.7); border-left: 8px solid #4a5568; display: flex; align-items: center; gap: 0.75rem; }
	.grid-row.team-header > .team-name-header .team-flag { height: 1.5rem; max-width: 2rem; object-fit: contain; }

	/* Hide any data: URI flags (legacy placeholders) */
	.team-flag[src^="data:image/"] { display: none; }
	.grid-row.team-header > .team-stats { grid-column: 6 / 17; justify-content: flex-start; font-size: 0.95rem; color: #cbd5e0; }
	.grid-row.team-header > .team-total { grid-column: 17; justify-content: center; font-size: 1.4rem; font-weight: bold; background: #4a5568 !important; color: #fff; border: none !important; }
	.grid-row.team-header > .team-score { grid-column: 18; justify-content: center; font-size: 1.4rem; font-weight: bold; background: #1b5e20 !important; color: #fff; border: none !important; }
	.grid-row.team-header > .team-gap { grid-column: 19; background: #000; border: none; padding: 0; }
	.grid-row.team-header > .team-next-total { grid-column: 20; justify-content: center; font-size: 1.4rem; font-weight: bold; background: #4a5568 !important; color: #fff; border: none !important; }
	.grid-row.team-header > .team-next-score { grid-column: 21; justify-content: center; font-size: 1.4rem; font-weight: bold; border-right: 8px solid #4a5568; background: #831843 !important; color: #fff; border: none !important; border-right: 8px solid #4a5568 !important; }

	/* Highlight athlete scores that contribute to team score */
	.grid-row.data-row > .score.in-top4-current { background: #1b5e20 !important; color: #fff !important; font-weight: bold; }
	.grid-row.data-row > .next-score.in-top4-predicted { background: #831843 !important; color: #fff !important; font-weight: bold; }

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

	@media (max-width: 1160px) {
		.main { --grid-gap-size: 0.55rem; }
		.scoreboard-grid {
			--col-name: minmax(12rem, 2.2fr);
			--col-team-min: 7rem;
			--col-team-max: 1.6fr;
			--col-cat: 12ch;
			--col-born: 12ch;
			--col-attempt: 3.8rem;
			--col-best: 3.8rem;
			--col-total: 4.5rem;
			--col-score: 12ch;
			--col-next-total: 4.5rem;
			--col-next-score: 12ch;
		}
		.scoreboard-grid.compact-team-column {
			--col-team-min: 5rem;
			--col-team-max: 5rem;
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
			--col-team-min: 6rem;
			--col-team-max: 1.4fr;
			--col-attempt: 3.4rem;
			--col-best: 3.4rem;
			--col-born: 0;
			--col-score: 12ch;
			--col-next-total: 4.2rem;
			--col-next-score: 11ch;
			--header-primary-height: 2.5rem;
		}
		.scoreboard-grid.compact-team-column {
			--col-team-min: 5rem;
			--col-team-max: 5rem;
		}
		.cell { font-size: 0.95rem; padding: 0.25rem 0.2rem; }
		.header-secondary > .cell { font-size: 0.9rem; }
		.header-primary .col-born, .grid-row.data-row > .born { display: none; }
		.grid-row.team-header > .team-stats { font-size: 0.85rem; }
	}

	@media (max-width: 932px) and (orientation: portrait) {
		.header { font-size: 0.75rem; }
		.lifter-info { gap: 0.3rem; line-height: 1.1; }
		.timer { font-size: 1.4rem; }
		.start-number { font-size: 0.75rem; padding: 0.2rem 0.3rem; }
		.main { --grid-gap-size: 0.3rem; }
		.scoreboard-grid { --col-start: 0; --col-cat: 0; --col-team: 0; --col-best: 0; --col-attempt: 2.75rem; --header-primary-height: 2.3rem; }
		.scoreboard-grid.compact-team-column { --col-team: 5rem; }
		.header-primary .col-start,
		.grid-row.data-row > .start-num,
		.header-primary .col-cat,
		.grid-row.data-row > .cat,
		.header-primary .col-team,
		.grid-row.data-row > .team-name { display: none; }
		.grid-row.data-row > .best { display: none; }
		.header-secondary .col-name-portrait,
		.header-secondary .col-total-portrait,
		.header-secondary .col-score-portrait,
		.header-secondary .col-next-total-portrait,
		.header-secondary .col-next-score-portrait { visibility: visible; pointer-events: auto; height: auto; padding: 0.12rem 0.2rem; border: 1px solid #555; }
		.header-secondary .col-name-portrait { text-align: left; }
		.grid-row.team-header > .team-name-header { grid-column: 2 / 12; border-left-width: 0; font-size: 1.2rem; }
		.grid-row.team-header > .team-stats { grid-column: 12 / 17; font-size: 0.8rem; }
		.grid-row.team-header > .team-score { grid-column: 17 / 19; font-size: 1.2rem; font-weight: bold; }
		.grid-row.team-header > .team-next-score { grid-column: 19 / 22; font-size: 1.2rem; font-weight: normal; border-right-width: 0; }
		.grid-row.team-athlete > .cell:first-of-type { border-left-width: 4px !important; }
		.grid-row.team-athlete > .cell:last-of-type { border-right-width: 4px !important; }
	}
	
	/* Compact team column for small team sizes (< 7 athletes) */
	.scoreboard-grid.compact-team-column .grid-row.team-header > .team-name-header {
		grid-column: 1 / span 3;
		font-size: 1.4rem;
	}
	
	.scoreboard-grid.compact-team-column .grid-row.team-header > .team-stats {
		grid-column: 4 / 18;
	}
	
	.scoreboard-grid.compact-team-column .grid-row.team-athlete > .team-name {
		max-width: 3rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
