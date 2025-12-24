<script>
  import { onMount } from 'svelte';
  import SessionProtocols from './sections/SessionProtocols.svelte';
  import TitlePage from './sections/TitlePage.svelte';
  import TableOfContents from './sections/TableOfContents.svelte';
  import Participants from './sections/Participants.svelte';
  import Medals from './sections/Medals.svelte';
  import Rankings from './sections/Rankings.svelte';
  import Records from './sections/Records.svelte';

  export let data = {};
  export let options = {};

  $: labels = data.labels || {};
  $: sessions = data.sessions || [];
  $: competition = data.competition || {};
  $: athletes = data.allAthletes || [];
  $: rankings = data.rankings || [];
  $: allRecords = data.allRecords || [];
  $: format = options.format || 'complete';
  $: competitionName = competition.name || 'Competition';
  
  // Load Paged.js dynamically when format is 'complete'
  onMount(() => {
    if (format === 'complete' && typeof window !== 'undefined') {
      // Set up Paged.js completion handler BEFORE loading the script
      window.PagedConfig = {
        auto: true,
        after: () => {
          console.log('[Paged.js] Rendering complete, setting ready flag');
          // Give extra time for target-counter() to be computed
          setTimeout(() => {
            window.__pagedjs_ready = true;
            console.log('[Paged.js] Ready flag set');
          }, 500);
        }
      };
      
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/pagedjs/dist/paged.polyfill.js';
      document.head.appendChild(script);
    }
  });
</script>

<svelte:head>
  <title>Result Book - {competitionName}</title>
  <link rel="stylesheet" href="/iwf-results-print.css" />
</svelte:head>

<div class="protocol-container">
  {#if data.status === 'waiting'}
    <div class="loading">{data.message}</div>
  {:else if !sessions || sessions.length === 0}
    <div class="no-data">{data.message || 'No session data available.'}</div>
  {:else if format === 'complete'}
    <div class="title-section">
      <TitlePage {competition} />
    </div>
    <div class="toc-section">
      <TableOfContents {sessions} {rankings} {allRecords} />
    </div>
    <Participants {data} />
    <Medals {data} />
    <Rankings {rankings} {competition} />
    <SessionProtocols {sessions} {competition} productionTime={data.productionTime} />
    <Records {allRecords} {labels} />
  {:else}
    <SessionProtocols {sessions} {competition} productionTime={data.productionTime} />
  {/if}
</div>

<style>
  :global(body) {
    background: white;
    margin: 0;
    padding: 0;
  }

  .protocol-container {
    background: white;
    color: black;
    padding: 0;
    font-family: Arial, sans-serif;
    font-size: 11px;
  }

  .loading, .no-data {
    padding: 20px;
    text-align: center;
    color: #666;
    font-size: 14px;
  }
</style>
