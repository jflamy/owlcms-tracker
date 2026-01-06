<script>
  import { onMount } from 'svelte';
  import SessionProtocols from './sections/SessionProtocols.svelte';
  import TitlePage from './sections/TitlePage.svelte';
  import TableOfContents from './sections/TableOfContents.svelte';
  import Participants from './sections/Participants.svelte';
  import Medals from './sections/Medals.svelte';
  import TeamPoints from './sections/TeamPoints.svelte';
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
  $: hasRecords = data.hasRecords || false;
  $: newRecordsBroken = data.newRecordsBroken || false;
  $: format = options.format || 'complete';
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
      // Prevent Paged.js from running multiple times (e.g., due to HMR or re-renders)
      if (window.__pagedjs_started) {
        console.log('[Paged.js] Already started, skipping');
        return;
      }
      window.__pagedjs_started = true;
      
      // Set up Paged.js completion handler BEFORE loading the script
      // Use auto: false and manually trigger after DOM is stable
      window.PagedConfig = {
        auto: false,
        after: () => {
          console.log('[Paged.js] Rendering complete, setting ready flag');
          setTimeout(() => {
            window.__pagedjs_ready = true;
            console.log('[Paged.js] Ready flag set');
          }, 500);
        }
      };
      
      const script = document.createElement('script');
      // Use locally bundled Paged.js (pinned to 0.4.3)
      script.src = '/node_modules/pagedjs/dist/paged.polyfill.js';
      script.onload = () => {
        // Wait for DOM to stabilize, then trigger Paged.js manually
        console.log('[Paged.js] Script loaded, waiting for DOM to stabilize...');
        setTimeout(() => {
          console.log('[Paged.js] Triggering preview...');
          if (window.PagedPolyfill) {
            window.PagedPolyfill.preview();
          }
        }, 100);
      };
      document.head.appendChild(script);
      
      // Safety timeout: if Paged.js takes more than 30 seconds, something is wrong
      setTimeout(() => {
        if (!window.__pagedjs_ready) {
          console.error('[Paged.js] Timeout - layout taking too long, may be stuck in loop');
        }
      }, 30000);
    }
  });
</script>

<svelte:head>
  <title>Result Book - {competitionName}</title>
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
    <Medals {data} />
    <TeamPoints {data} />
    <Rankings {rankings} {competition} />
    <SessionProtocols {sessions} {competition} productionTime={data.productionTime} />
    <Records {allRecords} {hasRecords} {newRecordsBroken} {labels} />
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

  /* Capture strings for Paged.js headers/footers */
  :global(.competition-name-string) {
    /* stylelint-disable-next-line property-no-unknown */
    string-set: competition-name content();
  }
  
  :global(.competition-dates-string) {
    /* stylelint-disable-next-line property-no-unknown */
    string-set: competition-dates content();
  }
  
  :global(.generation-time-string) {
    /* stylelint-disable-next-line property-no-unknown */
    string-set: generation-time content();
  }
  
  :global(.footer-info-string) {
    /* stylelint-disable-next-line property-no-unknown */
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
