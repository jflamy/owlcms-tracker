<script>
	export let data = {};

	function splitNames(namesObj) {
		if (!namesObj) return ['—'];
		if (namesObj.split && namesObj.split.length > 1) {
			return namesObj.split;
		}
		let name = namesObj.raw || '—';
		// Split on separators: " et ", " and ", "+", "/"
		const separators = [' et ', ' and ', '+', '/'];
		for (const sep of separators) {
			if (name.includes(sep)) {
				const replacement = (sep === '+' || sep === '/') ? sep : sep.trim();
				const parts = name.split(sep);
				// Interleave parts with separators
				const result = [];
				for (let i = 0; i < parts.length; i++) {
					result.push(parts[i]);
					if (i < parts.length - 1) result.push(replacement);
				}
				return result;
			}
		}
		return [name];
	}

	function renderNameArray(namesObj) {
		const parts = splitNames(namesObj);
		if (parts.length === 1) return parts[0];
		return parts.join('<br>');
	}

	// Check if ANY session has data for a specific official field (works with days->platforms structure)
	function hasAnyData(days, ...fields) {
		if (!days) return false;
		return days.some(day => 
			day.platforms?.some(platform =>
				platform.sessions?.some(session => 
					fields.some(field => session.officials?.[field]?.raw)
				)
			)
		);
	}

	// Flatten all sessions from all days and platforms for checking data presence
	$: allSessions = data.days?.flatMap(day => 
		day.platforms?.flatMap(platform => platform.sessions || []) || []
	) || [];

	// Check if jury section has any data
	$: hasJury = hasAnyData(data.days, 'jury1', 'jury2', 'jury3', 'jury4', 'jury5', 'reserveJury');
	
	// Check individual rows
	$: hasWeighInOfficials = hasAnyData(data.days, 'weighIn1', 'weighIn2');
	$: hasAnnouncer = hasAnyData(data.days, 'announcer');
	$: hasReserveReferee = hasAnyData(data.days, 'reserve');
	$: hasMarshal = hasAnyData(data.days, 'marshall', 'marshal2');
	$: hasTimekeeper = hasAnyData(data.days, 'timeKeeper');
	$: hasTechnicalController = hasAnyData(data.days, 'technicalController', 'technicalController2', 'technicalController3');
	$: hasSecretary = hasAnyData(data.days, 'competitionSecretary', 'competitionSecretary2');
	$: hasDoctor = hasAnyData(data.days, 'doctor', 'doctor2', 'doctor3');
	$: hasJuryPresident = hasAnyData(data.days, 'jury1');
	$: hasJuryMembers = hasAnyData(data.days, 'jury2', 'jury3', 'jury4', 'jury5', 'reserveJury');
</script>

<div class="protocol-sheet" class:no-jury={!hasJury}>
	{#if data.status === 'ready'}
		<!-- Header -->
		<div class="sheet-header">
			<h1>{data.header.title || 'ASSIGNATION DES OFFICIELS'}</h1>
			{#if data.header.competitionName}
				<h1 class="competition-name">{data.header.competitionName}</h1>
			{/if}
			<div class="header-info">
				{#if data.header.locationLine}
					<p>{data.header.locationLine}</p>
				{/if}
			</div>
		</div>

		<!-- Day-Grouped Sessions Tables with Platform Grouping -->
		{#each data.days as day, dayIndex (day.date)}
			{#each day.platforms as platform, platformIndex (platform.platform)}
				<div class="day-group" class:page-break={dayIndex > 0 || platformIndex > 0}>
					<!-- ISO Date Header with Platform Name -->
					<div class="day-header">
						<h2>
							{day.date}
							{#if day.hasMultiplePlatforms}
								- {platform.platform}
							{/if}
						</h2>
					</div>
					
					<table class="protocol-table">
						<thead>
							<tr>
								<th class="row-label">{data.labels.group || 'GROUPE'}</th>
								{#each platform.sessions as session (session.id)}
									<th class="session-header">
										<div class="session-name">{session.name}</div>
										<div class="session-desc">{session.displayName}</div>
									</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							<!-- Weigh-In Officials -->
							{#if hasWeighInOfficials}
							<tr>
								<td class="row-label">{data.labels?.official_at_weighin}</td>
								{#each platform.sessions as session (session.id)}
								<td class="cell">
									{#if session.officials.weighIn1?.raw}
										<div>{@html renderNameArray(session.officials.weighIn1)}</div>
									{/if}
									{#if session.officials.weighIn2?.raw}
										<div>{@html renderNameArray(session.officials.weighIn2)}</div>
							{/if}
							{#if !session.officials.weighIn1?.raw && !session.officials.weighIn2?.raw}
								<span class="empty">—</span>
							{/if}
						</td>
					{/each}
				</tr>
				{/if}

						<!-- Weigh-In Time -->
						<tr>
							<td class="row-label">{data.labels?.weighin_time}</td>
							{#each platform.sessions as session (session.id)}
								<td class="cell">{session.weighInTime || '—'}</td>
							{/each}
						</tr>

						<!-- Competition Time -->
						<tr>
							<td class="row-label">{data.labels?.competition_time}</td>
							{#each platform.sessions as session (session.id)}
								<td class="cell">{session.competitionTime || '—'}</td>
							{/each}
						</tr>

						<!-- Announcer -->
						{#if hasAnnouncer}
						<tr>
							<td class="row-label">{data.labels?.announcer}</td>
							{#each platform.sessions as session (session.id)}
								<td class="cell">
								{#if session.officials.announcer?.raw}
									{@html renderNameArray(session.officials.announcer)}
									{:else}
										<span class="empty">—</span>
									{/if}
								</td>
							{/each}
						</tr>
						{/if}

						<!-- Referees Section -->
						<tr class="section-divider">
							<td class="row-label">{data.labels?.referees}</td>
							<td colspan={platform.sessions.length} class="section-title"></td>
						</tr>

						<!-- Center Referee (referee2 in IWF protocol order) -->
						<tr>
							<td class="row-label">
								{data.labels?.center_referee}
							</td>
							{#each platform.sessions as session (session.id)}
								<td class="cell">
								{#if session.officials.referee2?.raw}
									{@html renderNameArray(session.officials.referee2)}
									{:else}
										<span class="empty">—</span>
									{/if}
								</td>
							{/each}
						</tr>

						<!-- Side Referee 1 (referee1) -->
						<tr>
							<td class="row-label">
								{data.labels?.side_referee_1}
							</td>
							{#each platform.sessions as session (session.id)}
								<td class="cell">
								{#if session.officials.referee1?.raw}
									{@html renderNameArray(session.officials.referee1)}
									{:else}
										<span class="empty">—</span>
									{/if}
								</td>
							{/each}
						</tr>

						<!-- Side Referee 2 (referee3) -->
						<tr>
							<td class="row-label">
								{data.labels?.side_referee_2}
							</td>
							{#each platform.sessions as session (session.id)}
								<td class="cell">
								{#if session.officials.referee3?.raw}
									{@html renderNameArray(session.officials.referee3)}
									{:else}
										<span class="empty">—</span>
									{/if}
								</td>
							{/each}
						</tr>

						<!-- Reserve Referee -->
						{#if hasReserveReferee}
						<tr>
							<td class="row-label">
								{data.labels?.reserve_referee}
							</td>
							{#each platform.sessions as session (session.id)}
								<td class="cell">
								{#if session.officials.reserve?.raw}
									{@html renderNameArray(session.officials.reserve)}
									{:else}
										<span class="empty">—</span>
									{/if}
								</td>
							{/each}
						</tr>
						{/if}

						<!-- Officials Section -->
						<tr class="section-divider">
							<td class="row-label">{data.labels?.officials || 'Officiels'}</td>
							<td colspan={platform.sessions.length} class="section-title"></td>
						</tr>

						<!-- Marshal -->
						{#if hasMarshal}
						<tr>
							<td class="row-label">{data.labels?.marshall}</td>
							{#each platform.sessions as session (session.id)}
								<td class="cell">
									{#if session.officials.marshall?.raw}
										<div>{@html renderNameArray(session.officials.marshall)}</div>
									{/if}
									{#if session.officials.marshal2?.raw}
										<div>{@html renderNameArray(session.officials.marshal2)}</div>
									{/if}
									{#if !session.officials.marshall?.raw && !session.officials.marshal2?.raw}
										<span class="empty">—</span>
									{/if}
								</td>
							{/each}
						</tr>
						{/if}

						<!-- Time Keeper -->
						{#if hasTimekeeper}
						<tr>
							<td class="row-label">{data.labels?.timekeeper}</td>
							{#each platform.sessions as session (session.id)}
								<td class="cell">
								{#if session.officials.timeKeeper?.raw}
									{@html renderNameArray(session.officials.timeKeeper)}
									{:else}
										<span class="empty">—</span>
									{/if}
								</td>
							{/each}
						</tr>
						{/if}

						<!-- Technical Controller -->
						{#if hasTechnicalController}
						<tr>
							<td class="row-label">{data.labels?.technical_controller}</td>
							{#each platform.sessions as session (session.id)}
								<td class="cell">
									{#if session.officials.technicalController?.raw}
										<div>{@html renderNameArray(session.officials.technicalController)}</div>
									{/if}
									{#if session.officials.technicalController2?.raw}
										<div>{@html renderNameArray(session.officials.technicalController2)}</div>
									{/if}
									{#if session.officials.technicalController3?.raw}
										<div>{@html renderNameArray(session.officials.technicalController3)}</div>
									{/if}
									{#if !session.officials.technicalController?.raw && !session.officials.technicalController2?.raw && !session.officials.technicalController3?.raw}
										<span class="empty">—</span>
									{/if}
								</td>
							{/each}
						</tr>
						{/if}

						<!-- Secretariat -->
						{#if hasSecretary}
						<tr>
							<td class="row-label">{data.labels?.secretary}</td>
							{#each platform.sessions as session (session.id)}
								<td class="cell">
									{#if session.officials.competitionSecretary?.raw}
										<div>{@html renderNameArray(session.officials.competitionSecretary)}</div>
									{/if}
									{#if session.officials.competitionSecretary2?.raw}
										<div>{@html renderNameArray(session.officials.competitionSecretary2)}</div>
									{/if}
									{#if !session.officials.competitionSecretary?.raw && !session.officials.competitionSecretary2?.raw}
										<span class="empty">—</span>
									{/if}
								</td>
							{/each}
						</tr>
						{/if}

						<!-- Doctor(s) -->
						{#if hasDoctor}
						<tr>
							<td class="row-label">{data.labels?.doctor}</td>
							{#each platform.sessions as session (session.id)}
								<td class="cell">
									{#if session.officials.doctor?.raw}
										<div>{@html renderNameArray(session.officials.doctor)}</div>
									{/if}
									{#if session.officials.doctor2?.raw}
										<div>{@html renderNameArray(session.officials.doctor2)}</div>
									{/if}
									{#if session.officials.doctor3?.raw}
										<div>{@html renderNameArray(session.officials.doctor3)}</div>
									{/if}
									{#if !session.officials.doctor?.raw && !session.officials.doctor2?.raw && !session.officials.doctor3?.raw}
										<span class="empty">—</span>
									{/if}
								</td>
							{/each}
						</tr>
						{/if}

						<!-- Jury Section -->
						{#if hasJury}
						<tr class="section-divider">
							<td class="row-label">{data.labels?.jury}</td>
							<td colspan={platform.sessions.length} class="section-title"></td>
						</tr>

						<!-- Jury President -->
						<tr>
							<td class="row-label">
								{data.labels?.jury_president}
							</td>
							{#each platform.sessions as session (session.id)}
								<td class="cell">
								{#if session.officials.jury1?.raw}
									{@html renderNameArray(session.officials.jury1)}
									{:else}
										<span class="empty">—</span>
									{/if}
								</td>
							{/each}
						</tr>

						<!-- Jury Members (including Reserve Jury if present) -->
						<tr>
							<td class="row-label">
								{data.labels?.jury_members}
							</td>
							{#each platform.sessions as session (session.id)}
								<td class="cell">
									{#if session.officials.jury2?.raw}
										<div>{@html renderNameArray(session.officials.jury2)}</div>
									{/if}
									{#if session.officials.jury3?.raw}
										<div>{@html renderNameArray(session.officials.jury3)}</div>
									{/if}
									{#if session.officials.jury4?.raw}
										<div>{@html renderNameArray(session.officials.jury4)}</div>
									{/if}
									{#if session.officials.jury5?.raw}
										<div>{@html renderNameArray(session.officials.jury5)}</div>
									{/if}
									{#if session.officials.reserveJury?.raw}
										<div>{@html renderNameArray(session.officials.reserveJury)} ({data.labels?.reserve})</div>
									{/if}
									{#if !session.officials.jury2?.raw && !session.officials.jury3?.raw && !session.officials.jury4?.raw && !session.officials.jury5?.raw && !session.officials.reserveJury?.raw}
										<span class="empty">—</span>
									{/if}
								</td>
							{/each}
						</tr>
						{/if}
					</tbody>
				</table>
			</div>
			{/each}
		{/each}
	{:else if data.status === 'no_data'}
		<p class="message">No competition data available</p>
	{:else if data.status === 'no_groups'}
		<p class="message">No sessions/groups found in competition</p>
	{:else}
		<p class="message">Loading...</p>
	{/if}
</div>

<style>
	.protocol-sheet {
		padding: 0.75rem;
		background: #fff;
		color: #000;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
	}

	.sheet-header {
		text-align: center;
		margin-bottom: 0.5rem;
		padding-bottom: 0.4rem;
	}

	.sheet-header h1 {
		margin: 0 0 0.25rem 0;
		font-size: 1.1rem;
		font-weight: 400;
		letter-spacing: 0.05em;
	}

	.sheet-header h1.competition-name {
		font-weight: 700;
		margin-bottom: 0.15rem;
	}

	.header-info {
		font-size: 0.8rem;
		margin: 0;
	}

	.header-info p {
		margin: 0.1rem 0;
	}

	.protocol-table {
		width: 100%;
		border-collapse: collapse;
		border-radius: 0;
		font-size: 0.75rem;
	}

	thead {
		background: #e8e8e8;
		-webkit-print-color-adjust: exact;
		print-color-adjust: exact;
	}

	/* All cells get all borders */
	th, td {
		border: 1px solid #000;
	}

	th {
		padding: 0.25rem 0.3rem;
		text-align: center;
		font-weight: 700;
		background: #e8e8e8;
		-webkit-print-color-adjust: exact;
		print-color-adjust: exact;
	}

	th.row-label {
		text-align: left;
		min-width: 120px;
		padding-left: 0.4rem;
		font-size: 0.75rem;
	}

	th.session-header {
		min-width: 100px;
	}

	.session-name {
		font-weight: 700;
		font-size: 0.85rem;
	}

	.session-desc {
		font-size: 0.7rem;
		font-weight: 400;
		margin-top: 0.1rem;
	}

	tr.section-divider {
		background: #e8e8e8;
		-webkit-print-color-adjust: exact;
		print-color-adjust: exact;
	}

	tr.section-divider td {
		padding: 0.2rem 0.4rem;
		font-weight: 700;
		background: #e8e8e8;
		-webkit-print-color-adjust: exact;
		print-color-adjust: exact;
	}

	tr.section-divider td.row-label {
		border-right: none;
	}

	.section-title {
		background: #e8e8e8 !important;
		border-left: none !important;
		-webkit-print-color-adjust: exact;
		print-color-adjust: exact;
	}

	td {
		padding: 0.15rem 0.3rem;
		text-align: center;
		vertical-align: middle;
		min-height: 1.2rem;
		line-height: 1.2;
	}

	td.row-label {
		text-align: left;
		font-weight: 600;
		background: #fff;
		min-width: 120px;
		white-space: normal;
		border-right: 2px solid #000;
		padding-left: 0.4rem;
	}

	td.cell {
		text-align: center;
		line-height: 1.2;
		white-space: pre-line;
	}
	.empty {
		color: #999;
	}

	/* More vertical spacing when no jury */
	.no-jury th {
		padding: 0.35rem 0.4rem;
	}

	.no-jury td {
		padding: 0.25rem 0.4rem;
		line-height: 1.4;
	}

	.no-jury tr.section-divider td {
		padding: 0.3rem 0.5rem;
	}

	.message {
		font-size: 1rem;
		color: #333;
		padding: 1rem;
		text-align: center;
	}

	/* Day grouping */
	.day-group {
		margin-bottom: 2rem;
	}

	.day-header {
		text-align: center;
		margin-bottom: 1rem;
		padding: 0.5rem 0;
		border-bottom: 2px solid #333;
	}

	.day-header h2 {
		font-size: 1.2rem;
		font-weight: 700;
		margin: 0;
		color: #000;
	}

	@media print {
		.protocol-sheet {
			padding: 0;
			font-size: 0.7rem;
		}

		@page {
			size: landscape;
			margin: 0.3in;
		}
		
		.sheet-header h1 {
			font-size: 1rem;
		}
		
		.protocol-table {
			font-size: 0.7rem;
		}

		/* Page break between days */
		.day-group.page-break {
			page-break-before: always;
		}

		.day-header {
			margin-top: 0;
			padding-top: 0;
		}
	}
</style>
