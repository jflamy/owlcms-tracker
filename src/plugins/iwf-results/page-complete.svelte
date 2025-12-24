<script>
  import TitlePage from './sections/TitlePage.svelte';
  import TableOfContents from './sections/TableOfContents.svelte';
  import Participants from './sections/Participants.svelte';
  import Medals from './sections/Medals.svelte';
  import Rankings from './sections/Rankings.svelte';
  import SessionProtocols from './sections/SessionProtocols.svelte';
  import Records from './sections/Records.svelte';

  export let data = {};

  $: competition = data.competition || {};
  $: sessions = data.sessions || [];
  $: athletes = data.allAthletes || [];
  
  // Debug: log allRecords on mount and when data changes
  $: {
    console.warn('[page-complete] Received data object keys:', Object.keys(data));
    console.warn('[page-complete] data.allRecords:', data.allRecords);
    if (data.allRecords) {
      console.warn('[page-complete] allRecords length:', data.allRecords.length);
      console.warn('[page-complete] allRecords[0]:', data.allRecords[0]);
    } else {
      console.warn('[page-complete] allRecords is undefined or null!');
    }
  }
</script>

<svelte:head>
  <!-- Paged.js for print pagination -->
  <script src="https://unpkg.com/pagedjs/dist/paged.polyfill.js"></script>
  <style>
    @page {
      size: A4 landscape;
      margin: 15mm 10mm 10mm 10mm;

      @top-left {
        content: string(comp-name);
        font-size: 9pt;
        font-weight: bold;
        vertical-align: bottom;
      }

      @top-right {
        content: string(comp-info);
        font-size: 9pt;
        vertical-align: bottom;
      }

      @bottom-left {
        content: "Generated: " string(production-time);
        font-size: 8pt;
        color: #666;
      }

      @bottom-right {
        content: "Page " counter(page);
        font-size: 8pt;
        color: #666;
      }
    }

    /* No page numbers or headers on title page */
    @page :first {
      @top-left { content: none; }
      @top-right { content: none; }
      @bottom-left { content: none; }
      @bottom-right { content: none; }
    }

    .comp-name-header { string-set: comp-name content(); }
    .comp-info-header { string-set: comp-info content(); }
    .production-time-header { string-set: production-time content(); }
  </style>
</svelte:head>

<div class="document-container">
  {#if data.status === 'waiting'}
    <div class="loading">{data.message}</div>
  {:else if !sessions || sessions.length === 0}
    <div class="no-data">{data.message || 'No competition data available.'}</div>
  {:else}
    <!-- Hidden elements for Paged.js headers -->
    <div style="display: none;">
      <span class="comp-name-header">{competition.name}</span>
      <span class="comp-info-header">{competition.city} {competition.dateRange}</span>
      <span class="production-time-header">{data.productionTime}</span>
    </div>

    <!-- Title Page -->
    <TitlePage {competition} />

    <!-- Table of Contents -->
    <div class="toc-break">
      <TableOfContents {sessions} />
    </div>

    <!-- Participants Section -->
    <Participants {data} />

    <!-- Medals Section -->
    <Medals {data} />

    <!-- Rankings Section -->
    <Rankings rankings={data.rankings} {competition} />

    <!-- Session Protocols Section -->
    <SessionProtocols 
      {sessions} 
      {competition} 
      productionTime={data.productionTime}
    />

    <!-- Records Section -->
    <Records allRecords={data.allRecords} labels={data.labels} />
  {/if}
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    background: white;
    font-family: Arial, sans-serif;
  }

  .document-container {
    background: white;
    color: black;
    font-size: 11px;
  }

  .toc-break {
    page-break-after: always;
  }

  .loading, .no-data {
    padding: 40pt;
    text-align: center;
    color: #666;
    font-size: 14pt;
  }

  /* Ensure tables don't break across pages */
  :global(.protocol-table),
  :global(.records-table),
  :global(.officials-grid) {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  /* Print-specific styles */
  @media print {
    .document-container {
      padding: 0;
      width: 100%;
    }

    /* Hide any UI elements */
    :global(.no-print) {
      display: none;
    }
  }
</style>
