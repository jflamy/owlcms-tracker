<script>
	// Athletes Grid Component - shared across all 3 grid scoreboards (session-results, lifting-order, rankings)
	// Displays: headers, athlete rows with attempts, category spacers, and optional leaders section
	
	export let allAthletes = [];
	export let translations = {};
	export let showLeaders = false;
	export let hasLeaders = false;
	export let data = {};
	
	// Helper functions (same as in parent component)
	export function shouldRenderFlag(url) {
		if (!url) return false;
		if (typeof url === 'string' && url.startsWith('data:image/')) return false;
		return true;
	}
	
	export function getAttemptClass(attempt) {
		if (!attempt || !attempt.liftStatus || attempt.liftStatus === 'empty' || attempt.liftStatus === 'request') {
			return 'empty';
		}
		if (attempt.liftStatus === 'fail') return 'failed';
		if (attempt.liftStatus === 'good') return 'success';
		return 'empty';
	}
	
	export function displayAttempt(attempt) {
		if (!attempt || !attempt.stringValue || attempt.stringValue === '') return '-';
		// Remove parentheses from failed attempts (OWLCMS sends "(62)" for failed 62kg)
		return attempt.stringValue.replace(/[()]/g, '');
	}
</script>

<div class="scoreboard-grid" role="grid">
	<div class="grid-row header header-primary" role="row">
		<div class="cell header col-start span-two" role="columnheader">{translations.Start || 'Start'}</div>
		<div class="cell header col-name span-two" role="columnheader">{translations.Name || 'Name'}</div>
		<div class="cell header col-cat span-two" role="columnheader">{translations.Category || 'Cat.'}</div>
		<div class="cell header col-born span-two" role="columnheader">{translations.Birth || 'Born'}</div>
		<div class="cell header col-team span-two" role="columnheader">{translations.Team || 'Team'}</div>
		<div class="cell header v-spacer v-spacer-snatch span-two" aria-hidden="true"></div>
		<div class="cell header col-group col-group-snatch" role="columnheader">{translations.Snatch || 'Snatch'}</div>
		<div class="cell header v-spacer v-spacer-middle span-two" aria-hidden="true"></div>
		<div class="cell header col-group col-group-cj" role="columnheader">{translations.Clean_and_Jerk || 'Clean &amp; Jerk'}</div>
		<div class="cell header v-spacer v-spacer-total span-two" aria-hidden="true"></div>
		<div class="cell header col-total span-two" role="columnheader">{translations.TOTAL || 'Total'}</div>
		<div class="cell header col-rank span-two" role="columnheader">{translations.Rank || 'Rank'}</div>
	</div>
	<div class="grid-row header header-secondary" role="row">
		<div class="cell header col-name-portrait" role="columnheader">{translations.Name || 'Name'}</div>
		<div class="cell header v-spacer v-spacer-snatch" aria-hidden="true"></div>
		<div class="cell header col-attempt snatch-1" role="columnheader">1</div>
		<div class="cell header col-attempt snatch-2" role="columnheader">2</div>
		<div class="cell header col-attempt snatch-3" role="columnheader">3</div>
		<div class="cell header col-best snatch-best" role="columnheader">{translations.Best || '✔'}</div>
		<div class="cell header v-spacer v-spacer-middle" aria-hidden="true"></div>
		<div class="cell header col-attempt cj-1" role="columnheader">1</div>
		<div class="cell header col-attempt cj-2" role="columnheader">2</div>
		<div class="cell header col-attempt cj-3" role="columnheader">3</div>
		<div class="cell header col-best cj-best" role="columnheader">{translations.Best || '✔'}</div>
		<div class="cell header v-spacer v-spacer-total" aria-hidden="true"></div>
		<div class="cell header col-total-portrait" role="columnheader">{translations.TOTAL || 'Total'}</div>
		<div class="cell header col-rank-portrait" role="columnheader">{translations.Rank || 'Rank'}</div>
	</div>

	{#each allAthletes as athlete}
		{#if athlete.isSpacer}
			<div class="grid-row spacer category-spacer" aria-hidden="true">
				<div class="cell span-all"></div>
			</div>
		{:else}
			<div
				class="grid-row data-row"
				class:current={athlete.classname && athlete.classname.includes('current')}
				class:next={athlete.classname && athlete.classname.includes('next')}
				role="row"
			>
				<div class="cell start-num" role="gridcell">{athlete.startNumber}</div>
				<div class="cell name" role="gridcell">{athlete.fullName}</div>
				<div class="cell cat" role="gridcell">{athlete.category || ''}</div>
				<div class="cell born" role="gridcell">{athlete.yearOfBirth || ''}</div>
				<div class="cell team-name" role="gridcell">
					{#if shouldRenderFlag(athlete.flagUrl)}
						<img src={athlete.flagUrl} alt={athlete.teamName} class="team-flag" />
					{/if}
					{athlete.teamName || ''}
				</div>
				<div class="cell v-spacer" aria-hidden="true"></div>
				<div class="cell attempt {getAttemptClass(athlete.sattempts?.[0])}" role="gridcell">
					{displayAttempt(athlete.sattempts?.[0])}
				</div>
				<div class="cell attempt {getAttemptClass(athlete.sattempts?.[1])}" role="gridcell">
					{displayAttempt(athlete.sattempts?.[1])}
				</div>
				<div class="cell attempt {getAttemptClass(athlete.sattempts?.[2])}" role="gridcell">
					{displayAttempt(athlete.sattempts?.[2])}
				</div>
				<div class="cell best" role="gridcell">{athlete.bestSnatch || '-'}</div>
				<div class="cell v-spacer" aria-hidden="true"></div>
				<div class="cell attempt {getAttemptClass(athlete.cattempts?.[0])}" role="gridcell">
					{displayAttempt(athlete.cattempts?.[0])}
				</div>
				<div class="cell attempt {getAttemptClass(athlete.cattempts?.[1])}" role="gridcell">
					{displayAttempt(athlete.cattempts?.[1])}
				</div>
				<div class="cell attempt {getAttemptClass(athlete.cattempts?.[2])}" role="gridcell">
					{displayAttempt(athlete.cattempts?.[2])}
				</div>
				<div class="cell best" role="gridcell">{athlete.bestCleanJerk || '-'}</div>
				<div class="cell v-spacer" aria-hidden="true"></div>
				<div class="cell total" role="gridcell">{athlete.total || '-'}</div>
				<div class="cell rank" role="gridcell">{athlete.totalRank || '-'}</div>
			</div>
		{/if}
	{/each}

	{#if hasLeaders && showLeaders}
		<!-- Elastic spacer row separating results from leaders -->
		<div class="grid-row leaders-spacer" aria-hidden="true">
			<div class="cell span-all"></div>
		</div>

		<!-- Leaders title row spanning all columns -->
		<div class="grid-row leaders-header">
			<div class="cell leaders-title-cell span-all">
				{translations.Leaders || 'Leaders:'} {data.competition?.groupInfo ? data.competition.groupInfo.split('–')[0].trim() : ''}
			</div>
		</div>

		<!-- Leader rows -->
		{#each data.leaders as leader}
			{#if leader.isSpacer}
				<div class="grid-row spacer category-spacer" aria-hidden="true">
					<div class="cell span-all"></div>
				</div>
			{:else}
				<div class="grid-row leader-row" role="row">
					<div class="cell start-num" role="gridcell">{leader.subCategory || ''}</div>
					<div class="cell name" role="gridcell">{leader.fullName || ''}</div>
					<div class="cell cat" role="gridcell">{leader.category || ''}</div>
					<div class="cell born" role="gridcell">{leader.yearOfBirth || ''}</div>
					<div class="cell team-name" role="gridcell">
						{#if shouldRenderFlag(leader.flagUrl)}
							<img class="team-flag" src={leader.flagUrl} alt={leader.teamName || ''} />
						{/if}
						{leader.teamName || ''}
					</div>
					<div class="cell v-spacer" aria-hidden="true"></div>
					<div class="cell attempt {getAttemptClass(leader.sattempts?.[0])}" role="gridcell">
						{displayAttempt(leader.sattempts?.[0])}
					</div>
					<div class="cell attempt {getAttemptClass(leader.sattempts?.[1])}" role="gridcell">
						{displayAttempt(leader.sattempts?.[1])}
					</div>
					<div class="cell attempt {getAttemptClass(leader.sattempts?.[2])}" role="gridcell">
						{displayAttempt(leader.sattempts?.[2])}
					</div>
					<div class="cell best" role="gridcell">{leader.bestSnatch || '-'}</div>
					<div class="cell v-spacer" aria-hidden="true"></div>
					<div class="cell attempt {getAttemptClass(leader.cattempts?.[0])}" role="gridcell">
						{displayAttempt(leader.cattempts?.[0])}
					</div>
					<div class="cell attempt {getAttemptClass(leader.cattempts?.[1])}" role="gridcell">
						{displayAttempt(leader.cattempts?.[1])}
					</div>
					<div class="cell attempt {getAttemptClass(leader.cattempts?.[2])}" role="gridcell">
						{displayAttempt(leader.cattempts?.[2])}
					</div>
					<div class="cell best" role="gridcell">{leader.bestCleanJerk || '-'}</div>
					<div class="cell v-spacer" aria-hidden="true"></div>
					<div class="cell total" role="gridcell">{leader.total || '-'}</div>
					<div class="cell rank" role="gridcell">{leader.totalRank || '-'}</div>
				</div>
			{/if}
		{/each}
	{/if}
</div>

<style>
	.scoreboard-grid {
		--col-start: 4.9rem;
		--col-name: minmax(14rem, 2.5fr);
		--col-cat: 14ch;
		--col-born: 14ch;
		--col-team: minmax(8rem, 1.8fr);
		--col-gap: 0.65rem;
		--col-attempt: 4.4rem;
		--col-best: 4.4rem;
		--col-total: 4.9rem;
		--col-rank: 4.9rem;
		/* Header row heights: keep these in sync with grid-template-rows and sticky offsets */
		--header-primary-vpad: 0.25rem; /* vertical padding for primary header cells */
		--header-primary-height: calc(1rem + (var(--header-primary-vpad) * 2));
		--header-secondary-vpad: 0.3rem; /* vertical padding used in secondary header cells */
		--header-secondary-height: calc(1rem + (var(--header-secondary-vpad) * 2));
		display: grid;
		width: 100%;
		flex: 1;
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
			var(--col-rank);
		/* Use the same variables for row heights and sticky positioning to avoid gaps */
		grid-template-rows: var(--header-primary-height) var(--header-secondary-height) var(--template-rows);
		row-gap: 0;
		font-size: 1.1rem;
		line-height: 1.05;
	}

	.grid-row {
		display: contents;
	}

	.cell {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.375rem 0.25rem;
		border: 1px solid #444;
		background: #1a1a1a;
		color: #fff;
		line-height: 1.05;
	}

	.cell.header {
		background: #3a3a3a;
		border-color: #555;
		font-weight: bold;
	}

	.header-primary > .cell.header {
		text-transform: uppercase;
	}

	.header-secondary > .cell.header {
		background: #2a2a2a;
	}

	.header-primary > .cell {
		grid-row: 1;
		position: sticky;
		top: 0;
		z-index: 20;
		align-self: stretch;
		padding: var(--header-primary-vpad) 0.15rem;
		min-height: 0;
	}

	.header-primary > .cell.span-two {
		grid-row: 1 / span 2;
		z-index: 21;
	}

	.header-secondary > .cell {
		grid-row: 2;
		position: sticky;
		top: var(--header-primary-height);
		z-index: 19;
		font-size: 1rem;
		padding: var(--header-secondary-vpad) 0.15rem;
		min-height: 0;
	}

	.header-secondary .cell.v-spacer {
		height: 0;
		min-height: 0;
	}

	.col-group {
		justify-content: center;
		font-size: 1.1rem;
	}

	.span-two {
		align-self: stretch;
	}

	.cell.v-spacer {
		background: #000;
		border: none;
		padding: 0;
		height: var(--col-gap);
		min-height: var(--col-gap);
	}

	.header .cell.v-spacer {
		background: #000;
		border: none;
		height: 0;
		min-height: 0;
		padding: 0;
	}

	.header-secondary .cell.v-spacer {
		height: 0;
		min-height: 0;
	}

	.cell.span-all {
		grid-column: 1 / -1;
	}

	.cell.name,
	.cell.team-name {
		justify-content: flex-start;
		padding-left: 0.625rem;
		text-align: left;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.team-flag {
		height: 1.2rem;
		max-width: 1.5rem;
		object-fit: contain;
	}

	/* Hide any data: URI flags (covers legacy 1x1 transparent PNG placeholders) */
	.team-flag[src^="data:image/"] {
		display: none;
	}

	.cell.cat {
		justify-content: center;
		padding: 0;
		text-align: center;
		white-space: nowrap;
	}

	.cell.start-num {
		font-weight: bold;
		color: #fbbf24;
	}

	.cell.best,
	.cell.total,
	.cell.rank {
		background: #2a2a2a;
		font-weight: bold;
	}

	.cell.total,
	.cell.rank {
		color: #fff;
	}

	.grid-row.current > .start-num,
	.grid-row.current > .name {
		background: #22c55e !important;
		color: #000 !important;
		font-weight: bold;
	}

	.grid-row.next > .start-num,
	.grid-row.next > .name {
		background: #f97316 !important;
		color: #000 !important;
		font-weight: bold;
	}

	.attempt {
		font-weight: bold;
		white-space: nowrap;
		padding: 0 0.35rem;
	}

	.header-secondary .col-attempt {
		white-space: nowrap;
		padding: var(--header-secondary-vpad) 0.35rem;
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

	.grid-row.spacer > .cell {
		grid-column: 1 / -1;
		background: #000;
		border: none;
		padding: 0;
		min-height: 10px;
		height: 10px;
		overflow: hidden;
		display: block;
	}

	/* Elastic spacer row between results and leaders sections */
	/* Must be display: grid so that 1fr sizing in parent's grid-template-rows applies to this row */
	.grid-row.leaders-spacer {
		display: grid;
		grid-column: 1 / -1;
		grid-template-columns: 1fr;
	}

	.grid-row.leaders-spacer > .cell {
		grid-column: 1 / -1;
		background: transparent;
		border: none;
		padding: 0;
		display: block;
	}

	/* Leaders header row with title spanning all columns */
	.grid-row.leaders-header {
		display: grid;
		grid-column: 1 / -1;
		grid-template-columns: 1fr;
	}

	.grid-row.leaders-header > .cell {
		grid-column: 1 / -1;
	}

	.cell.leaders-title-cell {
		background: transparent;
		border: none;
		padding: 0.25rem 0;
		font-weight: bold;
		font-size: 1.2rem;
		color: #ccc;
		justify-content: flex-start;
		text-align: left;
	}

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
	.header-primary .col-rank { grid-column: 18; }

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
	.header-secondary .col-rank-portrait { grid-column: 18; }

	.header-secondary .col-name-portrait,
	.header-secondary .col-total-portrait,
	.header-secondary .col-rank-portrait {
		visibility: hidden;
		pointer-events: none;
		padding: 0;
		height: 0;
		border: none;
	}

	.header-secondary .v-spacer {
		background: #000;
		border: none;
		height: 0;
		padding: 0;
	}

	/* Responsive adjustments */
	@media (max-width: 1160px) {
		.scoreboard-grid {
			--col-name: minmax(12rem, 2.2fr);
			--col-team: minmax(7rem, 1.6fr);
			--col-cat: 12ch;
			--col-born: 12ch;
			--col-attempt: 3.8rem;
			--col-best: 3.8rem;
			--col-total: 4.5rem;
			--col-rank: 3.5rem;
		}
	}

	@media (max-width: 932px) {
		.scoreboard-grid {
			--col-name: minmax(10.5rem, 2fr);
			--col-team: minmax(6rem, 1.4fr);
			--col-attempt: 3.4rem;
			--col-best: 3.4rem;
			--col-born: 0;
			--header-primary-height: 2.5rem;
		}

		.cell {
			font-size: 0.95rem;
			padding: 0.25rem 0.2rem;
		}

		.header-secondary > .cell {
			font-size: 0.9rem;
		}

		.header-primary .col-born,
		.grid-row.data-row > .born,
		.grid-row.leader-row > .born {
			display: none;
		}
	}

	@media (max-width: 932px) and (orientation: portrait) {
		.scoreboard-grid {
			--col-start: 0;
			--col-cat: 0;
			--col-team: 0;
			--col-rank: 0;
			--col-best: 0;
			--col-attempt: 2.75rem;
			--header-primary-height: 2.3rem;
		}

		.header-primary .col-start,
		.grid-row.data-row > .start-num,
		.grid-row.leader-row > .start-num,
		.header-primary .col-cat,
		.grid-row.data-row > .cat,
		.grid-row.leader-row > .cat,
		.header-primary .col-team,
		.grid-row.data-row > .team-name,
		.grid-row.leader-row > .team-name,
		.header-primary .col-rank,
		.grid-row.data-row > .rank,
		.grid-row.leader-row > .rank,
		.grid-row.data-row > .best,
		.grid-row.leader-row > .best {
			display: none;
		}

		.header-secondary .col-name-portrait,
		.header-secondary .col-total-portrait,
		.header-secondary .col-rank-portrait {
			visibility: visible;
			pointer-events: auto;
			height: auto;
			padding: 0.12rem 0.2rem;
			border: 1px solid #555;
		}

		.header-secondary .col-name-portrait {
			text-align: left;
		}
	}
</style>
