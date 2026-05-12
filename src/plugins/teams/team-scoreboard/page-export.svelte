<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	
	export let data = {};
	export let scoreboardType = '';  // Passed from route, identifies the actual scoreboard (e.g., 'équipes')
	
	let isExporting = false;
	let exportStatus = '';
	
	// Get display-friendly option values
	$: scoringSystem = data.options?.scoringSystem || 'Sinclair';
	$: gender = data.options?.gender || 'Current';
	$: fopName = data.fopName || 'Platform';
	$: competitionName = data.competition?.name || 'Competition';
	$: includeAllAthletes = data.options?.allAthletes === true;
	$: exportOnlyScoringAthletes = data.options?.exportOnlyScoringAthletes !== false;
	$: exportsAllAthletes = includeAllAthletes || !exportOnlyScoringAthletes;
	
	/**
	 * Trigger Excel export via plugin-action API
	 * @param {'exportScoreboard' | 'exportFlat'} action - Export format
	 */
	async function exportExcel(action) {
		isExporting = true;
		exportStatus = 'Generating Excel file...';
		
		try {
			// Build URL with all current options
			const params = new URLSearchParams();
			params.append('plugin', scoreboardType || 'team-scoreboard');
			params.append('action', action);
			
			// Add all options from the page data
			if (data.options) {
				Object.entries(data.options).forEach(([key, value]) => {
					if (value !== undefined && value !== null && value !== '') {
						params.append(key, value);
					}
				});
			}
			
			// Add platform/FOP
			if (fopName) {
				params.append('platform', fopName);
			}
			
			// Fetch the Excel file
			const response = await fetch(`/api/plugin-action?${params.toString()}`);
			
			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Export failed');
			}
			
			// Check if response is binary (Excel) or JSON (error)
			const contentType = response.headers.get('content-type');
			if (contentType && contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
				// Binary Excel file - trigger download
				const blob = await response.blob();
				const url = URL.createObjectURL(blob);
				
				// Extract filename from Content-Disposition header
				const disposition = response.headers.get('content-disposition');
				let filename = 'Team_Results.xlsx';
				if (disposition && disposition.includes('filename=')) {
					const matches = /filename="?([^"]+)"?/.exec(disposition);
					if (matches && matches[1]) {
						filename = matches[1];
					}
				}
				
				// Create temporary link and trigger download
				const a = document.createElement('a');
				a.href = url;
				a.download = filename;
				document.body.appendChild(a);
				a.click();
				
				// Cleanup
				document.body.removeChild(a);
				URL.revokeObjectURL(url);
				
				exportStatus = '✅ Download complete!';
			} else {
				// JSON response - likely an error
				const result = await response.json();
				throw new Error(result.message || 'Unexpected response format');
			}
		} catch (error) {
			exportStatus = `❌ Error: ${error.message}`;
			console.error('[Export] Error:', error);
		} finally {
			isExporting = false;
			
			// Clear status after a few seconds
			setTimeout(() => {
				exportStatus = '';
			}, 3000);
		}
	}
	
	onMount(() => {
		console.log('[Export Page] Mounted with data:', data);
	});
</script>

<svelte:head>
	<title>Export Team Results - {competitionName}</title>
</svelte:head>

<div class="export-page">
	<header class="header">
		<h1>📊 Export Team Results</h1>
		<p class="subtitle">{competitionName}</p>
	</header>
	
	<main class="content">
		<div class="info-card">
			<h2>Export Settings</h2>
			<div class="info-grid">
				<div class="info-item">
					<span class="label">Platform:</span>
					<span class="value">{fopName}</span>
				</div>
				<div class="info-item">
					<span class="label">Scoring System:</span>
					<span class="value">{scoringSystem}</span>
				</div>
				<div class="info-item">
					<span class="label">Gender:</span>
					<span class="value">{gender}</span>
				</div>
				<div class="info-item">
					<span class="label">Exported Athletes:</span>
					<span class="value">{exportsAllAthletes ? 'All athletes' : 'Only team scorers'}</span>
				</div>
				{#if data.options?.allAthletes === false}
					<div class="info-item">
						<span class="label">Top Athletes:</span>
						<span class="value">
							{#if gender === 'M'}
								Top {data.options.topM || 4}
							{:else if gender === 'F'}
								Top {data.options.topF || 4}
							{:else if gender === 'MF'}
								Top {data.options.topMFm || 2} men + {data.options.topMFf || 2} women
							{:else}
								Configured
							{/if}
						</span>
					</div>
				{/if}
			</div>
		</div>
		
		<div class="export-buttons">
			<button 
				class="export-btn scoreboard-btn"
				on:click={() => exportExcel('exportScoreboard')}
				disabled={isExporting}
				title="Export with team grouping and team scores, matching the scoreboard layout"
			>
				<div class="btn-icon">📊</div>
				<div class="btn-content">
					<div class="btn-title">Scoreboard Format</div>
					<div class="btn-description">Team-grouped with headers and totals</div>
				</div>
			</button>
			
			<button 
				class="export-btn flat-btn"
				on:click={() => exportExcel('exportFlat')}
				disabled={isExporting}
				title="Export as a flat table, one row per athlete"
			>
				<div class="btn-icon">📋</div>
				<div class="btn-content">
					<div class="btn-title">Flat File</div>
					<div class="btn-description">One row per athlete, sorted by team</div>
				</div>
			</button>
		</div>
		
		{#if exportStatus}
			<div class="status-message" class:error={exportStatus.includes('❌')}>
				{exportStatus}
			</div>
		{/if}
		
		{#if isExporting}
			<div class="loading-spinner">
				<div class="spinner"></div>
				<p>Generating Excel file...</p>
			</div>
		{/if}
		
		<div class="notes">
			<h3>📝 Notes</h3>
			<ul>
				<li><strong>Scoreboard Format:</strong> Preserves the visual layout with team headers, merged cells, and team totals.</li>
				<li><strong>Flat File:</strong> Simple table format with one row per athlete, suitable for data analysis.</li>
				<li><strong>Export Scope:</strong> {exportsAllAthletes ? 'All athletes are exported.' : 'Only athletes included in each team score are exported.'}</li>
				<li>Both formats exclude predicted total and predicted score columns.</li>
				<li>Failed attempts are shown with strikethrough formatting, successful attempts in bold.</li>
			</ul>
		</div>
	</main>
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		background: #1a1a1a;
		color: #fff;
		font-family: Arial, sans-serif;
	}
	
	.export-page {
		min-height: 100vh;
		background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
		padding: 2rem;
	}
	
	.header {
		text-align: center;
		margin-bottom: 3rem;
	}
	
	.header h1 {
		font-size: 2.5rem;
		margin: 0 0 0.5rem 0;
		color: #4472C4;
	}
	
	.subtitle {
		font-size: 1.2rem;
		color: #aaa;
		margin: 0;
	}
	
	.content {
		max-width: 900px;
		margin: 0 auto;
	}
	
	.info-card {
		background: #2a2a2a;
		border-radius: 12px;
		padding: 1.5rem 2rem;
		margin-bottom: 2rem;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
	}
	
	.info-card h2 {
		margin: 0 0 1rem 0;
		color: #4472C4;
		font-size: 1.3rem;
	}
	
	.info-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
	}
	
	.info-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	
	.info-item .label {
		font-size: 0.9rem;
		color: #888;
		font-weight: 500;
	}
	
	.info-item .value {
		font-size: 1.1rem;
		color: #fff;
		font-weight: 600;
	}
	
	.export-buttons {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 1.5rem;
		margin-bottom: 2rem;
	}
	
	.export-btn {
		background: #2a2a2a;
		border: 2px solid #4472C4;
		border-radius: 12px;
		padding: 1.5rem;
		cursor: pointer;
		transition: all 0.3s ease;
		display: flex;
		align-items: center;
		gap: 1rem;
		color: #fff;
		font-family: inherit;
	}
	
	.export-btn:hover:not(:disabled) {
		background: #3a3a3a;
		border-color: #5a92e4;
		transform: translateY(-2px);
		box-shadow: 0 6px 12px rgba(68, 114, 196, 0.3);
	}
	
	.export-btn:active:not(:disabled) {
		transform: translateY(0);
	}
	
	.export-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	
	.btn-icon {
		font-size: 2.5rem;
		flex-shrink: 0;
	}
	
	.btn-content {
		text-align: left;
		flex-grow: 1;
	}
	
	.btn-title {
		font-size: 1.3rem;
		font-weight: 600;
		margin-bottom: 0.25rem;
	}
	
	.btn-description {
		font-size: 0.9rem;
		color: #aaa;
	}
	
	.status-message {
		text-align: center;
		padding: 1rem;
		background: #2a4a2a;
		border: 2px solid #4a9a4a;
		border-radius: 8px;
		font-size: 1.1rem;
		margin-bottom: 2rem;
	}
	
	.status-message.error {
		background: #4a2a2a;
		border-color: #9a4a4a;
	}
	
	.loading-spinner {
		text-align: center;
		padding: 2rem;
	}
	
	.spinner {
		border: 4px solid #3a3a3a;
		border-top: 4px solid #4472C4;
		border-radius: 50%;
		width: 50px;
		height: 50px;
		animation: spin 1s linear infinite;
		margin: 0 auto 1rem auto;
	}
	
	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}
	
	.notes {
		background: #2a2a2a;
		border-radius: 12px;
		padding: 1.5rem 2rem;
		margin-top: 2rem;
	}
	
	.notes h3 {
		margin: 0 0 1rem 0;
		color: #4472C4;
	}
	
	.notes ul {
		margin: 0;
		padding-left: 1.5rem;
		line-height: 1.8;
	}
	
	.notes li {
		margin-bottom: 0.5rem;
		color: #ccc;
	}
	
	.notes strong {
		color: #fff;
	}
	
	@media (max-width: 768px) {
		.export-page {
			padding: 1rem;
		}
		
		.header h1 {
			font-size: 2rem;
		}
		
		.export-buttons {
			grid-template-columns: 1fr;
		}
	}
</style>
