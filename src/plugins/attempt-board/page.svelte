<script>
	/**
	 * Attempt Board - Full screen layout
	 * Matches OWLCMS Attempt Board design
	 */
	import CountdownTimer from '$lib/components/CountdownTimer.svelte';
	import PlatesElement from '$lib/components/PlatesElement.svelte';
	
	export let data = {};
	
	// Timer colors (match owlcms colors.css exactly)
	const ATHLETE_TIMER_COLOR = 'yellow';      // --athleteTimerColor
	const ATHLETE_TIMER_WARNING = 'yellow';    // Same as main timer
	const BREAK_TIMER_COLOR = 'skyblue';       // --breakTimerColor
	
	// Reactive data
	$: currentAttempt = data.currentAttempt;
	$: plates = data.plates || [];
	$: decision = data.decision || {};
	$: displayMode = data.displayMode || 'none';
	$: options = data.options || {};
	
	// Decision display logic
	$: showDecisionArea = displayMode === 'decision' && options.showDecisions;
	$: showDownSignal = decision?.down && !decision?.ref1 && !decision?.ref2 && !decision?.ref3;
	
	// Long name handling (matches owlcms AbstractAttemptBoard.java)
	$: isLongLastName = (currentAttempt?.lastName?.length || 0) > 18;
	$: lastNameStyle = isLongLastName 
		? 'font-size: 8vh; line-height: 8vh; text-wrap: balance; overflow: hidden;' 
		: '';
	$: firstNameStyle = isLongLastName 
		? 'font-size: 8vh; line-height: 12vh; text-wrap: wrap; overflow: hidden;' 
		: '';
	
	// Flag display
	$: hasFlag = !!currentAttempt?.flagUrl;
	
	// Picture display
	$: hasPicture = !!currentAttempt?.pictureUrl;
	
	// Referee decision class
	function getRefClass(value) {
		if (value === 'good') return 'good';
		if (value === 'bad') return 'bad';
		return 'pending';
	}
</script>

<svelte:head>
	<title>{data.scoreboardName || 'Attempt Board'} - {data.competition?.name || 'OWLCMS'}</title>
</svelte:head>

<div class="wrapper">
	{#if data.status === 'waiting' || !currentAttempt}
		<div class="waiting-message">
			<div class="big-title">
				<div class="competition-name">{data.competition?.name || ''}</div>
				<div class="next-group">{data.message || ''}</div>
			</div>
		</div>
	{:else}
		<div class="attempt-board">
			<!-- Last Name -->
			<div class="last-name" class:with-picture={hasPicture} style={lastNameStyle}>{currentAttempt.lastName || ''}</div>
			
			<!-- First Name -->
			<div class="first-name" class:with-flag={hasFlag} class:with-picture={hasPicture} style={firstNameStyle}>{currentAttempt.firstName || ''}</div>
			
			<!-- Team Flag -->
			{#if hasFlag}
				<div class="flag" class:with-picture={hasPicture}>
					<img src={currentAttempt.flagUrl} alt="" />
				</div>
			{/if}
			
			<!-- Athlete Picture -->
			{#if hasPicture}
				<div class="picture">
					<img src={currentAttempt.pictureUrl} alt="" />
				</div>
			{/if}
			
			<!-- Team Name -->
			<div class="team-name">{currentAttempt.teamName || ''}</div>
			
			<!-- Start Number -->
			<div class="start-number">
				<span>{currentAttempt.startNumber || ''}</span>
			</div>
			
			<!-- Category -->
			<div class="category">{currentAttempt.categoryName || ''}</div>
			
			<!-- Weight -->
			<div class="weight">
				<span class="weight-value">{currentAttempt.weight || ''}</span>
				<span class="weight-unit">kg</span>
			</div>
			
			<!-- Barbell / Decision Area -->
			{#if showDecisionArea}
				<div class="decision-area">
					{#if showDownSignal}
						<div class="down-signal">▼</div>
					{:else}
						<div class="decision-lights">
							{#if !decision.isSingleReferee}
								<div class="ref-light {getRefClass(decision.ref1)}"></div>
							{/if}
							<div class="ref-light {getRefClass(decision.ref2)}"></div>
							{#if !decision.isSingleReferee}
								<div class="ref-light {getRefClass(decision.ref3)}"></div>
							{/if}
						</div>
					{/if}
				</div>
			{:else if options.showPlates && data.platform}
				<div class="barbell">
					<!-- Debug: weight={currentAttempt.weight}, barWeight={currentAttempt.barWeight}, platform={!!data.platformPlates} -->
					<PlatesElement 
						weight={currentAttempt.weight || 0}
						barWeight={currentAttempt.barWeight || 20}
						platform={data.platformPlates}
					/>
				</div>
			{:else}
				<!-- DEBUG: showPlates={options.showPlates}, platform={!!data.platform} -->
				<div class="barbell-placeholder"></div>
			{/if}
			
			<!-- Attempt Label (hidden when decisions shown) -->
			{#if !showDecisionArea}
				<div class="attempt">{@html currentAttempt.attempt || ''}</div>
			{/if}
			
			<!-- Timer -->
			{#if options.showTimer}
				<div class="timer-area">
					{#if displayMode === 'break'}
						<div class="timer break-time">
							<CountdownTimer 
								timerData={data.breakTimer}
								color={BREAK_TIMER_COLOR}
								warningColor={BREAK_TIMER_COLOR}
							/>
						</div>
					{:else if displayMode === 'athlete' || displayMode === 'none'}
						<div class="timer athlete-timer">
							<CountdownTimer 
								timerData={data.timer}
								color={ATHLETE_TIMER_COLOR}
								warningColor={ATHLETE_TIMER_WARNING}
							/>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
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
	
	.wrapper {
		box-sizing: border-box;
		font: Arial;
		color: #fff;
		background-color: #000;
		height: 100svh;
		width: 100vw;
		overflow: hidden;
	}
	
	.attempt-board {
		box-sizing: border-box;
		font-family: Arial, Helvetica, sans-serif;
		display: grid;
		width: 100vw;
		height: 100vh;
		padding: 3vmin;
		
		grid-template-columns: 
			[name-start number-start weight-start] 1fr 
			[number-end] 2fr 
			[weight-end barbell-start decision-start] 4fr 
			[barbell-end timer-start attempt-start] 2fr 
			[timer-end name-end decision-end attempt-end];
		
		grid-template-rows:
			[lastname-start] 15vh
			[lastname-end firstname-start] 15vh
			[firstname-end teamname-start decision-start] 10vh
			[teamname-end] 8vh
			[number-start attempt-start barbell-start] 20vh
			[number-end attempt-end weight-start timer-start] 25vh
			[weight-end barbell-end timer-end decision-end];
		
		align-items: stretch;
		justify-items: stretch;
		overflow: hidden;
	}
	
	/* === Name Display === */
	.last-name {
		grid-area: lastname-start / name-start / lastname-end / name-end;
		font-size: 12vh;
		line-height: 12vh;
		color: #ffffff;
		align-self: end;
		justify-self: start;
	}
	
	.first-name {
		grid-area: firstname-start / name-start / firstname-end / timer-start;
		font-size: 10vh;
		line-height: 12vh;
		color: #ffffff;
		justify-self: start;
		white-space: normal;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 76vw;
		max-height: 12vh;
		display: block;
	}
	
	/* When flag is present, reduce first-name width */
	.first-name.with-flag {
		max-width: 55vw;
	}
	
	/* When picture is present, reduce name sizes */
	.last-name.with-picture {
		font-size: 9vh;
		line-height: 10vh;
	}
	
	.first-name.with-picture {
		font-size: 9vh;
		line-height: 10vh;
		max-height: 10vh;
		max-width: 70vw;
	}
	
	/* Team Flag */
	.flag {
		grid-area: firstname-start / timer-start / teamname-end / timer-end;
		display: grid;
		place-items: center;
		border: none;
		width: fit-content;
		height: fit-content;
		justify-self: center;
		align-self: center;
	}
	
	/* Flag with picture present - smaller and positioned differently */
	.flag.with-picture {
		grid-area: teamname-start / barbell-start / barbell-start / barbell-end;
		justify-self: center;
		align-self: start;
	}
	
	.flag img {
		object-fit: contain;
		max-height: 25vh;
		width: 100%;
	}
	
	.flag.with-picture img {
		max-height: 18vh;
		align-self: start;
	}
	
	/* Athlete Picture */
	.picture {
		display: flex;
		justify-self: center;
		justify-content: center;
		align-self: center;
		grid-area: lastname-start / timer-start / number-start / timer-end;
		z-index: 0;
		flex-direction: column;
	}
	
	.picture img {
		max-height: 45vh;
		max-width: 100%;
		align-self: center;
		object-fit: contain;
	}
	
	.team-name {
		grid-area: teamname-start / name-start / teamname-end / name-end;
		font-size: 8vh;
		line-height: 8vh;
		color: #d0d0d0;
		align-self: center;
		justify-self: start;
	}
	
	/* === Start Number === */
	.start-number {
		font-size: 10vh;
		grid-area: number-start / number-start / number-end / number-end;
		align-self: center;
		justify-self: start;
	}
	
	.start-number span {
		border-width: 0.2ex;  /* matches owlcms */
		border-style: solid;
		border-color: red;  /* --startNumberBoxColor */
		width: 1.5em;
		padding: 0.05em 0;
		line-height: 1.1;
		display: flex;
		justify-content: center;
		color: #fff;
	}
	
	/* === Category === */
	.category {
		margin-left: 1.5rem;
		justify-self: start;
		align-self: center;
		font-size: 8.5vh;
		grid-area: number-start / number-end / number-end / barbell-start;
		color: #fff;
		white-space: nowrap;  /* prevent wrapping */
	}
	
	/* === Weight === */
	.weight {
		color: aqua;  /* --athleteAttemptWeightColor */
		font-size: 20vh;
		line-height: 20vh;
		font-weight: bold;
		grid-area: weight-start / weight-start / weight-end / weight-end;
		align-self: center;
		justify-self: stretch;
		white-space: nowrap;  /* keep weight and kg on same line */
	}
	
	.weight-unit {
		font-size: 75%;  /* matches owlcms: style="font-size: 75%" */
	}
	
	/* === Barbell / Plates === */
	.barbell {
		grid-area: barbell-start / barbell-start / barbell-end / barbell-end;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 2px;
	}
	
	.barbell-placeholder {
		grid-area: barbell-start / barbell-start / barbell-end / barbell-end;
	}
	
	/* === Decision Area === */
	.decision-area {
		grid-area: decision-start / decision-start / decision-end / decision-end;
		display: flex;
		align-items: center;
		justify-content: center;
		justify-self: stretch;
		align-self: stretch;
		width: 100%;
		height: 100%;
	}
	
	.down-signal {
		color: lime;
		font-size: 50vh;  /* Scale with viewport */
		font-weight: 900;
		font-family: 'Arial Black', Arial, Helvetica, sans-serif;
		line-height: 1;
	}
	
	.decision-lights {
		--circle-size: 30vh;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: calc(var(--circle-size) * 0.1);
	}
	
	.ref-light {
		/* Fixed vh-based sizing for predictable circles */
		width: var(--circle-size);
		height: var(--circle-size);
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.1);
		border: 2px solid rgba(255, 255, 255, 0.5);
	}
	
	.ref-light.good {
		background: #ffffff;
		border-color: #ffffff;
	}
	
	.ref-light.bad {
		background: #cc0000;
		border-color: #cc0000;
	}
	
	/* === Attempt Label === */
	.attempt {
		font-size: 8.5vh;
		font-weight: bold;
		color: #fff;
		align-self: center;
		justify-self: center;
		grid-area: attempt-start / attempt-start / attempt-end / attempt-end;
	}
	
	/* === Timer === */
	.timer-area {
		grid-area: timer-start / timer-start / timer-end / timer-end;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	
	.timer {
		font-size: 26vh;  /* matches owlcms attemptboard.css */
		--timer-font-size: 26vh;  /* CSS variable for CountdownTimer component */
		font-weight: bold;
		line-height: 1;
		color: yellow;  /* --athleteTimerColor */
	}

	/* Override CountdownTimer component styles */
	.timer :global(.timer-display) {
		font-family: Arial, Helvetica, sans-serif !important;
		letter-spacing: normal !important;
		font-weight: bold;
	}

	.athlete-timer {
		color: yellow;  /* --athleteTimerColor */
	}

	.break-time {
		color: skyblue;  /* --breakTimerColor */
	}
	
	.waiting-message {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		text-align: center;
	}
	
	.big-title {
		text-align: center;
	}
	
	.competition-name {
		font-size: 8vh;
		color: #fff;
	}
	
	.next-group {
		font-size: 4vh;
		color: #888;
		margin-top: 2vh;
	}
	
	/* === Responsive === */
	@media screen and (max-width: 1300px) {
		.last-name {
			font-size: 7vw;
			line-height: 7vw;
		}
		.first-name {
			font-size: 7vw;
			line-height: 7vw;
		}
		.weight {
			font-size: 12vw;
			line-height: 7vw;
		}
		.start-number {
			font-size: 8vh;
		}
		.category {
			font-size: 7.5vh;
		}
		.attempt {
			font-size: 8vh;
			line-height: 8vh;
		}
		.timer {
			font-size: 15vw;
		}
	}
	
	@media screen and (max-width: 1025px) {
		.timer {
			font-size: 12vw;
		}
	}
</style>
