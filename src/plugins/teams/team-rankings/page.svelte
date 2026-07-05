<script>
	import { onDestroy } from 'svelte';

	export let data = {};

	let currentPageIndex = 0;
	let rotationTimer = null;
	let rotationKey = '';

	$: pages = data.pages || [];
	$: currentPage = pages[currentPageIndex] || null;
	$: pagePauseMs = Math.max(500, Number(data.options?.pagePauseMs || 5000));
	$: sweepDurationMs = Math.max(200, Number(data.options?.sweepDurationMs || 1200));
	$: pageDurationMs = pagePauseMs + sweepDurationMs;
	$: nextRotationKey = `${pages.map((page) => page.pageKey).join('|')}::${pageDurationMs}`;
	$: if (nextRotationKey !== rotationKey) {
		rotationKey = nextRotationKey;
		if (currentPageIndex >= pages.length) {
			currentPageIndex = 0;
		}
		restartRotation();
	}

	function restartRotation() {
		clearRotation();
		if (pages.length <= 1) {
			return;
		}

		rotationTimer = setTimeout(() => {
			currentPageIndex = (currentPageIndex + 1) % pages.length;
			restartRotation();
		}, pageDurationMs);
	}

	function clearRotation() {
		if (rotationTimer) {
			clearTimeout(rotationTimer);
			rotationTimer = null;
		}
	}

	function formatScore(value) {
		const numeric = Number(value || 0);
		return numeric > 0 ? numeric.toFixed(2) : '0.00';
	}

	function formatPoints(value) {
		return String(Math.round(Number(value || 0)));
	}

	function rowDelay(index, totalRows) {
		const safeRows = Math.max(totalRows, 1);
		return Math.round((sweepDurationMs / safeRows) * index);
	}

	onDestroy(() => {
		clearRotation();
	});
</script>

<svelte:head>
	<title>{data.scoreboardName || 'Team Rankings'} - {data.competition?.name || 'OWLCMS'}</title>
</svelte:head>

{#if data.status === 'waiting' || !currentPage}
	<div class="empty-state">
		<div class="empty-card">
			<div class="eyebrow">{data.scoreboardName || 'Team Rankings'}</div>
			<h1>{data.message || 'Waiting for competition data...'}</h1>
		</div>
	</div>
{:else}
	<div class="rankings-shell section-{currentPage.sectionColorVariant}">
		<div class="background-layer"></div>
		<div class="content-frame">
			<header class="page-header">
				<div>
					<div class="eyebrow">{data.scoreboardName}</div>
					<h1>{currentPage.sectionLabel}</h1>
				</div>
				<div class="page-meta">
					<div class="competition-name">{data.competition?.name}</div>
					<div class="page-count">Page {currentPage.pageNumber} / {currentPage.pageCount}</div>
				</div>
			</header>

			{#key `${currentPage.pageKey}:${currentPageIndex}`}
				<div class="table-frame" style={`--page-rows:${Math.max(1, Number(data.options?.pageSize || 10))};--current-rows:${currentPage.rows.length}`}>
					<div class="table-wrap">
						<table class:points-table={currentPage.mode === 'points'} class:multi-points={currentPage.rows[0]?.isMultiMedals}>
							<thead>
								<tr>
									<th>{currentPage.headers.rank}</th>
									<th>{currentPage.headers.team}</th>
									<th>{currentPage.headers.count}</th>
									{#if currentPage.mode === 'score'}
										<th>{currentPage.headers.liveScore}</th>
										<th>{currentPage.headers.confirmedScore}</th>
								{:else if currentPage.rows[0]?.isMultiMedals && !currentPage.onlyTotalPoints}
										<th>{currentPage.headers.snatchPoints}</th>
										<th>{currentPage.headers.cjPoints}</th>
										<th>{currentPage.headers.totalPoints}</th>
										<th>{currentPage.headers.confirmedPoints}</th>
									{:else}
										<th>{currentPage.headers.confirmedPoints}</th>
									{/if}
								</tr>
							</thead>
							<tbody>
								{#each currentPage.rows as row, index}
									<tr style={`--row-delay:${rowDelay(index, currentPage.rows.length)}ms;--sweep-duration:${sweepDurationMs}ms`}>
										<td class="rank-cell">{row.rank}</td>
										<td class="team-cell">
											<div class="team-content">
												{#if row.flagUrl}
													<img src={row.flagUrl} alt={row.teamName} class="flag" />
												{/if}
												<span>{row.teamName}</span>
											</div>
										</td>
										<td class="count-cell">{row.countNumerator} / {row.countDenominator}</td>
										{#if currentPage.mode === 'score'}
											<td class="value-cell">{formatScore(row.liveScore)}</td>
											<td class="value-cell confirmed">{formatScore(row.confirmedScore)}</td>
									{:else if row.isMultiMedals && !currentPage.onlyTotalPoints}
											<td class="value-cell">{formatPoints(row.snatchPoints)}</td>
											<td class="value-cell">{formatPoints(row.cjPoints)}</td>
											<td class="value-cell">{formatPoints(row.totalPoints)}</td>
											<td class="value-cell confirmed">{formatPoints(row.confirmedPoints)}</td>
										{:else}
											<td class="value-cell confirmed">{formatPoints(row.confirmedPoints)}</td>
										{/if}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/key}
		</div>
	</div>
{/if}

<style>
	:global(body) {
		margin: 0;
		min-height: 100vh;
		background: #07131e;
		color: #f8fbff;
		font-family: Aptos, 'Trebuchet MS', sans-serif;
	}

	.empty-state,
	.rankings-shell {
		position: relative;
		min-height: 100vh;
		overflow: hidden;
	}

	.empty-state {
		display: grid;
		place-items: center;
		background:
			radial-gradient(circle at top, rgba(57, 124, 196, 0.25), transparent 42%),
			linear-gradient(160deg, #06101a, #0c1d2a 52%, #10283b);
	}

	.empty-card {
		padding: 2.5rem 3rem;
		border: 1px solid rgba(255, 255, 255, 0.12);
		background: rgba(5, 15, 25, 0.72);
		backdrop-filter: blur(16px);
		box-shadow: 0 30px 80px rgba(0, 0, 0, 0.35);
		text-align: center;
	}

	.rankings-shell {
		background: linear-gradient(180deg, rgba(0, 0, 0, 0.12), rgba(0, 0, 0, 0.3));
	}

	.background-layer {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(circle at 18% 20%, rgba(255, 255, 255, 0.1), transparent 30%),
			radial-gradient(circle at 84% 14%, rgba(255, 255, 255, 0.08), transparent 24%),
			linear-gradient(140deg, rgba(255, 255, 255, 0.05), transparent 45%),
			repeating-linear-gradient(
				135deg,
				rgba(255, 255, 255, 0.03) 0,
				rgba(255, 255, 255, 0.03) 2px,
				transparent 2px,
				transparent 12px
			);
		opacity: 0.7;
	}

	.section-men {
		background: linear-gradient(145deg, #0a2f55, #0d4b7b 48%, #0b658d);
	}

	.section-women {
		background: linear-gradient(145deg, #0f3b67, #145f92 48%, #0c79ab);
	}

	.section-mixed {
		background: linear-gradient(145deg, #0b4660, #12627d 48%, #16839a);
	}

	.content-frame {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		padding: clamp(1.25rem, 2vw, 2rem);
		gap: 1rem;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 1rem;
		padding: 0.6rem 0.4rem 1rem;
	}

	.eyebrow {
		font-size: 0.9rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: rgba(235, 245, 255, 0.72);
	}

	h1 {
		margin: 0.2rem 0 0;
		font-size: clamp(2rem, 4vw, 3.5rem);
		line-height: 0.95;
		letter-spacing: -0.04em;
	}

	.page-meta {
		text-align: right;
		color: rgba(243, 249, 255, 0.86);
	}

	.competition-name {
		font-size: clamp(1rem, 1.4vw, 1.35rem);
		font-weight: 600;
	}

	.page-count {
		margin-top: 0.25rem;
		font-size: 0.95rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(230, 240, 255, 0.72);
	}

	.table-frame {
		flex: 1;
		--frame-gap: clamp(0.8rem, 1.6vw, 1.25rem);
		position: relative;
		border: 1px solid rgba(255, 255, 255, 0.18);
		background: rgba(4, 12, 20, 0.34);
		backdrop-filter: blur(18px);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
	}

	.table-wrap {
		position: absolute;
		inset: var(--frame-gap);
		--header-height: 3.6rem;
		--row-height: calc((100% - var(--header-height)) / var(--page-rows, 10));
	}

	table {
		width: 100%;
		height: calc(var(--header-height) + (var(--current-rows, 0) * var(--row-height)));
		max-height: 100%;
		margin: 0;
		border-collapse: collapse;
		table-layout: fixed;
		background: rgba(8, 19, 31, 0.72);
		color: #eff7ff;
		border: 1px solid rgba(255, 255, 255, 0.12);
	}

	thead tr {
		height: var(--header-height);
	}

	thead,
	thead tr {
		background: rgba(7, 18, 30, 0.98) !important;
	}

	thead th {
		padding: 0.95rem 0.8rem;
		text-align: center;
		font-size: clamp(0.92rem, 1.05vw, 1.12rem);
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		background: rgba(7, 18, 30, 0.98) !important;
		color: #f7fbff !important;
		opacity: 1 !important;
		text-shadow: 0 1px 0 rgba(0, 0, 0, 0.28);
		border-bottom: 1px solid rgba(255, 255, 255, 0.18);
	}

	tbody tr {
		height: var(--row-height);
		opacity: 0;
		transform: translateY(-18px);
		animation: row-sweep var(--sweep-duration, 1200ms) cubic-bezier(0.22, 1, 0.36, 1) forwards;
		animation-delay: var(--row-delay, 0ms);
		background: rgba(255, 255, 255, 0.02);
	}

	tbody tr:nth-child(even) {
		background: rgba(255, 255, 255, 0.05);
	}

	tbody td {
		padding: clamp(0.9rem, 1vw, 1.15rem) 0.8rem;
		font-size: clamp(1rem, 1.45vw, 1.45rem);
		text-align: center;
		vertical-align: middle;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		color: #f4f9ff;
	}

	tbody tr:last-child td {
		border-bottom: none;
	}

	.rank-cell,
	.count-cell,
	.value-cell {
		text-align: center;
		font-variant-numeric: tabular-nums;
	}

	.team-cell {
		text-align: center;
		font-weight: 700;
	}

	.team-content {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.8rem;
	}

	.flag {
		width: 2rem;
		height: 1.35rem;
		object-fit: cover;
		border: 1px solid rgba(255, 255, 255, 0.16);
		box-shadow: 0 8px 18px rgba(0, 0, 0, 0.2);
		flex: 0 0 auto;
	}

	.confirmed {
		font-weight: 800;
		color: #ffffff;
	}

	.points-table th:first-child,
	.points-table td:first-child {
		width: 8%;
	}

	.points-table th:nth-child(2),
	.points-table td:nth-child(2) {
		width: 32%;
	}

	.points-table th:nth-child(3),
	.points-table td:nth-child(3) {
		width: 18%;
	}

	.points-table.multi-points th:nth-child(4),
	.points-table.multi-points th:nth-child(5),
	.points-table.multi-points th:nth-child(6),
	.points-table.multi-points th:nth-child(7),
	.points-table.multi-points td:nth-child(4),
	.points-table.multi-points td:nth-child(5),
	.points-table.multi-points td:nth-child(6),
	.points-table.multi-points td:nth-child(7) {
		width: 10.5%;
	}

	@keyframes row-sweep {
		from {
			opacity: 0;
			transform: translateY(-18px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (max-width: 900px) {
		.content-frame {
			padding: 1rem;
		}

		.page-header {
			flex-direction: column;
			align-items: start;
		}

		.page-meta {
			text-align: left;
		}

		thead th,
		tbody td {
			padding-left: 0.55rem;
			padding-right: 0.55rem;
		}

		.team-cell {
			gap: 0.45rem;
		}

		.flag {
			width: 1.55rem;
			height: 1.05rem;
		}
	}
</style>