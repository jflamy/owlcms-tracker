<script>
  import { onMount } from 'svelte';
  import SessionStartLists from './sections/SessionStartLists.svelte';
  import TitlePage from './sections/TitlePage.svelte';
  import TableOfContents from './sections/TableOfContents.svelte';
  import Participants from './sections/Participants.svelte';
  import CategoryParticipants from './sections/CategoryParticipants.svelte';
  import Records from './sections/Records.svelte';

  export let data = {};
  export let options = {};

  $: labels = data.labels || {};
  $: sessions = data.sessions || [];
  $: competition = data.competition || {};
  $: rankings = data.rankings || [];
  $: allRecords = data.allRecords || [];
  $: hasRecords = data.hasRecords || false;
  $: newRecordsBroken = data.newRecordsBroken || false;
  $: format = options.format || 'complete';
  $: includeSessionStartLists = data.includeSessionStartLists !== false;
  $: includeCategoryParticipants = data.includeCategoryParticipants === true;
  $: competitionName = competition.name || 'Competition';
  $: competitionDates = competition.dateRange || '';
  
  // Format current date/time for footer (local time with timezone)
  $: generationTime = (() => {
    if (data.productionTime) {
      const dt = new Date(data.productionTime);
      const year = dt.getFullYear();
      const month = String(dt.getMonth() + 1).padStart(2, '0');
      const day = String(dt.getDate()).padStart(2, '0');
      const hours = String(dt.getHours()).padStart(2, '0');
      const minutes = String(dt.getMinutes()).padStart(2, '0');
      
      // Get timezone abbreviation (e.g., "EST", "CET", "PST")
      const timezone = new Intl.DateTimeFormat('en', { timeZoneName: 'short' })
        .formatToParts(dt)
        .find(part => part.type === 'timeZoneName')?.value || '';
      
      return `${year}-${month}-${day} ${hours}:${minutes} ${timezone}`;
    }
    return '';
  })();
  
  // Format exportDate and version for footer (local time with timezone)
  $: footerInfo = (() => {
    const version = competition.owlcmsVersion || '';
    const exportDate = competition.exportDate || '';
    if (exportDate) {
      // Parse ISO 8601 timestamp and format as local time with timezone
      const dt = new Date(exportDate);
      const year = dt.getFullYear();
      const month = String(dt.getMonth() + 1).padStart(2, '0');
      const day = String(dt.getDate()).padStart(2, '0');
      const hours = String(dt.getHours()).padStart(2, '0');
      const minutes = String(dt.getMinutes()).padStart(2, '0');
      
      // Get timezone abbreviation (e.g., "EST", "CET", "PST")
      const timezone = new Intl.DateTimeFormat('en', { timeZoneName: 'short' })
        .formatToParts(dt)
        .find(part => part.type === 'timeZoneName')?.value || '';
      
      const formattedDate = `${year}-${month}-${day} ${hours}:${minutes} ${timezone}`;
      return version ? `OWLCMS ${version} – ${formattedDate}` : `– ${formattedDate}`;
    }
    return version ? `OWLCMS ${version}` : '';
  })();
  
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
  <title>Start Book - {competitionName}</title>
  <link rel="stylesheet" href="/iwf-results-print.css" />
</svelte:head>

<!-- Hidden elements for Paged.js string() function -->
<div style="display: none;">
  <span class="competition-name-string">{competitionName}</span>
  <span class="competition-dates-string">{competitionDates}</span>
  <span class="generation-time-string">{generationTime}</span>
  <span class="footer-info-string">{footerInfo}</span>
</div>

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
      <TableOfContents {sessions} {rankings} {allRecords} {hasRecords} />
    </div>
    <Participants {data} />
    {#if includeCategoryParticipants}
      <CategoryParticipants {rankings} {competition} />
    {/if}
    {#if includeSessionStartLists}
      <SessionStartLists {sessions} {competition} productionTime={data.productionTime} />
    {/if}
    <Records {allRecords} {hasRecords} {newRecordsBroken} {labels} />
  {:else}
    {#if includeSessionStartLists}
      <SessionStartLists {sessions} {competition} productionTime={data.productionTime} />
    {/if}
  {/if}
</div>

<style>
  :global(body) {
    background: white;
    margin: 0;
    padding: 0;
  }

  /* Capture strings for Paged.js headers/footers */
  :global(.competition-name-string) {
    string-set: competition-name content();
  }
  
  :global(.competition-dates-string) {
    string-set: competition-dates content();
  }
  
  :global(.generation-time-string) {
    string-set: generation-time content();
  }
  
  :global(.footer-info-string) {
    string-set: footer-info content();
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
