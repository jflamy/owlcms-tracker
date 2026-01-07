<script>
  export let allRecords = [];
  export let labels = {};
  export let hasRecords = false;
  export let newRecordsBroken = false;

  // Slugify strings for valid HTML IDs (no spaces, lowercase, URL-safe)
  function slugify(str) {
    return String(str || '')
      .replace(/>\s*(\d+)/g, '999')  // Replace >86 style weight classes with 999
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  // Debug: log what we received
  $: console.log('[Records] hasRecords:', hasRecords, 'newRecordsBroken:', newRecordsBroken, 'allRecords.length:', allRecords?.length || 0);
</script>

{#if hasRecords}
<div class="title-page-records">
  <h1 class="title-page-header">Records</h1>
</div>

<div class="records-section-page" id="records">
  {#if !newRecordsBroken}
    <div class="no-records">No records were broken.</div>
  {:else if !allRecords || allRecords.length === 0}
    <div class="no-records">No new records to display.</div>
  {:else}
    {#each allRecords as fed, fedIndex}
      <div class="federation-page" class:first-federation={fedIndex === 0}>
        {#each fed.genders as genderGroup}
          {#each genderGroup.ageGroups as ageGroup}
            <div class="record-block" id="records-{slugify(fed.federation)}-{slugify(genderGroup.genderName)}-{slugify(ageGroup.name)}">
              <h2 class="record-title">
                {fed.federation} - {genderGroup.genderName} - {ageGroup.name}
              </h2>

              <table class="records-table">
                <thead>
                  <tr>
                    <th>{labels.recordName || 'Record'}</th>
                    <th>{labels.category || 'Cat.'}</th>
                    <th>{labels.lift || 'Lift'}</th>
                    <th>{labels.value || 'Value'}</th>
                    <th class="holder-col">{labels.athlete || labels.holder || 'Athlete'}</th>
                    <th>Nation</th>
                  </tr>
                </thead>
                <tbody>
                  {#each ageGroup.records as record}
                    <tr>
                      <td>{record.recordName}</td>
                      <td>{record.category}</td>
                      <td>{record.lift}</td>
                      <td>{record.value}</td>
                      <td class="holder-col">{record.holder}</td>
                      <td>{record.nation}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/each}
        {/each}
      </div>
    {/each}
  {/if}
</div>
{/if}

<style>
  .title-page-records {
    height: 167mm !important;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    background: white;
    overflow: hidden;
    break-inside: avoid;
    break-after: page;
    page-break-before: always;
  }

  /* Column widths: holder column is 2x others */
  .records-table th,
  .records-table td {
    width: 14.28%;
  }
  .records-table .holder-col {
    width: 28.56%;
  }
  .title-page-header {
    font-size: 20pt;
    font-weight: bold;
    border-bottom: 2pt solid #333;
    padding-bottom: 10pt;
    /* stylelint-disable property-no-unknown */
    bookmark-level: 1;
    bookmark-label: "Records";
    /* stylelint-enable property-no-unknown */
  }
  .record-block {
    margin-bottom: 12pt;
    border-radius: 0;
    background: none;
    page-break-inside: avoid;
    /* stylelint-disable property-no-unknown */
    bookmark-level: 2;
    /* stylelint-enable property-no-unknown */
  }

  /* Only break before 2nd+ federations */
  .federation-page:not(.first-federation) {
    page-break-before: always;
    break-before: page;
  }

  .record-title {
    font-size: 14pt;
    font-weight: bold;
    margin-bottom: 4pt;
    background: #f0f0f0;
    padding: 4pt 10pt;
    border-left: 4pt solid #333;
    border-radius: 0;
  }
  .records-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 8pt;
    border: 1pt solid #333;
    table-layout: fixed;
    border-radius: 0;
    outline: 1pt solid #333; /* visible outline */
    page-break-inside: auto;
    break-inside: auto;
  }
  .records-table th,
  .records-table td {
    border: 1pt solid #333;
    padding: 2pt 3pt;
    text-align: center;
    border-radius: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    line-height: 1.2;
  }
  .records-table th {
    background: #e8e8e8;
    font-weight: bold;
    text-transform: uppercase;
    font-size: 8pt;
    padding: 3pt 3pt;
  }
  .no-records {
    text-align: center;
    font-style: italic;
    margin-top: 50pt;
    color: #666;
  }
</style>
