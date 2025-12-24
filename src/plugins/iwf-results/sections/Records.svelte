<script>
  export let allRecords = [];
  export let labels = {};

  // Debug: log what we received
  $: if (allRecords.length > 0) {
    console.log('[Records] Received records:', allRecords);
  } else {
    console.log('[Records] No records to display');
  }
</script>

<div class="records-section-page" id="records">
  <h1 class="section-header">Records</h1>
  
  {#if !allRecords || allRecords.length === 0}
    <div class="no-records">No records found in the database. (allRecords.length = {allRecords.length})</div>
  {:else}
    {#each allRecords as fed, fedIdx}
      <div class="federation-page" class:page-break={fedIdx > 0}>
        {#each fed.genders as genderGroup}
          {#each genderGroup.ageGroups as ageGroup}
            <div class="record-block">
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
                    <th>{labels.holder || 'Holder'}</th>
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
                      <td>{record.holder}</td>
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

<style>
  /* Uniform percentage column widths (all columns same size, sum = 100%) */
  .records-table th,
  .records-table td {
    width: 16.66%;
  }
  .section-header {
    font-size: 20pt;
    font-weight: bold;
    text-align: center;
    margin: 30pt 0 20pt 0;
    page-break-before: always;
    border-bottom: 2pt solid #333;
    padding-bottom: 10pt;
  }
  .record-block {
    page-break-inside: avoid;
    margin-bottom: 25pt;
    border-radius: 0;
    background: none;
  }
  .record-title {
    font-size: 14pt;
    font-weight: bold;
    margin-bottom: 8pt;
    background: #f0f0f0;
    padding: 5pt 10pt;
    border-left: 4pt solid #333;
    border-radius: 0;
  }
  .records-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10pt;
    border: 1pt solid #333;
    table-layout: fixed;
    border-radius: 0;
    outline: 1pt solid #333; /* visible outline */
  }
  .records-table th,
  .records-table td {
    border: 1pt solid #333;
    padding: 6pt 4pt;
    text-align: center;
    border-radius: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .records-table th {
    background: #e8e8e8;
    font-weight: bold;
    text-transform: uppercase;
    font-size: 9pt;
  }
  /* Page break for each federation except the first */
  .federation-page.page-break {
    page-break-before: always;
  }
  .no-records {
    text-align: center;
    font-style: italic;
    margin-top: 50pt;
    color: #666;
  }
</style>

...existing code...
