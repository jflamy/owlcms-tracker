<script>
	import { onMount } from 'svelte';
	import SystemStatus from '$lib/components/SystemStatus.svelte';
	
	// Props from server-side load function
	export let data;
	
	// Simple display data
	let learningMode = data.scoreboardData?.learningMode || 'unknown';
	let connectionStatus = 'ready';
	let timerInterval = null;
	
	// Update timer display
	$: if (scoreboardData?.timer) {
		updateTimerDisplay();
	}
	
	onMount(() => {
		// Connect to the server-sent events stream
		eventSource = new EventSource('/api/client-stream');
		
		eventSource.onopen = () => {
			connectionStatus = 'connected';
		};
		
		eventSource.onmessage = (event) => {
			try {
				const message = JSON.parse(event.data);
				
				if (message.type === 'state_update') {
					// Update our local data with new server state
					// The server will send us pre-processed scoreboard data
					if (message.data) {
						// For now, we'll reconstruct the scoreboard data from the raw state
						// In the future, the server could send pre-processed scoreboard data
						scoreboardData = {
							...scoreboardData,
							currentAthlete: message.data.fullName ? {
								name: message.data.fullName,
								team: message.data.teamName,
								startNumber: message.data.startNumber,
								category: message.data.categoryName,
								attempt: message.data.attempt,
								attemptNumber: message.data.attemptNumber,
								weight: message.data.weight,
								timeAllowed: message.data.timeAllowed
							} : scoreboardData.currentAthlete,
							timer: {
								state: message.data.timerRunning === 'true' ? 'running' : 'stopped',
								timeRemaining: message.data.athleteMillisRemaining || 0,
								duration: message.data.timeAllowed || 60000,
								startTime: message.data.timerRunning === 'true' ? Date.now() : null
							},
							competition: {
								...scoreboardData.competition,
								name: message.data.competitionName || scoreboardData.competition.name,
								fop: message.data.fop || scoreboardData.competition.fop,
								state: message.data.fopState || scoreboardData.competition.state
							},
							lastUpdate: Date.now()
						};
					}
					connectionStatus = 'ready';
				} else if (message.type === 'timer_update') {
					// Update timer state without full state refresh
					if (scoreboardData) {
						scoreboardData.timer = {
							...scoreboardData.timer,
							...message.data
						};
						// Trigger reactivity
						scoreboardData = scoreboardData;
					}
				} else if (message.type === 'waiting') {
					connectionStatus = 'waiting';
				} else if (message.type === 'keepalive') {
					// Ignore keepalive messages
				}
			} catch (err) {
				console.error('Failed to parse SSE message:', err);
			}
		};
		
		eventSource.onerror = () => {
			connectionStatus = 'error';
		};
		
		return () => {
			if (eventSource) {
				eventSource.close();
			}
			if (timerInterval) {
				clearInterval(timerInterval);
			}
		};
	});
	
	function updateTimerDisplay() {
		if (timerInterval) {
			clearInterval(timerInterval);
		}
		
		if (scoreboardData?.timer?.state === 'running' && scoreboardData.timer.startTime) {
			timerInterval = setInterval(() => {
				const elapsed = Date.now() - scoreboardData.timer.startTime;
				displayTimeRemaining = Math.max(0, scoreboardData.timer.duration - elapsed);
				
				if (displayTimeRemaining <= 0) {
					clearInterval(timerInterval);
				}
			}, 100); // Update every 100ms for smooth countdown
		} else {
			displayTimeRemaining = scoreboardData?.timer?.timeRemaining || 0;
		}
	}
</script>

<svelte:head>
	<title>OWLCMS Scoreboard</title>
</svelte:head>

<div class="scoreboard">
	<!-- System Status -->
	<div class="system-status">
		<SystemStatus />
	</div>
	
	<!-- Header -->
	<header class="competition-header">
		<h1>{scoreboardData?.competition?.name || 'OWLCMS Competition'}</h1>
		<div class="header-info">
			<span class="fop">FOP: {scoreboardData?.competition?.fop || 'A'}</span>
			<span class="session">Session: {scoreboardData?.competition?.session || 'A'}</span>
			<span class="connection-status status-{connectionStatus}">{connectionStatus}</span>
		</div>
	</header>

	<!-- Main Display -->
	<main class="main-display">
		{#if connectionStatus === 'connecting'}
			<div class="status-message">
				<div class="spinner"></div>
				<p>Connecting to competition server...</p>
			</div>
		{:else if connectionStatus === 'error'}
			<div class="status-message error">
				<p>Connection error. Attempting to reconnect...</p>
			</div>
		{:else if scoreboardData?.status === 'waiting'}
			<div class="status-message">
				<p>Waiting for competition data...</p>
			</div>
		{:else}
			<!-- Competition Status -->
			<div class="competition-status">
				<h2>{getCompetitionStatus(scoreboardData)}</h2>
			</div>

			{#if scoreboardData?.currentAthlete}
				<!-- Current Athlete Display -->
				<div class="current-athlete">
					<div class="athlete-info">
						<h3 class="athlete-name">{scoreboardData.currentAthlete.name}</h3>
						<div class="athlete-details">
							<span class="start-number">#{scoreboardData.currentAthlete.startNumber}</span>
							<span class="team">{scoreboardData.currentAthlete.team || 'No Team'}</span>
							<span class="category">{scoreboardData.currentAthlete.category || 'Unknown'}</span>
						</div>
					</div>
					
					<div class="attempt-info">
						<div class="attempt-details">
							<span class="attempt-type">{scoreboardData.currentAthlete.attempt || 'Unknown Lift'}</span>
							<span class="attempt-number">Attempt {scoreboardData.currentAthlete.attemptNumber || '?'}</span>
						</div>
						<div class="weight">{scoreboardData.currentAthlete.weight || '?'} kg</div>
					</div>
				</div>

				<!-- Timer Display -->
				<div class="timer-display">
					<div class="timer {getTimerStatusColor(scoreboardData.timer)}">
						{formatTimeRemaining(displayTimeRemaining)}
					</div>
					<div class="timer-state">
						{scoreboardData.timer.state === 'running' ? 'Running' : 'Stopped'}
					</div>
				</div>
			{:else}
				<!-- No Current Athlete -->
				<div class="no-athlete">
					<p>No athlete currently lifting</p>
					{#if scoreboardData?.isBreak}
						<p class="break-info">Break in progress: {scoreboardData.breakType || 'Unknown'}</p>
					{/if}
				</div>
			{/if}

			<!-- Leaderboard Section -->
			{#if scoreboardData?.rankings && scoreboardData.rankings.length > 0}
				<div class="leaderboard-section">
					<h3>Current Rankings</h3>
					<div class="leaderboard">
						{#each scoreboardData.rankings.slice(0, 5) as athlete, index}
							<div class="leaderboard-row" class:leader={index === 0}>
								<span class="rank">#{index + 1}</span>
								<span class="athlete-name">{athlete.fullName || athlete.name}</span>
								<span class="team-name">{athlete.teamName || athlete.team || ''}</span>
								<span class="total">{athlete.total || 0} kg</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Competition Stats -->
			{#if scoreboardData?.stats}
				<div class="stats-section">
					<div class="stat-item">
						<span class="stat-value">{scoreboardData.stats.totalAthletes}</span>
						<span class="stat-label">Athletes</span>
					</div>
					<div class="stat-item">
						<span class="stat-value">{scoreboardData.stats.activeAthletes}</span>
						<span class="stat-label">Active</span>
					</div>
					<div class="stat-item">
						<span class="stat-value">{scoreboardData.stats.completedAthletes}</span>
						<span class="stat-label">Completed</span>
					</div>
					<div class="stat-item">
						<span class="stat-value">{scoreboardData.stats.categories.length}</span>
						<span class="stat-label">Categories</span>
					</div>
				</div>
			{/if}
		{/if}
	</main>

	<!-- Footer -->
	<footer class="scoreboard-footer">
		<div class="last-update">
			{#if scoreboardData?.lastUpdate}
				Last update: {new Date(scoreboardData.lastUpdate).toLocaleTimeString()}
			{/if}
		</div>
		<div class="competition-state">
			State: {scoreboardData?.competition?.state || 'Unknown'}
		</div>
	</footer>
</div>

<style>
	.scoreboard {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
	}

	.system-status {
		position: absolute;
		top: 1rem;
		right: 1rem;
		z-index: 10;
	}

	.competition-header {
		background: rgba(0, 0, 0, 0.3);
		padding: 1rem 2rem;
		border-bottom: 2px solid rgba(255, 255, 255, 0.2);
	}

	.competition-header h1 {
		margin: 0;
		font-size: 2rem;
		font-weight: 600;
	}

	.header-info {
		display: flex;
		gap: 2rem;
		margin-top: 0.5rem;
		font-size: 0.9rem;
		opacity: 0.9;
	}

	.connection-status {
		padding: 0.25rem 0.75rem;
		border-radius: 1rem;
		font-size: 0.8rem;
		font-weight: 500;
	}

	.status-connecting { background: rgba(255, 193, 7, 0.8); color: #000; }
	.status-connected { background: rgba(40, 167, 69, 0.8); }
	.status-ready { background: rgba(40, 167, 69, 0.8); }
	.status-error { background: rgba(220, 53, 69, 0.8); }

	.main-display {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		padding: 2rem;
		text-align: center;
	}

	.status-message {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.status-message.error {
		color: #ff6b6b;
	}

	.spinner {
		width: 3rem;
		height: 3rem;
		border: 4px solid rgba(255, 255, 255, 0.3);
		border-top: 4px solid white;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	.competition-status h2 {
		margin: 0 0 2rem 0;
		font-size: 1.5rem;
		opacity: 0.9;
	}

	.current-athlete {
		background: rgba(255, 255, 255, 0.1);
		border-radius: 1rem;
		padding: 2rem;
		margin: 2rem 0;
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.2);
		max-width: 600px;
		width: 100%;
	}

	.athlete-info {
		margin-bottom: 1.5rem;
	}

	.athlete-name {
		font-size: 2.5rem;
		margin: 0 0 1rem 0;
		font-weight: 700;
	}

	.athlete-details {
		display: flex;
		gap: 1.5rem;
		justify-content: center;
		flex-wrap: wrap;
		font-size: 1.1rem;
		opacity: 0.9;
	}

	.start-number {
		font-weight: 600;
		background: rgba(255, 255, 255, 0.2);
		padding: 0.25rem 0.75rem;
		border-radius: 0.5rem;
	}

	.attempt-info {
		border-top: 1px solid rgba(255, 255, 255, 0.2);
		padding-top: 1.5rem;
	}

	.attempt-details {
		display: flex;
		gap: 1rem;
		justify-content: center;
		margin-bottom: 1rem;
		font-size: 1.2rem;
		opacity: 0.9;
	}

	.weight {
		font-size: 3rem;
		font-weight: 700;
		color: #ffd700;
		text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
	}

	.timer-display {
		margin: 2rem 0;
	}

	.timer {
		font-size: 4rem;
		font-weight: 700;
		margin-bottom: 0.5rem;
		text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
	}

	.timer-state {
		font-size: 1.2rem;
		opacity: 0.8;
	}

	.text-gray-500 { color: #9ca3af; }
	.text-green-600 { color: #16a34a; }
	.text-yellow-600 { color: #ca8a04; }
	.text-red-600 { 
		color: #dc2626;
		animation: pulse 1s infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.7; }
	}

	.no-athlete {
		background: rgba(255, 255, 255, 0.1);
		border-radius: 1rem;
		padding: 3rem;
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.no-athlete p {
		margin: 0;
		font-size: 1.5rem;
		opacity: 0.8;
	}

	.break-info {
		margin-top: 1rem !important;
		font-size: 1.2rem !important;
		color: #ffd700;
	}

	.leaderboard-section {
		background: rgba(255, 255, 255, 0.1);
		border-radius: 1rem;
		padding: 1.5rem;
		margin: 2rem 0;
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.2);
		max-width: 600px;
		width: 100%;
	}

	.leaderboard-section h3 {
		margin: 0 0 1rem 0;
		font-size: 1.3rem;
		opacity: 0.9;
		text-align: center;
	}

	.leaderboard {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.leaderboard-row {
		display: grid;
		grid-template-columns: 3rem 1fr 1fr 5rem;
		gap: 1rem;
		padding: 0.75rem;
		background: rgba(255, 255, 255, 0.05);
		border-radius: 0.5rem;
		align-items: center;
		font-size: 0.9rem;
	}

	.leaderboard-row.leader {
		background: rgba(255, 215, 0, 0.2);
		border: 1px solid rgba(255, 215, 0, 0.3);
	}

	.leaderboard-row .rank {
		font-weight: 600;
		text-align: center;
	}

	.leaderboard-row .athlete-name {
		font-weight: 500;
	}

	.leaderboard-row .team-name {
		opacity: 0.8;
		font-size: 0.8rem;
	}

	.leaderboard-row .total {
		font-weight: 600;
		text-align: right;
	}

	.stats-section {
		display: flex;
		gap: 1.5rem;
		margin: 2rem 0;
		justify-content: center;
		flex-wrap: wrap;
	}

	.stat-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		background: rgba(255, 255, 255, 0.1);
		padding: 1rem;
		border-radius: 0.75rem;
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.2);
		min-width: 4rem;
	}

	.stat-value {
		font-size: 1.5rem;
		font-weight: 700;
		color: #ffd700;
	}

	.stat-label {
		font-size: 0.8rem;
		opacity: 0.8;
		margin-top: 0.25rem;
	}

	.scoreboard-footer {
		background: rgba(0, 0, 0, 0.3);
		padding: 1rem 2rem;
		border-top: 1px solid rgba(255, 255, 255, 0.2);
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.9rem;
		opacity: 0.8;
	}

	@media (max-width: 768px) {
		.competition-header {
			padding: 1rem;
		}

		.competition-header h1 {
			font-size: 1.5rem;
		}

		.header-info {
			flex-direction: column;
			gap: 0.5rem;
		}

		.main-display {
			padding: 1rem;
		}

		.athlete-name {
			font-size: 2rem;
		}

		.athlete-details {
			flex-direction: column;
			gap: 0.5rem;
		}

		.timer {
			font-size: 3rem;
		}

		.weight {
			font-size: 2.5rem;
		}

		.leaderboard-row {
			grid-template-columns: 2rem 1fr 1fr 4rem;
			gap: 0.5rem;
			font-size: 0.8rem;
		}

		.stats-section {
			gap: 1rem;
		}

		.stat-item {
			min-width: 3rem;
		}

		.stat-value {
			font-size: 1.2rem;
		}

		.scoreboard-footer {
			flex-direction: column;
			gap: 0.5rem;
			text-align: center;
		}
	}
</style>