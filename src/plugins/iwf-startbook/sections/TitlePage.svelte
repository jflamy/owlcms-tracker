<script>
  export let competition = {};
  
  $: logoUrl = competition.frontLogoUrl;
</script>

<div class="title-page">
  <div class="title-content">
    {#if logoUrl}
      <img src="{logoUrl}" alt="Competition Logo" class="title-logo" />
    {/if}
    <h1>{competition.name || 'Competition Name'}</h1>
    <h1>Start Book</h1>
    <h2>{competition.city || 'Location'}</h2>
    <h2>{competition.dateRange || 'Date Range'}</h2>
    <div class="organizer">
      {#if competition.organizer}
        <p>Organized by: {competition.organizer}</p>
      {/if}
      {#if competition.federation}
        <p>Sanctioned by: {competition.federation}</p>
      {/if}
    </div>
  </div>
</div>

<style>
  .title-page {
    height: 167mm !important; /* A4 landscape height (210mm) minus margins (25mm+15mm) */
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    background: white;
    overflow: hidden;
    break-inside: avoid;
    break-after: page;
  }

  .title-content {
    max-width: 80%;
    margin-top: -2em;
  }

  .title-logo {
    height: 60mm;
    width: auto;
    max-width: 140mm;
    margin-bottom: 10pt;
  }

  h1 {
    font-size: 28pt;
    font-weight: bold;
    margin: 15pt 0;
    line-height: 1.2;
  }

  h2 {
    font-size: 16pt;
    font-weight: normal;
    margin: 8pt 0;
  }

  .organizer {
    margin-top: 30pt;
    font-size: 11pt;
  }

  .organizer p {
    margin: 4pt 0;
  }
</style>
