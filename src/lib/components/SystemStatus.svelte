<script>
  import { competitionStatus } from '$lib/stores.js';
  import { onMount } from 'svelte';
  
  let serverStatus = 'checking';
  
  onMount(async () => {
    try {
      const response = await fetch('/api/status');
      const data = await response.json();
      serverStatus = data.ready ? 'ready' : 'not_ready';
    } catch (error) {
      console.error('Error checking server status:', error);
      serverStatus = 'error';
    }
  });
  
  $: overallStatus = serverStatus === 'ready' && $competitionStatus === 'ready' 
    ? 'ready' 
    : serverStatus === 'ready' && $competitionStatus === 'connecting'
    ? 'waiting_for_data'
    : 'not_ready';
</script>

<div class="status-indicator" class:ready={overallStatus === 'ready'} 
     class:waiting={overallStatus === 'waiting_for_data'} 
     class:not-ready={overallStatus === 'not_ready'}>
  <div class="status-dot"></div>
  <span class="status-text">
    {#if overallStatus === 'ready'}
      System Ready - Connected to OWLCMS
    {:else if overallStatus === 'waiting_for_data'}
      System Ready - Waiting for OWLCMS data
    {:else}
      System Initializing...
    {/if}
  </span>
</div>

<style>
  .status-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 0.25rem;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.3s ease;
  }
  
  .status-dot {
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 50%;
    transition: all 0.3s ease;
  }
  
  .ready {
    background-color: #dcfce7;
    color: #166534;
    border: 1px solid #bbf7d0;
  }
  
  .ready .status-dot {
    background-color: #22c55e;
    box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.2);
  }
  
  .waiting {
    background-color: #fef3c7;
    color: #92400e;
    border: 1px solid #fde68a;
  }
  
  .waiting .status-dot {
    background-color: #f59e0b;
    animation: pulse 2s infinite;
  }
  
  .not-ready {
    background-color: #fee2e2;
    color: #991b1b;
    border: 1px solid #fecaca;
  }
  
  .not-ready .status-dot {
    background-color: #ef4444;
    animation: pulse 1s infinite;
  }
  
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
</style>