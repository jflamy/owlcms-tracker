<script>
  export let data = {};

  // Helper to format count: 0 becomes "-"
  function fmt(val) {
    const n = parseInt(val) || 0;
    return n === 0 ? '-' : n;
  }

  // Helper to sort teams by points with tiebreaker and add rank
  function sortTeamsByPoints(teams) {
    const sorted = (teams || []).slice().sort((a, b) => {
      if ((b.points || 0) !== (a.points || 0)) return (b.points || 0) - (a.points || 0);
      if ((b.count1st || 0) !== (a.count1st || 0)) return (b.count1st || 0) - (a.count1st || 0);
      if ((b.count2nd || 0) !== (a.count2nd || 0)) return (b.count2nd || 0) - (a.count2nd || 0);
      if ((b.count3rd || 0) !== (a.count3rd || 0)) return (b.count3rd || 0) - (a.count3rd || 0);
      return (b.count4th || 0) - (a.count4th || 0);
    });
    // Add rank to each team
    return sorted.map((team, index) => ({ ...team, rank: index + 1 }));
  }

  // Split array into chunks of max 25 items
  function chunk(arr, size = 25) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }

  $: championships = data?.teamPoints?.championships || [];
  $: tp1 = data?.teamPoints?.tp1 || 28;
  $: tp2 = data?.teamPoints?.tp2 || 26;
</script>

<div class="team-points-section" id="team-points">
  {#if championships.length > 0}
    {#each championships as champ, champIndex}
      <!-- Women Tables -->
      {#if champ.women && champ.women.length > 0}
        {@const sortedWomen = sortTeamsByPoints(champ.women)}
        {@const womenChunks = chunk(sortedWomen, 25)}
        {#each womenChunks as womenChunk, chunkIndex}
          <div class="champ-gender-block" class:page-break={champIndex > 0 && chunkIndex === 0} class:avoid-break={chunkIndex > 0}>
            {#if chunkIndex === 0}
              {#if champIndex === 0}
                <h1 class="section-header">Team Points</h1>
              {/if}
              <h3 class="champ-heading">{champ.name} - Women</h3>
            {/if}
            <table class="team-points-table">
              <thead>
                <tr>
                  <th style="width: 5%;">Rank</th>
                  <th style="width: 27%;">Team</th>
                  <th style="width: 10%;">Points</th>
                  <th style="width: 9.6%;">Members</th>
                  <th style="width: 9.6%;">Gold</th>
                  <th style="width: 9.6%;">Silver</th>
                  <th style="width: 9.6%;">Bronze</th>
                  <th style="width: 9.6%;">4th</th>
                  <th style="width: 9.6%;">5th</th>
                </tr>
              </thead>
              <tbody>
                {#each womenChunk as row}
                  <tr>
                    <td class="rank-cell">{row.rank}</td>
                    <td class="team-cell">{row.team}</td>
                    <td>{Math.floor(row.points || 0)}</td>
                    <td>{row.memberCount || 0}</td>
                    <td>{fmt(row.count1st)}</td>
                    <td>{fmt(row.count2nd)}</td>
                    <td>{fmt(row.count3rd)}</td>
                    <td>{fmt(row.count4th)}</td>
                    <td>{fmt(row.count5th)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/each}
      {/if}

      <!-- Men Tables -->
      {#if champ.men && champ.men.length > 0}
        {@const sortedMen = sortTeamsByPoints(champ.men)}
        {@const menChunks = chunk(sortedMen, 25)}
        {#each menChunks as menChunk, chunkIndex}
          <div class="champ-gender-block" class:page-break={chunkIndex === 0} class:avoid-break={chunkIndex > 0}>
            {#if chunkIndex === 0}
              <h3 class="champ-heading">{champ.name} - Men</h3>
            {/if}
            <table class="team-points-table">
              <thead>
                <tr>
                  <th style="width: 5%;">Rank</th>
                  <th style="width: 27%;">Team</th>
                  <th style="width: 10%;">Points</th>
                  <th style="width: 9.6%;">Members</th>
                  <th style="width: 9.6%;">Gold</th>
                  <th style="width: 9.6%;">Silver</th>
                  <th style="width: 9.6%;">Bronze</th>
                  <th style="width: 9.6%;">4th</th>
                  <th style="width: 9.6%;">5th</th>
                </tr>
              </thead>
              <tbody>
                {#each menChunk as row}
                  <tr>
                    <td class="rank-cell">{row.rank}</td>
                    <td class="team-cell">{row.team}</td>
                    <td>{Math.floor(row.points || 0)}</td>
                    <td>{row.memberCount || 0}</td>
                    <td>{fmt(row.count1st)}</td>
                    <td>{fmt(row.count2nd)}</td>
                    <td>{fmt(row.count3rd)}</td>
                    <td>{fmt(row.count4th)}</td>
                    <td>{fmt(row.count5th)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/each}
      {/if}

      <!-- Combined Tables -->
      {#if champ.combined && champ.combined.length > 0}
        {@const sortedCombined = sortTeamsByPoints(champ.combined)}
        {@const combinedChunks = chunk(sortedCombined, 25)}
        {#each combinedChunks as combinedChunk, chunkIndex}
          <div class="champ-gender-block" class:page-break={chunkIndex === 0} class:avoid-break={chunkIndex > 0}>
            {#if chunkIndex === 0}
              <h3 class="champ-heading">{champ.name} - Combined</h3>
            {/if}
            <table class="team-points-table">
              <thead>
                <tr>
                  <th style="width: 5%;">Rank</th>
                  <th style="width: 27%;">Team</th>
                  <th style="width: 10%;">Points</th>
                  <th style="width: 9.6%;">Members</th>
                  <th style="width: 9.6%;">Gold</th>
                  <th style="width: 9.6%;">Silver</th>
                  <th style="width: 9.6%;">Bronze</th>
                  <th style="width: 9.6%;">4th</th>
                  <th style="width: 9.6%;">5th</th>
                </tr>
              </thead>
              <tbody>
                {#each combinedChunk as row}
                  <tr>
                    <td class="rank-cell">{row.rank}</td>
                    <td class="team-cell">{row.team}</td>
                    <td>{Math.floor(row.points || 0)}</td>
                    <td>{row.memberCount || 0}</td>
                    <td>{fmt(row.count1st)}</td>
                    <td>{fmt(row.count2nd)}</td>
                    <td>{fmt(row.count3rd)}</td>
                    <td>{fmt(row.count4th)}</td>
                    <td>{fmt(row.count5th)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/each}
      {/if}
    {/each}
  {:else}
    <div class="no-data">No team points data available.</div>
  {/if}
</div>

<style>
.team-points-section {
  margin: 0.5rem 0;
  page-break-before: always;
}

.section-header {
  font-size: 16pt;
  font-weight: bold;
  text-align: center;
  margin: 10pt 0 8pt 0;
  border-bottom: 1pt solid #333;
  padding-bottom: 5pt;
  bookmark-level: 1;
  bookmark-label: "Team Points";
}

.champ-gender-block {
  margin-bottom: 10pt;
  break-inside: avoid;
  page-break-inside: avoid;
}

.champ-gender-block.page-break {
  page-break-before: always;
}

.champ-gender-block.avoid-break {
  break-inside: avoid;
  page-break-inside: avoid;
}

.champ-heading {
  font-size: 12pt;
  font-weight: bold;
  margin-bottom: 4pt;
  background: #f0f0f0;
  padding: 3pt 8pt;
  border-left: 3pt solid #333;
  border-radius: 0;
}

.team-points-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10pt;
  margin-bottom: 1rem;
  border: 1pt solid #333;
  table-layout: fixed;
  border-radius: 0;
  outline: 1pt solid #333;
}

.team-points-table th,
.team-points-table td {
  border: 1pt solid #333;
  padding: 3pt 4pt;
  text-align: center;
  border-radius: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  line-height: 1.1;
}

.team-points-table th {
  background: #e8e8e8;
  font-weight: bold;
  text-transform: uppercase;
  font-size: 9pt;
}

.team-cell {
  font-weight: bold;
  text-align: left;
}

.rank-cell {
  font-weight: bold;
  text-align: center;
}

.no-data {
  padding: 20px;
  text-align: center;
  color: #666;
  font-size: 14px;
}
</style>

