<script>
  import { currentAttempt, timer, competitionInfo } from '$lib/stores';
  import Timer from '$lib/components/Timer.svelte';
</script>

<svelte:head>
  <title>Current Lifter - OWLCMS Tracker</title>
</svelte:head>

<div class="container">
  <header class="text-center mb-2">
    <h1>🎯 Current Lifter</h1>
    {#if $competitionInfo.name}
      <p class="competition-name">{$competitionInfo.name}</p>
    {/if}
  </header>

  <div class="current-lifter-display">
    {#if $currentAttempt}
      <div class="athlete-info">
        <h2 class="athlete-name">{$currentAttempt.athleteName}</h2>
        {#if $currentAttempt.teamName}
          <p class="team-name">{$currentAttempt.teamName}</p>
        {/if}
        {#if $currentAttempt.startNumber}
          <p class="start-number">#{$currentAttempt.startNumber}</p>
        {/if}
        {#if $currentAttempt.categoryName}
          <p class="category">{$currentAttempt.categoryName}</p>
        {/if}
      </div>

      <div class="attempt-info">
        <div class="lift-type">
          {#if $currentAttempt.lift === 'snatch'}
            Snatch
          {:else}
            Clean & Jerk
          {/if}
        </div>
        
        {#if $currentAttempt.attemptNumber}
          <div class="attempt-number">
            Attempt {$currentAttempt.attemptNumber}
          </div>
        {/if}
        
        {#if $currentAttempt.weight}
          <div class="weight">
            {$currentAttempt.weight} kg
          </div>
        {/if}
      </div>

      <div class="timer-section">
        <Timer />
      </div>
    {:else}
      <div class="no-lifter">
        <h3>No Lifter on Platform</h3>
        <p>Waiting for next attempt...</p>
      </div>
    {/if}
  </div>

  <div class="navigation">
    <a href="/">← Back to Home</a>
  </div>
</div>

<style>
  .current-lifter-display {
    text-align: center;
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    background: var(--surface-color);
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }

  .athlete-info {
    margin-bottom: 2rem;
  }

  .athlete-name {
    font-size: 3rem;
    font-weight: bold;
    margin: 0 0 0.5rem 0;
    color: var(--primary-color);
  }

  .team-name {
    font-size: 1.5rem;
    color: var(--text-secondary);
    margin: 0 0 0.5rem 0;
  }

  .start-number {
    font-size: 1.2rem;
    color: var(--text-secondary);
    margin: 0;
  }

  .category {
    font-size: 1.1rem;
    color: var(--warning-color);
    font-weight: 600;
    margin: 0.5rem 0 0 0;
  }

  .attempt-info {
    margin-bottom: 2rem;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 2rem;
    flex-wrap: wrap;
  }

  .lift-type {
    font-size: 2rem;
    font-weight: bold;
    color: var(--secondary-color);
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .attempt-number {
    font-size: 1.5rem;
    color: var(--text-color);
  }

  .weight {
    font-size: 3rem;
    font-weight: bold;
    color: var(--primary-color);
    border: 3px solid var(--primary-color);
    padding: 0.5rem 1rem;
    border-radius: 8px;
  }

  .timer-section {
    margin-top: 2rem;
  }

  .no-lifter {
    padding: 4rem 2rem;
    color: var(--text-secondary);
  }

  .no-lifter h3 {
    font-size: 2rem;
    margin-bottom: 1rem;
  }

  .competition-name {
    font-size: 1.2rem;
    color: var(--text-secondary);
    margin: 0;
  }

  .navigation {
    text-align: center;
    margin-top: 2rem;
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .athlete-name {
      font-size: 2rem;
    }

    .attempt-info {
      flex-direction: column;
      gap: 1rem;
    }

    .weight {
      font-size: 2rem;
      padding: 0.3rem 0.8rem;
    }

    .lift-type {
      font-size: 1.5rem;
    }
  }
</style>