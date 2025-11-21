<script>
	export let data = {};
</script>

<div class="referee-assignments">
	<h1>{data.competition?.name}</h1>
	
	{#if data.status === 'ready' && data.assignmentRows.length > 0}
		<div class="table-wrapper">
			<table class="assignments-table">
				<thead>
					<tr>
						<th class="official-type">Official Type</th>
						{#each data.sessions as session (session.id)}
							<th class="session" title={session.description}>
								{session.name}
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each data.assignmentRows as row (row.type)}
						<tr>
							<td class="official-type"><strong>{row.label}</strong></td>
							{#each row.assignments as assignment, i (row.type + '-' + i)}
								<td class="assignment" class:empty={assignment.isEmpty}>
									{assignment.name}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else if data.status === 'no_data'}
		<p class="message">No competition data available</p>
	{:else if data.status === 'no_groups'}
		<p class="message">No sessions/groups found in competition</p>
	{:else}
		<p class="message">Loading...</p>
	{/if}
</div>

<style>
	.referee-assignments {
		padding: 1.5rem;
		background: #fff;
		color: #000;
		min-height: 100vh;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
	}

	h1 {
		margin: 0 0 1.5rem 0;
		font-size: 1.8rem;
		color: #000;
	}

	.message {
		font-size: 1.1rem;
		color: #333;
		padding: 2rem;
		text-align: center;
	}

	.table-wrapper {
		overflow-x: auto;
		background: #fff;
	}

	.assignments-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.95rem;
		border: 1px solid #000;
	}

	thead {
		background: #fff;
		border-bottom: 2px solid #000;
	}

	th {
		padding: 0.75rem;
		text-align: left;
		font-weight: 600;
		color: #000;
		white-space: nowrap;
		border-right: 1px solid #ccc;
	}

	th.official-type {
		min-width: 150px;
		border-right: 2px solid #000;
	}

	th.session {
		min-width: 120px;
		font-size: 0.9rem;
	}

	tbody tr {
		border-bottom: 1px solid #ccc;
	}

	tbody tr:hover {
		background: #fff;
	}

	tbody tr:last-child {
		border-bottom: 1px solid #000;
	}

	td {
		padding: 0.75rem;
		color: #000;
		border-right: 1px solid #ccc;
	}

	td.official-type {
		background: #fff;
		font-weight: 600;
		color: #000;
		min-width: 150px;
		border-right: 2px solid #000;
	}

	td.assignment {
		text-align: center;
		font-size: 0.9rem;
		min-width: 120px;
	}

	td.assignment.empty {
		color: #999;
		font-style: italic;
	}

	@media print {
		.referee-assignments {
			padding: 0.5rem;
		}

		.message {
			padding: 1rem;
		}

		th, td {
			padding: 0.5rem;
		}
	}
</style>
