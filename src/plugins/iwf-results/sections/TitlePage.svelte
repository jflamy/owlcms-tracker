<script>
  export let competition = {};
</script>

<div class="title-page">
  <div class="title-content">
    <h1>{competition.name || 'Competition Name'}</h1>
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
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    page-break-after: always;
    text-align: center;
    background: white;
  }

  .title-content {
    max-width: 80%;
  }

  h1 {
    font-size: 32pt;
    font-weight: bold;
    margin: 20pt 0;
    line-height: 1.2;
  }

  h2 {
    font-size: 18pt;
    font-weight: normal;
    margin: 10pt 0;
  }

  .organizer {
    margin-top: 40pt;
    font-size: 12pt;
  }

  .organizer p {
    margin: 5pt 0;
  }

  @media print {
    .title-page {
      height: 100vh;
    }
  }
</style>
