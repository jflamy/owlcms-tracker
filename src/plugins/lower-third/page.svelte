<script>
	import { onMount, onDestroy } from 'svelte';
	import { createTimer } from '$lib/timer-logic';
	import { formatTime, getDecisionClass } from './helpers.client.js';

	export let data = {};

	// Timer management
	const timer = createTimer();
	let timerState = { seconds: 0, isRunning: false, isWarning: false, display: '0:00' };

	const unsubscribe = timer.subscribe((state) => {
		timerState = state;
	});

	onMount(() => {
		timer.start(data.timer);
	});

	onDestroy(() => {
		timer.stop();
		unsubscribe();
	});

	// Reactive sync on server updates
	$: if (data.timer) timer.syncWithServer(data.timer);

	// Get position classes
	$: positionClass = data.options?.position || 'bottom-right';
	$: fontSizeClass = `font-${data.options?.fontSize || 'medium'}`;
</script>

<script context="module">
export function shouldRenderFlag(url) {
	if (!url) return false;
	if (typeof url === 'string' && url.startsWith('data:image/')) return false;
	return true;
}
</script>

<div class="lower-third-overlay {positionClass} {fontSizeClass}">
	<!-- Left: Athlete Name Card (always shown when athlete is present) -->
	{#if data.currentAthleteInfo}
		<div class="info-card name-card">
			<div class="name-content">
				<span class="athlete-name">{data.currentAthleteInfo.fullName}</span>
				<span class="separator">•</span>
				{#if data.currentAthleteInfo.flagUrl}
					{#if shouldRenderFlag(data.currentAthleteInfo.flagUrl)}
						<img src={data.currentAthleteInfo.flagUrl} alt={data.currentAthleteInfo.teamName} class="team-flag" />
					{/if}
				{/if}
				<span class="team">{data.currentAthleteInfo.teamName}</span>
				<span class="separator">•</span>
				<span class="weight">{data.currentAthleteInfo.weight}kg</span>
			</div>
		</div>
	{/if}

	<!-- Right: Timer OR Decision (never both) -->
	<!-- Decision has priority when visible -->
	{#if data.decision?.visible}
		<div class="info-card decision-card">
			<div class="decision-lights">
				{#if !data.decision.isSingleReferee}
					<div class="referee-light {getDecisionClass(data.decision.ref1)}"></div>
				{/if}
				<div class="referee-light {getDecisionClass(data.decision.ref2)}"></div>
				{#if !data.decision.isSingleReferee}
					<div class="referee-light {getDecisionClass(data.decision.ref3)}"></div>
				{/if}
			</div>
		</div>
	{:else if data.currentAthleteInfo && data.timer?.state !== 'stopped'}
		<!-- Show timer when athlete is announced and timer is not in final stopped state -->
		<!-- Timer shows for 'running' and 'set' states (includes intermediate stops during adjustment) -->
		<div class="info-card timer-card" class:warning={timerState.isWarning}>
			<div class="timer-display">{timerState.display}</div>
		</div>
	{/if}
</div>

<style>
	/* Transparent overlay container */
	.lower-third-overlay {
		position: fixed;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		padding: 5rem;
		z-index: 9999;
		pointer-events: none; /* Allow click-through */
	}

	/* Position classes */
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

	/* Info cards with semi-transparent background */
	.info-card {
		background: rgba(0, 0, 0, 0.85);
		border-radius: 8px;
		padding: 0.75rem 1.25rem;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.1);
		height: 4.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* Athlete/Name card - Left side */
	.name-card {
		/* Size to content: do not grow to fill space; background will expand
		   to fit the text. */
		flex: 0 0 auto;
		min-width: auto;
		max-width: none;
	}

	.name-content {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: nowrap;
		/* Let the content determine the card width so the background matches the text */
		white-space: nowrap;
	}

	.athlete-name {
		color: #ffffff;
		font-weight: 700;
		font-size: 1.75rem;
		letter-spacing: 0.5px;
		white-space: nowrap;
	}

	.athlete-details {
		color: #e0e0e0;
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.separator {
		color: #888;
		font-size: 1.5rem;
	}

	.team {
		color: #e0e0e0;
		font-size: 1.5rem;
		white-space: nowrap;
	}

	.team-flag {
		height: 1.2rem;
		max-width: 1.5rem;
		object-fit: contain;
	}
	.team-flag[src^="data:image/"] { display: none; }

	.weight {
		color: #fbbf24;
		font-weight: 600;
		font-size: 1.75rem;
		white-space: nowrap;
	}

	/* Timer card - Right side */
	.timer-card {
		flex: 0 0 auto;
		min-width: 150px;
	}

	.timer-display {
		color: #ffffff;
		font-weight: 700;
		font-size: 1.5rem;
		font-family: 'Courier New', monospace;
		letter-spacing: 2px;
	}

	.timer-card.warning {
		background: rgba(239, 68, 68, 0.9);
		animation: pulse 1s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.7; }
	}

	/* Decision card - Right side */
	.decision-card {
		flex: 0 0 auto;
		min-width: 200px;
	}

	.decision-lights {
		display: flex;
		gap: 0.75rem;
		justify-content: center;
		align-items: center;
	}

	.referee-light {
		width: 3rem;
		height: 3rem;
		border-radius: 50%;
		border: 2px solid rgba(255, 255, 255, 0.3);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
	}

	.decision-good {
		background: #ffffff;
		border-color: #e5e7eb;
		box-shadow: 0 0 20px rgba(255, 255, 255, 0.8);
	}

	.decision-bad {
		background: #ef4444;
		border-color: #dc2626;
		box-shadow: 0 0 20px rgba(239, 68, 68, 0.6);
	}

	.decision-none {
		background: #6b7280;
		border-color: #4b5563;
	}

	/* Font size variants */
	.font-small .athlete-name {
		font-size: 1.1rem;
	}

	.font-small .athlete-details {
		font-size: 0.85rem;
	}

	.font-small .timer-display {
		font-size: 2rem;
	}

	.font-medium .athlete-name {
		font-size: 1.4rem;
	}

	.font-medium .athlete-details {
		font-size: 1rem;
	}

	.font-medium .timer-display {
		font-size: 2.5rem;
	}

	.font-large .athlete-name {
		font-size: 1.8rem;
	}

	.font-large .athlete-details {
		font-size: 1.2rem;
	}

	.font-large .timer-display {
		font-size: 3rem;
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		.lower-third-overlay {
			padding: 10px;
			gap: 8px;
		}

		.info-card {
			padding: 8px 15px;
		}

		.name-card {
			min-width: 200px;
			max-width: 60%;
		}

		.timer-card {
			min-width: 100px;
		}
		
		.decision-card {
			min-width: 150px;
		}
	}
</style>
