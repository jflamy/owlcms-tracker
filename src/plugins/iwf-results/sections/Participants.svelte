<script>
  export let data = {};
  
  $: participants = data?.participants || {};
  $: championships = participants?.championships || [];
  $: chunkedChampionships = championships.map(ch => ({
    ...ch,
    chunks: chunkRows(ch.rows || [], 20)
  }));
  $: console.log('[Participants.svelte] championships count:', championships.length);
  $: if (championships.length > 0) {
    console.log('[Participants.svelte] Championship names:', championships.map(c => c.name));
    console.log('[Participants.svelte] First champ women cats:', championships[0]?.womenCategories?.map(c => c.name));
    console.log('[Participants.svelte] First champ men cats:', championships[0]?.menCategories?.map(c => c.name));
    championships.forEach((c, idx) => {
      console.log(`[Participants.svelte] champ[${idx}] ${c.name}: rows=${c.rows?.length || 0}`);
      if (c.rows?.length) {
        const first = c.rows[0];
        const last = c.rows[c.rows.length - 1];
        console.log(`[Participants.svelte]   first team=${first.team}, total=${first.total}, women=${first.womenTotal}, men=${first.menTotal}`);
        console.log(`[Participants.svelte]   last team=${last.team}, total=${last.total}, women=${last.womenTotal}, men=${last.menTotal}`);
      }
    });
  }

  // Format cell value: 0 becomes empty, numbers stay as-is
  function fmt(val) {
    const n = parseInt(val) || 0;
    return n === 0 ? '' : n;
  }

  // Extract trailing numeric/threshold part of category name (e.g., "SR M 110" -> "110", "SR M >110" -> ">110")
  function shortCat(name = '') {
    const parts = String(name).trim().split(/\s+/);
    return parts.length ? parts[parts.length - 1] : name;
  }

  // Split rows into chunks - first chunk is smaller to fit with header
  function chunkRows(rows = [], size = 20) {
    const chunks = [];
    const firstChunkSize = 18;
    
    if (rows.length === 0) return [rows];
    
    // First chunk: 18 items to fit with header
    chunks.push(rows.slice(0, firstChunkSize));
    
    // Remaining chunks: 20 items each
    for (let i = firstChunkSize; i < rows.length; i += size) {
      chunks.push(rows.slice(i, i + size));
    }
    
    return chunks;
  }
</script>

<div class="section-page" id="participants">
  <div class="header-block">
    <h1 class="section-header">Participants</h1>
  </div>
  
  {#each chunkedChampionships as champ, cIndex (champ.name)}
  {#each champ.chunks as chunk, chunkIndex}
    <div class="champ-block">
      
        {#if chunk.length > 0}
          <table class="participation-table">
            <thead>
            <tr class="group-header">
              <th class="team-col"></th>
              <th class="women-group" colspan={champ.womenCategories.length + 1}>{champ.name} Women</th>
              <th class="spacer-col"></th>
              <th class="men-group" colspan={champ.menCategories.length + 1}>{champ.name} Men</th>
              <th class="spacer-col"></th>
              <th class="total-col"></th>
            </tr>
              <tr>
                <th class="team-col">Teams</th>
                {#each champ.womenCategories as cat}
                  <th class="cat-col">{shortCat(cat.name)}</th>
                {/each}
                <th class="subtotal-col">#</th>
                <th class="spacer-col"></th>
                {#each champ.menCategories as cat}
                  <th class="cat-col">{shortCat(cat.name)}</th>
                {/each}
                <th class="subtotal-col">#</th>
                <th class="spacer-col"></th>
                <th class="total-col">Total</th>
              </tr>
            </thead>
            <tbody>
              {#each chunk as row (row.team)}
                <tr>
                  <td class="team-cell">{row.team}</td>
                  {#each row.womenCells as count}
                    <td class="count-cell">{fmt(count)}</td>
                  {/each}
                  <td class="subtotal-cell">{fmt(row.womenTotal)}</td>
                  <td class="spacer-cell"></td>
                  {#each row.menCells as count}
                    <td class="count-cell">{fmt(count)}</td>
                  {/each}
                  <td class="subtotal-cell">{fmt(row.menTotal)}</td>
                  <td class="spacer-cell"></td>
                  <td class="total-cell">{row.total}</td>
                </tr>
              {/each}
            </tbody>
            {#if chunkIndex === champ.chunks.length - 1}
              <tfoot>
                <tr class="totals-row">
                  <td class="team-cell">{champ.rows.length}</td>
                  {#each champ.totals?.womenCells || [] as count}
                    <td class="count-cell">{fmt(count)}</td>
                  {/each}
                  <td class="subtotal-cell">{champ.totals?.womenTotal || 0}</td>
                  <td class="spacer-cell"></td>
                  {#each champ.totals?.menCells || [] as count}
                    <td class="count-cell">{fmt(count)}</td>
                  {/each}
                  <td class="subtotal-cell">{champ.totals?.menTotal || 0}</td>
                  <td class="spacer-cell"></td>
                  <td class="total-cell">{champ.totals?.total || 0}</td>
                </tr>
              </tfoot>
            {/if}
          </table>
        {/if}
      </div>
    {/each}
  {/each}
</div>

<style>
  .section-page {
    padding: 20pt 30pt;
    background: white;
  }

  .section-header {
    font-size: 16pt;
    font-weight: bold;
    text-align: center;
    margin: 10pt 0 8pt 0;
    border-bottom: 1pt solid #333;
    padding-bottom: 5pt;
    bookmark-level: 1;
    bookmark-label: "Participants";
  }

  .champ-block {
    margin-bottom: 15pt;
  }

  .champ-heading {
    font-size: 12pt;
    font-weight: bold;
    margin: 10pt 0 5pt 0;
    color: #333;
  }

  .participation-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9pt;
    table-layout: fixed;
    page-break-after: auto;
    page-break-inside: auto;
    break-inside: auto;
    border-radius: 0;
  }

  .participation-table th,
  .participation-table td {
    border: 0.5pt solid #999;
    padding: 2pt 3pt;
    text-align: center;
    white-space: nowrap;
    border-radius: 0;
  }

  .participation-table th {
    background: #e8e8e8;
    font-weight: bold;
    font-size: 8pt;
  }

  .group-header th {
    background: #dcdcdc;
    font-size: 9pt;
    text-align: center;
  }

  .women-group,
  .men-group {
    font-weight: bold;
  }

  .team-col {
    text-align: left;
    width: 50pt;
  }

  .cat-col {
    width: 30pt;
  }

  .subtotal-col {
    background: #d0d0d0;
    width: 40pt;
  }

  .total-col {
    width: 35pt;
    background: #c0c0c0;
  }

  .spacer-col,
  .spacer-cell {
    width: 5pt;
    min-width: 5pt;
    max-width: 5pt;
    background: white !important;
    border-top: 0.5pt solid white !important;
    border-bottom: 0.5pt solid white !important;
    border-left: 0.5pt solid #999;
    border-right: 0.5pt solid #999;
  }


  .team-cell {
    font-weight: bold;
    text-align: left;
  }

  .count-cell {
    color: #0066cc;
  }

  .subtotal-cell {
    background: #f0f0f0;
    font-weight: bold;
  }

  .total-cell {
    background: #e8e8e8;
    font-weight: bold;
  }

  .totals-row {
    border-top: 1pt solid #333;
  }

  .totals-row td {
    font-weight: bold;
    background: #e0e0e0;
  }

  .totals-row .spacer-cell {
    background: white;
  }
</style>
