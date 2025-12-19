<script>
	// Current attempt information bar component - shared across all scoreboards
	// Displays: start number, athlete name, team, attempt label, weight, timer, and decision lights
	// Display mode is computed server-side and passed in via displayMode prop:
	//   'decision' - show referee decision lights
	//   'break' - show break timer
	//   'athlete' - show athlete countdown timer
	//   'none' - show neither timer nor decision
    
	import CountdownTimer from './CountdownTimer.svelte';

	export let currentAttempt = {};
	export let decisionState = {};
	export let timerData = null;      // Athlete timer data from parent
	export let breakTimerData = null; // Break timer data from parent
	export let displayMode = 'none';  // Server-computed: 'decision' | 'break' | 'athlete' | 'none'
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
	
	// Computed visibility based on server-side displayMode
	$: showAthleteTimer = displayMode === 'athlete' && showTimer && competition?.showTimer;
	$: showBreakTimer = displayMode === 'break' && showTimer && competition?.showTimer;
	$: showDecisions = displayMode === 'decision' && showDecisionLights;
</script>

{#if compactMode}
	<!-- Compact mode for team scoreboard -->
	<header class="header compact" data-scoreboard={scoreboardName}>
		{#if !sessionStatus?.isDone}
			{#if showLifterInfo}
				<div class="lifter-info">
					<div class="name-and-team">
						<span class="lifter-name">{currentAttempt?.fullName || translations?.noAthleteLifting || 'No athlete currently lifting'}</span>
						{#if currentAttempt?.teamName}
							<span class="team">{currentAttempt.teamName}</span>
						{/if}
					</div>
					<span class="attempt-label">{@html currentAttempt?.attempt || ''}</span>
					{#if competition?.showWeight && currentAttempt?.weight}
						<span class="weight">{currentAttempt.weight} kg</span>
					{/if}

					{#if (showTimer && competition?.showTimer) || showDecisionLights}
						<div class="timer-decision-container compact-container">
							<!-- Athlete timer shown when displayMode is 'athlete' -->
							{#if showAthleteTimer}
								<div class="timer-slot">
									<CountdownTimer 
										{timerData}
										color={ATHLETE_TIMER_COLOR} 
										warningColor={ATHLETE_TIMER_WARNING}
									/>
								</div>
							{/if}
							<!-- Break timer shown when displayMode is 'break' -->
							{#if showBreakTimer}
								<div class="break-slot">
									<CountdownTimer 
										timerData={breakTimerData} 
										color={BREAK_TIMER_COLOR} 
										warningColor={BREAK_TIMER_WARNING}
									/>
								</div>
							{/if}
						<!-- Decision display: down signal (▼) or referee lights -->
						{#if showDecisions}
							<div class="decision-slot">
								{#if decisionState?.down && !decisionState?.ref1 && !decisionState?.ref2 && !decisionState?.ref3}
									<!-- Down signal: green triangle -->
									<div class="down-signal" aria-label="Down signal">▼</div>
								{:else}
									<!-- Referee decision lights -->
									<div class="decision-lights" aria-label="Referee decisions">
										{#if !decisionState?.isSingleReferee}
											<div class="referee-light {getRefereeClass(decisionState?.ref1)}"></div>
										{/if}
										<div class="referee-light {getRefereeClass(decisionState?.ref2)}"></div>
										{#if !decisionState?.isSingleReferee}
											<div class="referee-light {getRefereeClass(decisionState?.ref3)}"></div>
										{/if}
									</div>
								{/if}
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
		{/if}
		<div class="session-info">
			{@html competition?.sessionInfo || (translations.session || 'Session')}
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
						<span class="lifter-name">{currentAttempt?.fullName || translations?.noAthleteLifting || 'No athlete currently lifting'}</span>
						{#if currentAttempt?.teamName}
							<span class="team">{currentAttempt.teamName}</span>
						{/if}
					</div>
					<span class="attempt-label">{@html currentAttempt?.attempt || ''}</span>
					{#if competition?.showWeight && currentAttempt?.weight}
						<span class="weight">{currentAttempt.weight} kg</span>
					{/if}
					{#if (showTimer && competition?.showTimer) || showDecisionLights}
						<div class="timer-decision-container">
							<!-- Athlete timer shown when displayMode is 'athlete' -->
							{#if showAthleteTimer}
								<div class="timer-slot">
									<CountdownTimer 
										{timerData}
										color={ATHLETE_TIMER_COLOR} 
										warningColor={ATHLETE_TIMER_WARNING}
									/>
								</div>
							{/if}
							<!-- Break timer shown when displayMode is 'break' -->
							{#if showBreakTimer}
								<div class="break-slot">
									<CountdownTimer 
										timerData={breakTimerData} 
										color={BREAK_TIMER_COLOR} 
										warningColor={BREAK_TIMER_WARNING}
									/>
								</div>
							{/if}
							<!-- Decision display: down signal (▼) or referee lights -->
							{#if showDecisions}
								<div class="decision-slot">
									{#if decisionState?.down && !decisionState?.ref1 && !decisionState?.ref2 && !decisionState?.ref3}
										<!-- Down signal: green triangle -->
										<div class="down-signal" aria-label="Down signal">▼</div>
									{:else}
										<!-- Referee decision lights -->
										<div class="decision-lights" aria-label="Referee decisions">
											{#if !decisionState?.isSingleReferee}
												<div class="referee-light {getRefereeClass(decisionState?.ref1)}"></div>
											{/if}
											<div class="referee-light {getRefereeClass(decisionState?.ref2)}"></div>
											{#if !decisionState?.isSingleReferee}
												<div class="referee-light {getRefereeClass(decisionState?.ref3)}"></div>
											{/if}
										</div>
									{/if}
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
				{@html competition?.sessionInfo || (translations.session || 'Session')}
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
		min-width: 9rem;
		height: 2.5rem;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.timer-slot,
	.break-slot,
	.decision-slot {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		width: 100%;
		border-radius: 0.25rem;
		padding: 0.35rem 0.75rem;
	}

	.timer-slot,
	.break-slot {
		background: #1a1a1a;
		font-weight: bold;
	}

	.timer-display {
		font-size: 1.5rem;
		font-family: 'Courier New', monospace;
		letter-spacing: 2px;
	}

	.decision-slot {
		background: rgba(26, 26, 26, 0.95);
	}

	.down-signal {
		font-size: 2.5rem;
		color: #4ade80;
		font-weight: bold;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 0.5rem;
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
