<script>
	import { onMount, onDestroy } from 'svelte';
	import { createTimer } from '$lib/timer-logic';
	import { getDecisionClass, getAttemptClass } from './helpers.client.js';

	export let data = {};

	// Timer management
	const timer = createTimer();
	let timerState = { seconds: 0, isRunning: false, isWarning: false, display: '0:00' };

	const unsubscribe = timer.subscribe((state) => {
		timerState = state;
	});

	onMount(() => {
		if (data.timer && data.timer.visible) {
			timer.start(data.timer);
		}
	});

	// Reactive sync on server updates
	$: if (data.timer) {
		if (data.timer.visible) {
			timer.syncWithServer(data.timer);
		} else {
			timer.stop();
		}
	}

	// Get position classes
	$: positionClass = data.options?.position || 'bottom-right';
	$: fontSizeClass = `font-${data.options?.fontSize || 'medium'}`;
	$: athleteInfo = data.currentAthleteInfo || null;
	$: snatchAttempts = athleteInfo?.snatchAttempts || [];
	$: cleanJerkAttempts = athleteInfo?.cleanJerkAttempts || [];
	$: clubLogoCandidates = athleteInfo?.clubLogoCandidates || (athleteInfo?.clubLogoUrl ? [athleteInfo.clubLogoUrl] : []);
	$: platformTheme = data.options?.platformTheme === 'gray' ? 'gray' : 'scarlet';

	// Display mode controls timer sources and break/interruption behavior.
	$: displayMode = data.displayMode || 'none';
	$: showAthleteTimer = displayMode === 'athlete' && Boolean(data.timer?.visible);
	$: showBreakTimer = displayMode === 'break';
	$: showDecisions = Boolean(data.decision?.visible) || displayMode === 'decision';

	$: isInterruption = Boolean(data.breakTimer?.displayText);
	$: displayTimerText = showBreakTimer
		? (data.breakTimer?.displayText || breakTimerState.display)
		: (showAthleteTimer ? timerState.display : '--:--');

	$: ohioLogoCandidates = Array.from(new Set([
		data.options?.ohioLogoUrl,
		'/local/flags/OhioWSO.png',
		'/local/flags/OhioWSO.PNG',
		'/local/flags/OhioWSO.svg',
		'/local/flags/Ohio%20WSO.png',
		'/local/flags/Ohio%20WSO.PNG',
		'/local/flags/Ohio%20Weightlifting%20State%20Organization.png',
		'/local/flags/Ohio%20WSO.png',
		'/local/flags/OhioWSO.jpg',
		'/local/flags/OhioWSO.JPG',
		'/local/flags/Ohio%20WSO.jpg',
		'/local/flags/Ohio%20WSO.JPG',
		'/local/logos/OhioWSO.png'
	].filter(Boolean)));

	let ohioLogoIndex = 0;
	let clubLogoIndex = 0;
	let currentOhioLogoSrc = null;
	let currentClubLogoSrc = null;

	$: {
		const signature = ohioLogoCandidates.join('|');
		if (signature !== _ohioLogoSignature) {
			_ohioLogoSignature = signature;
			ohioLogoIndex = 0;
			currentOhioLogoSrc = ohioLogoCandidates[0] || null;
		}
	}

	$: {
		const signature = clubLogoCandidates.join('|');
		if (signature !== _clubLogoSignature) {
			_clubLogoSignature = signature;
			clubLogoIndex = 0;
			currentClubLogoSrc = clubLogoCandidates[0] || null;
		}
	}

	let _ohioLogoSignature = '';
	let _clubLogoSignature = '';

	function tryNextOhioLogo() {
		if (ohioLogoIndex + 1 >= ohioLogoCandidates.length) return;
		ohioLogoIndex += 1;
		currentOhioLogoSrc = ohioLogoCandidates[ohioLogoIndex] || null;
	}

	function tryNextClubLogo() {
		if (clubLogoIndex + 1 >= clubLogoCandidates.length) return;
		clubLogoIndex += 1;
		currentClubLogoSrc = clubLogoCandidates[clubLogoIndex] || null;
	}

	// Break timer countdown
	let breakTimerState = { seconds: 0, isRunning: false, isWarning: false, display: '0:00' };
	const breakTimer = createTimer();

	const breakUnsubscribe = breakTimer.subscribe((state) => {
		breakTimerState = state;
	});

	$: if (data.breakTimer && showBreakTimer && !data.breakTimer?.displayText) {
		breakTimer.start(data.breakTimer);
	} else if (!showBreakTimer || data.breakTimer?.displayText) {
		breakTimer.stop();
	}

	$: if (data.breakTimer) breakTimer.syncWithServer(data.breakTimer);

	onDestroy(() => {
		timer.stop();
		unsubscribe();
		breakTimer.stop();
		breakUnsubscribe();
	});
</script>

<script context="module">
	export function shouldRenderImage(url) {
		if (!url) return false;
		if (typeof url === 'string' && url.startsWith('data:image/')) return false;
		return true;
	}
</script>

<div class="lower-third-overlay {positionClass} {fontSizeClass}" class:interruption={isInterruption}>
	{#if athleteInfo}
		<div class="info-card overlay-shell" class:warning={(showAthleteTimer && timerState.isWarning) || (showBreakTimer && breakTimerState.isWarning && !data.breakTimer?.displayText)} class:platform-gray={platformTheme === 'gray'} class:platform-scarlet={platformTheme !== 'gray'}>
			<div class="event-logo-wrap">
				{#if shouldRenderImage(currentOhioLogoSrc)}
					<img src={currentOhioLogoSrc} alt="Ohio WSO" class="event-logo" on:error={tryNextOhioLogo} />
				{/if}
			</div>

			<div class="overlay-content">
				<div class="row row-top">
					<div class="cell name-cell" title={athleteInfo.formattedName || athleteInfo.fullName}>
						{athleteInfo.formattedName || athleteInfo.fullName}
					</div>
					<div class="cell club-cell">
						{#if shouldRenderImage(currentClubLogoSrc)}
							<img src={currentClubLogoSrc} alt={athleteInfo.clubName || 'Club'} class="club-logo" on:error={tryNextClubLogo} />
						{/if}
						<span class="club-name">{athleteInfo.clubName || ''}</span>
					</div>
					<div class="cell pb-cell">
						<span class="pb-label">{athleteInfo.liftType || 'Lift'} PB</span>
						<span class="pb-value">{athleteInfo.personalBest || 'PB -'}</span>
					</div>
				</div>

				<div class="row row-bottom">
					<div class="cell attempts-cell">
						<span class="attempt-label">Snatch</span>
						<div class="attempts-strip">
							{#each snatchAttempts as attempt}
								<span class="attempt-chip {getAttemptClass(attempt.status)}">{attempt.value || '·'}</span>
							{/each}
						</div>
					</div>

					<div class="cell center-cell">
						<div class="timer-slot">
							<span class="timer-display">{displayTimerText}</span>
						</div>
						{#if showDecisions}
							<div class="decision-lights">
								{#if !data.decision?.isSingleReferee}
									<div class="referee-light {getDecisionClass(data.decision?.ref1)}"></div>
								{/if}
								<div class="referee-light {getDecisionClass(data.decision?.ref2)}"></div>
								{#if !data.decision?.isSingleReferee}
									<div class="referee-light {getDecisionClass(data.decision?.ref3)}"></div>
								{/if}
							</div>
						{/if}
					</div>

					<div class="cell attempts-cell">
						<span class="attempt-label">Clean &amp; Jerk</span>
						<div class="attempts-strip">
							{#each cleanJerkAttempts as attempt}
								<span class="attempt-chip {getAttemptClass(attempt.status)}">{attempt.value || '·'}</span>
							{/each}
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.lower-third-overlay {
		position: fixed;
		display: block;
		padding: 3.25rem 2.5rem;
		z-index: 9999;
		pointer-events: none;
	}

	.lower-third-overlay.interruption .overlay-shell {
		background: rgba(122, 12, 36, 0.95);
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.bottom-right {
		bottom: 0;
		right: 0;
		left: 0;
	}

	.bottom-left {
		bottom: 0;
		left: 0;
		right: 0;
	}

	.top-right {
		top: 0;
		right: 0;
		left: 0;
	}

	.top-left {
		top: 0;
		left: 0;
		right: 0;
	}

	.info-card {
		--panel-bg: rgba(186, 12, 47, 0.94);
		--panel-text: #ffffff;
		--panel-shadow: rgba(122, 12, 36, 0.55);
		background: var(--panel-bg);
		border-radius: 8px;
		padding: 0.78rem 1.15rem;
		box-shadow: 0 4px 12px var(--panel-shadow);
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.35);
		height: 6.75rem;
	}

	.overlay-shell.platform-scarlet {
		--panel-bg: rgba(186, 12, 47, 0.95);
		--panel-text: #ffffff;
		--panel-shadow: rgba(122, 12, 36, 0.55);
	}

	.overlay-shell.platform-gray {
		--panel-bg: rgba(107, 114, 128, 0.95);
		--panel-text: #ffffff;
		--panel-shadow: rgba(17, 24, 39, 0.42);
		border-color: rgba(255, 255, 255, 0.4);
	}

	.overlay-shell {
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: stretch;
		width: min(100%, 1450px);
		gap: 0.8rem;
	}

	.overlay-shell.warning {
		box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.55), 0 4px 14px rgba(255, 255, 255, 0.24);
	}

	.event-logo-wrap {
		width: 6rem;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		border-right: 1px solid rgba(255, 255, 255, 0.24);
		padding-right: 0.9rem;
	}

	.overlay-shell.platform-gray .event-logo-wrap {
		border-right-color: rgba(255, 255, 255, 0.24);
	}

	.event-logo {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}

	.overlay-content {
		display: grid;
		grid-template-rows: 1fr 1fr;
		gap: 0.3rem;
		min-width: 0;
	}

	.row {
		display: grid;
		gap: 0.6rem;
		align-items: center;
		min-width: 0;
	}

	.row-top {
		grid-template-columns: minmax(220px, 1.8fr) minmax(180px, 1.4fr) minmax(140px, 0.9fr);
	}

	.row-bottom {
		grid-template-columns: minmax(240px, 1.55fr) minmax(185px, 1fr) minmax(240px, 1.55fr);
	}

	.cell {
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	.name-cell {
		color: var(--panel-text);
		font-weight: 700;
		letter-spacing: 0.2px;
		font-size: 1.35rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.club-cell {
		color: color-mix(in srgb, var(--panel-text) 85%, transparent);
		overflow: hidden;
		white-space: nowrap;
		font-size: 1.1rem;
	}

	.club-logo {
		width: 2.3rem;
		height: 2.3rem;
		object-fit: contain;
		flex: 0 0 auto;
		border-radius: 3px;
		background: rgba(255, 255, 255, 0.12);
		padding: 0.08rem;
	}

	.club-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pb-cell {
		justify-content: flex-end;
		text-align: right;
		white-space: nowrap;
	}

	.pb-label {
		font-size: 0.9rem;
		color: color-mix(in srgb, var(--panel-text) 80%, transparent);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.pb-value {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--panel-text);
	}

	.attempts-cell {
		justify-content: flex-start;
		white-space: nowrap;
	}

	.attempt-label {
		font-size: 0.88rem;
		letter-spacing: 0.45px;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--panel-text) 84%, transparent);
	}

	.attempts-strip {
		display: flex;
		gap: 0.28rem;
	}

	.attempt-chip {
		min-width: 2.6rem;
		height: 1.65rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0 0.4rem;
		font-size: 1.02rem;
		font-weight: 700;
		line-height: 1;
		border-radius: 999px;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.attempt-good {
		background: #ffffff;
		color: #7a0c24;
	}

	.attempt-bad {
		background: #7a0c24;
		color: #ffffff;
		border-color: #ffffff;
	}

	.attempt-request {
		background: rgba(255, 255, 255, 0.24);
		color: #ffffff;
		border-color: rgba(255, 255, 255, 0.72);
	}

	.attempt-empty {
		background: rgba(255, 255, 255, 0.16);
		color: rgba(255, 255, 255, 0.85);
	}

	.overlay-shell.platform-gray .attempt-request {
		background: rgba(255, 255, 255, 0.2);
		color: #ffffff;
		border-color: rgba(255, 255, 255, 0.62);
	}

	.overlay-shell.platform-gray .attempt-empty {
		background: rgba(255, 255, 255, 0.14);
		color: rgba(255, 255, 255, 0.82);
	}

	.center-cell {
		justify-content: center;
		gap: 0.6rem;
	}

	.timer-slot {
		min-width: 6.8rem;
		display: flex;
		justify-content: center;
	}

	.timer-display {
		color: var(--panel-text);
		font-weight: 700;
		font-size: 1.45rem;
		font-family: 'Courier New', monospace;
		letter-spacing: 1px;
	}

	.decision-lights {
		display: flex;
		gap: 0.35rem;
		justify-content: center;
		align-items: center;
	}

	.referee-light {
		width: 1.08rem;
		height: 1.08rem;
		border-radius: 50%;
		border: 1px solid rgba(255, 255, 255, 0.3);
		box-shadow: 0 1px 5px rgba(0, 0, 0, 0.3);
	}

	.decision-good {
		background: #ffffff;
		border-color: #e5e7eb;
		box-shadow: 0 0 8px rgba(255, 255, 255, 0.8);
	}

	.decision-bad {
		background: #7a0c24;
		border-color: #ffffff;
		box-shadow: 0 0 8px rgba(255, 255, 255, 0.45);
	}

	.overlay-shell.platform-gray .decision-bad {
		background: #ba0c2f;
	}

	.decision-none {
		background: rgba(255, 255, 255, 0.32);
		border-color: rgba(255, 255, 255, 0.5);
	}

	.font-small .name-cell {
		font-size: 1.1rem;
	}

	.font-small .timer-display {
		font-size: 1.2rem;
	}

	.font-small .attempt-chip {
		min-width: 2.2rem;
		height: 1.35rem;
		font-size: 0.9rem;
	}

	.font-large .name-cell {
		font-size: 1.52rem;
	}

	.font-large .timer-display {
		font-size: 1.7rem;
	}

	.font-large .attempt-chip {
		min-width: 2.9rem;
		height: 1.8rem;
		font-size: 1.1rem;
	}

	@media (max-width: 1100px) {
		.row-top {
			grid-template-columns: minmax(160px, 1.4fr) minmax(130px, 1.2fr) minmax(120px, 0.9fr);
		}

		.row-bottom {
			grid-template-columns: minmax(190px, 1.3fr) minmax(150px, 0.9fr) minmax(190px, 1.3fr);
		}
	}

	@media (max-width: 768px) {
		.lower-third-overlay {
			padding: 0.6rem;
		}

		.overlay-shell {
			grid-template-columns: 3.1rem 1fr;
			gap: 0.45rem;
		}

		.info-card {
			height: 5.2rem;
			padding: 0.55rem 0.65rem;
		}

		.event-logo-wrap {
			width: 3.7rem;
			padding-right: 0.35rem;
		}

		.row {
			gap: 0.3rem;
		}

		.row-top,
		.row-bottom {
			grid-template-columns: 1fr 1fr 1fr;
		}

		.name-cell {
			font-size: 0.9rem;
		}

		.club-cell,
		.pb-value,
		.timer-display {
			font-size: 0.82rem;
		}

		.pb-label,
		.attempt-label {
			font-size: 0.64rem;
		}

		.attempt-chip {
			min-width: 1.5rem;
			height: 1.05rem;
			padding: 0 0.12rem;
			font-size: 0.7rem;
		}

		.referee-light {
			width: 0.72rem;
			height: 0.72rem;
		}
	}
</style>
