<script>
  // Accept either `data` object (preferred) or bare arrays for backward compatibility
  export let data = {};
  export let womenMedals = undefined;
  export let menMedals = undefined;
  export let combinedMedals = undefined;

  // Helper to sum medals for a row
  function sumMedals(row) {
    return [row.gold, row.silver, row.bronze].reduce((a, b) => (parseInt(a) || 0) + (parseInt(b) || 0), 0);
  }

  // Helper to format medal count: 0 becomes "-"
  function fmt(val) {
    const n = parseInt(val) || 0;
    return n === 0 ? '-' : n;
  }

  // Helper to sort teams by medals
  function sortTeamsByMedals(teams) {
    return (teams || []).slice().sort((a, b) => {
      if ((b.gold || 0) !== (a.gold || 0)) return (b.gold || 0) - (a.gold || 0);
      if ((b.silver || 0) !== (a.silver || 0)) return (b.silver || 0) - (a.silver || 0);
      return (b.bronze || 0) - (a.bronze || 0);
    });
  }

  // Derived source arrays: prefer explicit props, otherwise use data.medals
  $: srcWomen = Array.isArray(womenMedals) ? womenMedals : (data?.medals?.women || []);
  $: srcMen = Array.isArray(menMedals) ? menMedals : (data?.medals?.men || []);
  $: srcCombined = Array.isArray(combinedMedals) ? combinedMedals : (data?.medals?.combined || []);

  // Sorted arrays used by the template
  $: sortedWomen = sortTeamsByMedals(srcWomen);
  $: sortedMen = sortTeamsByMedals(srcMen);
  $: sortedCombined = sortTeamsByMedals(srcCombined);
  $: championships = data?.medals?.championships || [];
</script>

<div class="medals-section" id="medals">
  {#if championships.length > 0}
    {#if championships.length > 1}
      <h1 class="section-header">Medals</h1>
      <div class="overall-block avoid-break">
        <h3 class="champ-heading">Overall Medals</h3>
        <div class="medals-tables">
          <div class="medals-table-block">
            <h3 class="sub">Women</h3>
            <table class="medals-table">
              <thead>
                <tr><th>Team</th><th>Gold</th><th>Silver</th><th>Bronze</th><th>#</th></tr>
              </thead>
              <tbody>
                {#each sortedWomen as row}
                  <tr><td class="team-cell">{row.team}</td><td>{row.gold}</td><td>{row.silver}</td><td>{row.bronze}</td><td>{sumMedals(row)}</td></tr>
                {/each}
              </tbody>
            </table>
          </div>
          <div class="medals-table-block">
            <h3 class="sub">Men</h3>
            <table class="medals-table">
              <thead>
                <tr><th>Team</th><th>Gold</th><th>Silver</th><th>Bronze</th><th>#</th></tr>
              </thead>
              <tbody>
                {#each sortedMen as row}
                  <tr><td class="team-cell">{row.team}</td><td>{row.gold}</td><td>{row.silver}</td><td>{row.bronze}</td><td>{sumMedals(row)}</td></tr>
                {/each}
              </tbody>
            </table>
          </div>
          <div class="medals-table-block">
            <h3 class="sub">Combined</h3>
            <table class="medals-table">
              <thead>
                <tr><th>Team</th><th>Gold</th><th>Silver</th><th>Bronze</th><th>#</th></tr>
              </thead>
              <tbody>
                {#each sortedCombined as row}
                  <tr><td class="team-cell">{row.team}</td><td>{row.gold}</td><td>{row.silver}</td><td>{row.bronze}</td><td>{sumMedals(row)}</td></tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    {/if}
    {#each championships as champ, index}
      <div class="champ-block">
        {#if index === 0 && championships.length === 1}
          <h1 class="section-header">Medals</h1>
        {/if}
        <h3 class="champ-heading">{champ.name}</h3>
        <div class="medals-tables">
          <div class="medals-table-block">
            <h3 class="sub">Women</h3>
            <table class="medals-table">
              <thead><tr><th>Team</th><th>Gold</th><th>Silver</th><th>Bronze</th><th>#</th></tr></thead>
              <tbody>
                {#each sortTeamsByMedals(champ.women) as row}
                  <tr><td class="team-cell">{row.team}</td><td>{fmt(row.gold)}</td><td>{fmt(row.silver)}</td><td>{fmt(row.bronze)}</td><td>{sumMedals(row)}</td></tr>
                {/each}
              </tbody>
            </table>
          </div>
          <div class="medals-table-block">
            <h3 class="sub">Men</h3>
            <table class="medals-table">
              <thead><tr><th>Team</th><th>Gold</th><th>Silver</th><th>Bronze</th><th>#</th></tr></thead>
              <tbody>
                {#each sortTeamsByMedals(champ.men) as row}
                  <tr><td class="team-cell">{row.team}</td><td>{fmt(row.gold)}</td><td>{fmt(row.silver)}</td><td>{fmt(row.bronze)}</td><td>{sumMedals(row)}</td></tr>
                {/each}
              </tbody>
            </table>
          </div>
          <div class="medals-table-block">
            <h3 class="sub">Combined</h3>
            <table class="medals-table">
              <thead><tr><th>Team</th><th>Gold</th><th>Silver</th><th>Bronze</th><th>#</th></tr></thead>
              <tbody>
                {#each sortTeamsByMedals(champ.combined) as row}
                  <tr><td class="team-cell">{row.team}</td><td>{fmt(row.gold)}</td><td>{fmt(row.silver)}</td><td>{fmt(row.bronze)}</td><td>{sumMedals(row)}</td></tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    {/each}
  {:else}
    <div class="medals-tables">
      <div class="medals-table-block">
        <h2 class="medals-title">Women Medals</h2>
        <table class="medals-table">
          <thead>
            <tr>
              <th>Team</th>
              <th>Gold</th>
              <th>Silver</th>
              <th>Bronze</th>
              <th>#</th>
            </tr>
          </thead>
          <tbody>
            {#each sortedWomen as row}
              <tr>
                <td class="team-cell">{row.team}</td>
                <td>{row.gold}</td>
                <td>{row.silver}</td>
                <td>{row.bronze}</td>
                <td>{sumMedals(row)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div class="medals-table-block">
        <h2 class="medals-title">Men Medals</h2>
        <table class="medals-table">
          <thead>
            <tr>
              <th>Team</th>
              <th>Gold</th>
              <th>Silver</th>
              <th>Bronze</th>
              <th>#</th>
            </tr>
          </thead>
          <tbody>
            {#each sortedMen as row}
              <tr>
                <td class="team-cell">{row.team}</td>
                <td>{row.gold}</td>
                <td>{row.silver}</td>
                <td>{row.bronze}</td>
                <td>{sumMedals(row)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div class="medals-table-block">
        <h2 class="medals-title">Combined Men and Women Medals</h2>
        <table class="medals-table">
          <thead>
            <tr>
              <th>Team</th>
              <th>Gold</th>
              <th>Silver</th>
              <th>Bronze</th>
              <th>#</th>
            </tr>
          </thead>
          <tbody>
            {#each sortedCombined as row}
              <tr>
                <td class="team-cell">{row.team}</td>
                <td>{row.gold}</td>
                <td>{row.silver}</td>
                <td>{row.bronze}</td>
                <td>{sumMedals(row)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>

<style>
.medals-section {
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
  /* stylelint-disable-next-line property-no-unknown */
  bookmark-level: 1;
  /* stylelint-disable-next-line property-no-unknown */
  bookmark-label: "Medals";
}
.sub {
  font-size: 10pt;
  font-weight: bold;
  text-align: center;
  margin-bottom: 2pt;
  text-transform: uppercase;
  color: #444;
}
.champ-block.avoid-break, .champ-block, .overall-block {
  margin-bottom: 10pt;
  border-radius: 0;
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
.medals-tables {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  gap: 1rem;
  break-inside: avoid;
  page-break-inside: avoid;
}
.medals-table-block {
  flex: 1 1 0;
}
.medals-title {
  text-align: center;
  font-size: 1.1rem;
  font-weight: bold;
  margin-bottom: 0.5rem;
}
.medals-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10pt;
  margin-bottom: 1rem;
  border: 1pt solid #333;
  table-layout: fixed;
  border-radius: 0;
  outline: 1pt solid #333;
}
.medals-table th, .medals-table td {
  border: 1pt solid #333;
  padding: 3pt 4pt;
  text-align: center;
  border-radius: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  line-height: 1.1;
}
.medals-table th {
  background: #e8e8e8;
  font-weight: bold;
  text-transform: uppercase;
  font-size: 9pt;
}
.team-cell {
  font-weight: bold;
  text-align: left;
}
</style>
