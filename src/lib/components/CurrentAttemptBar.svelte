<script>
	// Current attempt information bar component - shared across all scoreboards
	// Displays: start number, athlete name, team, attempt label, weight, timer, and decision lights
	// NO TIMER STATE HERE - just passes data to CountdownTimer components
	
	import CountdownTimer from './CountdownTimer.svelte';

	export let currentAttempt = {};
	export let decisionState = {};
	export let timerData = null;      // Athlete timer data from parent
	export let breakTimerData = null; // Break timer data from parent
	export let scoreboardName = 'Scoreboard';
	export let sessionStatus = {};
	export let competition = {};
	export let showDecisionLights = true;
	export let showTimer = true;
	export let compactMode = false;
	export let showLifterInfo = true;
	export let translations = {};
	
	// Timer colors (no state, just constants)
	const ATHLETE_TIMER_COLOR = '#4ade80';    // Green
	const ATHLETE_TIMER_WARNING = '#fbbf24';  // Yellow
	const BREAK_TIMER_COLOR = '#00d4d4';      // Turquoise
	const BREAK_TIMER_WARNING = '#00d4d4';    // Keep turquoise
	
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

					{#if showTimer || showDecisionLights}
						<div class="timer-decision-container compact-container">
							<!-- All three occupy same space, CSS display:none controls visibility -->
							<div class="timer-slot">
								<CountdownTimer 
									{timerData}
									color={ATHLETE_TIMER_COLOR} 
									warningColor={ATHLETE_TIMER_WARNING}
								/>
							</div>
							<div class="break-slot">
								<CountdownTimer 
									timerData={breakTimerData} 
									color={BREAK_TIMER_COLOR} 
									warningColor={BREAK_TIMER_WARNING}
								/>
							</div>
						{#if showDecisionLights}
							<div class="decision-slot">
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
						<!-- All three occupy same space, CSS display:none controls visibility -->
						<div class="timer-slot">
							<CountdownTimer 
								{timerData}
								color={ATHLETE_TIMER_COLOR} 
								warningColor={ATHLETE_TIMER_WARNING}
							/>
						</div>
						<div class="break-slot">
							<CountdownTimer 
								timerData={breakTimerData} 
								color={BREAK_TIMER_COLOR} 
								warningColor={BREAK_TIMER_WARNING}
							/>
						</div>
						{#if showDecisionLights}
								<div class="decision-slot">
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

	/* Container for timer/break/decision - only one visible at a time via display:none/flex */
	.timer-decision-container {
		flex-shrink: 0;
	}

	/* All three slots: same size, only one visible at a time */
	.timer-slot,
	.break-slot,
	.decision-slot {
		display: none;
		align-items: center;
		justify-content: center;
		width: 9rem;
		height: 2.5rem;
		border-radius: 0.25rem;
		background: #1a1a1a;
		font-weight: bold;
	}

	.timer-slot {
		color: #4ade80;
	}

	.break-slot {
		color: #00d4d4;
	}

	.decision-slot {
		background: rgba(26, 26, 26, 0.95);
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
