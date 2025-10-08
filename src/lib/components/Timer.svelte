<script>
  import { timer } from '$lib/stores';
  import { onDestroy } from 'svelte';
  
  let remainingMs = 0;
  let interval;
  
  $: if ($timer?.state === 'running') {
    startCountdown();
  } else if ($timer?.state === 'stopped') {
    stopCountdown();
  }
  
  function startCountdown() {
    stopCountdown();
    
    interval = setInterval(() => {
      const elapsed = Date.now() - $timer.startTime;
      remainingMs = Math.max(0, $timer.duration - elapsed);
      
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

<div class="timer" class:warning class:urgent>
  {#if $timer?.state === 'running'}
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