<script>
  import { timer as storeTimer } from '$lib/stores';
  import { onDestroy } from 'svelte';
  export let timer = null; // optional prop; if provided, use this instead of store
  export let variant = 'athlete'; // 'athlete' or 'break' (turquoise)
  
  let remainingMs = 0;
  let interval;
  
  // Choose timer source: prop `timer` (from parent component) or shared store
  $: activeTimer = timer || $storeTimer;

  $: if (activeTimer?.state === 'running') {
    startCountdown();
  } else if (activeTimer?.state === 'stopped') {
    stopCountdown();
  }
  
  function startCountdown() {
    stopCountdown();
    
    interval = setInterval(() => {
      const elapsed = activeTimer?.startTime ? Date.now() - activeTimer.startTime : 0;
      remainingMs = Math.max(0, (activeTimer?.duration || 0) - elapsed);
      
      if (remainingMs <= 0) {
        stopCountdown();
      }
    }, 100);
  }
  
  function stopCountdown() {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
    remainingMs = 0;
  }
  
  onDestroy(() => {
    stopCountdown();
  });
  
  $: seconds = Math.ceil(remainingMs / 1000);
  $: warning = seconds > 0 && seconds <= 30;
  $: urgent = seconds > 0 && seconds <= 10;
</script>

<div class="timer {variant}" class:warning class:urgent>
  {#if activeTimer?.state === 'running'}
    {seconds}s
  {:else}
    --
  {/if}
</div>

<style>
  .timer {
    font-size: 4rem;
    font-weight: bold;
    text-align: center;
    color: #333;
    transition: color 0.3s ease;
  }
  
  .warning {
    color: #ff9800;
  }
  
  .urgent {
    color: #f44336;
    animation: pulse 1s infinite;
  }

  /* Break timer variant (turquoise) */
  .break {
    color: #06c2b6; /* turquoise */
  }
  
  @keyframes pulse {
    0%, 100% { 
      opacity: 1;
      transform: scale(1);
    }
    50% { 
      opacity: 0.7;
      transform: scale(1.05);
    }
  }
</style>