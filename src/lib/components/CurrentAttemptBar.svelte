<script>
	// Current attempt information bar component - shared across all scoreboards
	// Displays: start number, athlete name, team, attempt label, weight, timer, and decision lights
	
	export let currentAttempt = {};
	export let timerState = { seconds: 0, isRunning: false, isWarning: false, display: '0:00' };
	export let decisionState = {};
	export let scoreboardName = 'Scoreboard';
	export let sessionStatus = {};
	export let competition = {};
	export let showDecisionLights = true;  // For grid scoreboards, false for simpler scoreboards
	export let showTimer = true;  // Control whether to show timer slot
	export let compactMode = false;  // Simpler layout for team scoreboard
	export let showLifterInfo = true;  // Toggle athlete/attempt info display
	export let translations = {};  // Translated strings (session, snatch, etc.)
	
	function getRefereeClass(value) {
		if (value === 'good') return 'good';
		if (value === 'bad') return 'bad';
		return 'pending';
	}
</script>

{#if compactMode}
	<!-- Compact mode for team scoreboard -->
	<header class="header compact" data-scoreboard={scoreboardName}>
		{#if !sessionStatus?.isDone}
			{#if showLifterInfo}
				<div class="lifter-info">
					<div class="name-and-team">
						<span class="lifter-name">{currentAttempt?.fullName || 'No athlete currently lifting'}</span>
						{#if currentAttempt?.teamName}
							<span class="team">{currentAttempt.teamName}</span>
						{/if}
					</div>
					<span class="attempt-label">{@html currentAttempt?.attempt || ''}</span>
					<span class="weight">{currentAttempt?.weight || '-'} kg</span>
					<div class="timer {timerState.isRunning ? 'running' : ''} {timerState.isWarning ? 'warning' : ''}">
						{timerState.display}
					</div>
				</div>
			{/if}
		{/if}
		<div class="session-info">
			{@html competition?.groupInfo || (translations.session || 'Session')}
		</div>
	</header>
{:else}
	<!-- Full mode for grid scoreboards (session-results, lifting-order, rankings) -->
	<header class="header" data-scoreboard={scoreboardName}>
		{#if showLifterInfo}
			<div class="lifter-info">
				{#if sessionStatus?.isDone}
					<span class="lifter-name">{sessionStatus.statusMessage || 'Session Done.'}</span>
				{:else}
					<div class="name-and-team">
						<span class="lifter-name">{currentAttempt?.fullName || 'No athlete currently lifting'}</span>
						{#if currentAttempt?.teamName}
							<span class="team">{currentAttempt.teamName}</span>
						{/if}
					</div>
					<span class="attempt-label">{@html currentAttempt?.attempt || ''}</span>
					<span class="weight">{currentAttempt?.weight || '-'} kg</span>
					{#if showTimer || showDecisionLights}
						<div class="timer-decision-container">
							{#if showTimer}
								<div 
									class="timer-slot"
									class:visible={!decisionState?.visible}
									class:running={timerState.isRunning}
									class:warning={timerState.isWarning}
								>
									<span class="timer-display">{timerState.display}</span>
								</div>
							{/if}
							{#if showDecisionLights}
								<div class="decision-slot" class:visible={decisionState?.visible}>
									<div class="decision-lights" aria-label="Referee decisions">
										{#if !decisionState?.isSingleReferee}
											<div class="referee-light {getRefereeClass(decisionState?.ref1)}"></div>
										{/if}
										<div class="referee-light {getRefereeClass(decisionState?.ref2)}"></div>
										{#if !decisionState?.isSingleReferee}
											<div class="referee-light {getRefereeClass(decisionState?.ref3)}"></div>
										{/if}
									</div>
								</div>
							{/if}
						</div>
					{/if}
				{/if}
			</div>
		{/if}
		<div class="session-info">
			{#if sessionStatus?.isDone}
				{@html '&nbsp;'}
			{:else}
				{@html competition?.groupInfo || (translations.session || 'Session')}
			{/if}
		</div>
	</header>
{/if}

<style>
	/* Header - Current Lifter */
	.header {
		background: #000;
		padding: 0.75rem 1.5rem;
		border-bottom: 0.125rem solid #333;
	}

	.header.compact {
		padding: 0.5rem 1.5rem;
	}

	.lifter-info {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 0.25rem;
	}

	.name-and-team {
		display: flex;
		align-items: baseline;
		gap: 1rem;
		flex: 1;
		min-width: 0;
	}

	.lifter-name {
		font-size: 1.5rem;
		font-weight: bold;
		color: #fff;
		flex-shrink: 1;
		min-width: 0;
	}

	.team {
		font-size: 1.2rem;
		font-weight: 600;
		color: #cbd5f5;
		flex-shrink: 0;
		white-space: nowrap;
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
		background: #1a1a1a;
		color: #fbbf24;
		font-weight: bold;
		font-size: 1.5rem;
		font-family: 'Courier New', monospace;
		letter-spacing: 2px;
		padding: 0.35rem 0.75rem;
		border-radius: 0.25rem;
		width: 9rem;
		text-align: center;
	}

	.timer.running {
		color: #4ade80;
	}

	.timer.warning {
		color: #fbbf24;
		background: rgba(239, 68, 68, 0.2);
	}

	.timer-decision-container {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		width: 9rem;
		min-width: 9rem;
		height: 2.5rem;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.timer-slot,
	.decision-slot {
		display: none;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		border-radius: 0.25rem;
		padding: 0.35rem 0.75rem;
	}

	.timer-slot {
		background: #1a1a1a;
		color: #fbbf24;
		font-weight: bold;
	}

	.timer-slot.visible {
		display: flex;
	}

	.timer-slot.running {
		color: #4ade80;
	}

	.timer-slot.warning {
		color: #fbbf24;
		background: rgba(239, 68, 68, 0.2);
	}

	.timer-display {
		font-size: 1.5rem;
		font-family: 'Courier New', monospace;
		letter-spacing: 2px;
	}

	.decision-slot {
		background: rgba(26, 26, 26, 0.95);
	}

	.decision-slot.visible {
		display: flex;
	}

	.decision-lights {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.referee-light {
		width: 2.2rem;
		height: 2.2rem;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.1);
		border: 2px solid rgba(255, 255, 255, 0.2);
	}

	.referee-light.good {
		background: #ffffff;
		border-color: #ffffff;
	}

	.referee-light.bad {
		background: #dc2626;
		border-color: #dc2626;
	}

	.referee-light.pending {
		background: rgba(255, 255, 255, 0.1);
		border-color: rgba(255, 255, 255, 0.2);
	}

	.session-info {
		font-size: 1.2rem;
		color: #ccc;
		font-weight: bold;
		padding: 0.25rem 0;
	}
</style>
