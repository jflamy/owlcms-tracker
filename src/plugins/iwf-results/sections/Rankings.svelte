<script>
  export let rankings = [];
  export let competition = {};
  const _keepCompetitionProp = competition;

  // Slugify strings for valid HTML IDs (no spaces, lowercase, URL-safe)
  function slugify(str) {
    return String(str || '')
      .replace(/>\s*(\d+)/g, '999')  // Replace >86 style weight classes with 999
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  function formatRank(rank) {
    return rank || '-';
  }

  function getRankClass(rank, type) {
    const r = parseInt(rank);
    if (isNaN(r) || r < 1 || r > 3) return '';

    if (type === 'total' || competition.snatchCJTotalMedals) {
      if (r === 1) return 'rank-1';
      if (r === 2) return 'rank-2';
      if (r === 3) return 'rank-3';
    }
    return '';
  }

  // Split array into chunks of max 20 items
  function chunk(arr, size = 20) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
</script>

<div class="title-page-rankings">
  <h1 class="title-page-header">Rankings</h1>
</div>

<div class="section-page" id="rankings">
  {#each rankings as championship, champIndex}
    {@const firstCategory = { value: true }}
    {#each championship.genders as genderGroup, genderIndex}
      {#each genderGroup.categories as category, catIndex}
        {@const athleteChunks = chunk(category.items, 20)}
        {@const totalChunks = athleteChunks.length}
        {#each athleteChunks as athleteChunk, chunkIndex}
          {@const isFirstInGender = catIndex === 0 && chunkIndex === 0}
          {@const categoryId = `ranking-${slugify(championship.name)}-${slugify(genderGroup.genderName)}-${slugify(category.categoryName)}`}
          <div class="category-block" class:page-break-before={!firstCategory.value} id="{chunkIndex === 0 ? categoryId : `${categoryId}-${chunkIndex}`}">
            {#if isFirstInGender}
              <h2 class="championship-header" class:page-break-before={!(champIndex === 0 && genderIndex === 0)}>{championship.name} - {genderGroup.genderName}</h2>
            {/if}
            <h4 class="category-header">{category.categoryName}{totalChunks > 1 ? ` (${chunkIndex + 1}/${totalChunks})` : ''}{void (firstCategory.value = false)}</h4>
            <table class="protocol-table">
              <thead>
                <tr>
                  <th rowspan="2" class="col-lot">Lot</th>
                  <th rowspan="2" class="col-name">Last Name</th>
                  <th rowspan="2" class="col-firstname">First Name</th>
                  <th rowspan="2" class="col-team">Team</th>
                  <th rowspan="2" class="col-cat">Cat.</th>
                  <th rowspan="2" class="col-bw">B.W.</th>
                  <th rowspan="2" class="col-born">Born</th>
                  <th colspan="5">Snatch</th>
                  <th colspan="5">Clean&Jerk</th>
                  <th colspan="2">Total</th>
                </tr>
                <tr>
                  <th class="col-attempt">1</th><th class="col-attempt">2</th><th class="col-attempt">3</th><th class="col-max">Max</th><th class="col-rank">Rank</th>
                  <th class="col-attempt">1</th><th class="col-attempt">2</th><th class="col-attempt">3</th><th class="col-max">Max</th><th class="col-rank">Rank</th>
                  <th class="col-total">Total</th><th class="col-rank">Rank</th>
                </tr>
              </thead>
              <tbody>
                {#each athleteChunk as athlete}
                  <tr>
                    <td class="col-lot">{athlete.lotNumber}</td>
                    <td class="col-name">{athlete.lastName}</td>
                    <td class="col-firstname">{athlete.firstName}</td>
                    <td class="col-team">{athlete.team}</td>
                    <td class="col-cat">{athlete.categoryName}</td>
                    <td class="col-bw">{athlete.bodyWeight}</td>
                    <td class="col-born">{athlete.formattedBirth}</td>
                    <td class="col-attempt">{athlete.snatch1 || '-'}</td>
                    <td class="col-attempt">{athlete.snatch2 || '-'}</td>
                    <td class="col-attempt">{athlete.snatch3 || '-'}</td>
                    <td class="col-max">{athlete.bestSnatch || '-'}</td>
                    <td class="col-rank {getRankClass(athlete.snatchRank, 'snatch')}">{formatRank(athlete.snatchRank)}</td>
                    <td class="col-attempt">{athlete.cleanJerk1 || '-'}</td>
                    <td class="col-attempt">{athlete.cleanJerk2 || '-'}</td>
                    <td class="col-attempt">{athlete.cleanJerk3 || '-'}</td>
                    <td class="col-max">{athlete.bestCleanJerk || '-'}</td>
                    <td class="col-rank {getRankClass(athlete.cleanJerkRank, 'cj')}">{formatRank(athlete.cleanJerkRank)}</td>
                    <td class="col-total">{athlete.total || '-'}</td>
                    <td class="col-rank {getRankClass(athlete.totalRank, 'total')}">{formatRank(athlete.totalRank)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/each}
      {/each}
    {/each}
  {/each}
</div>

<style>
  .title-page-rankings {
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

  .section-page {
    background: white;
  }

  .title-page-header {
    font-size: 20pt;
    font-weight: bold;
    border-bottom: 2pt solid #333;
    padding-bottom: 10pt;
    /* stylelint-disable property-no-unknown */
    bookmark-level: 1;
    bookmark-label: "Rankings";
    /* stylelint-enable property-no-unknown */
  }

  .section-header {
    font-size: 20pt;
    font-weight: bold;
    text-align: center;
    margin: 30pt 0 20pt 0;
    page-break-before: always;
    border-bottom: 2pt solid #333;
    padding-bottom: 10pt;
    width: 100%;
    /* stylelint-disable property-no-unknown */
    bookmark-level: 1;
    bookmark-label: "Rankings";
    /* stylelint-enable property-no-unknown */
  }

  .ranking-block {
    padding: 0 20px 20px 20px;
    background: white;
  }

  .category-block {
    /* stylelint-disable property-no-unknown */
    bookmark-level: 2; /* non-standard property for PDF bookmarks */
    /* stylelint-enable property-no-unknown */
  }
  
  .page-break {
    page-break-before: always;
  }

  .championship-header {
    font-size: 14pt;
    font-weight: bold;
    text-align: center;
    margin: 10pt 0 10pt 0;
    page-break-before: auto;
  }

  .championship-header.page-break-before {
    break-before: page;
    page-break-before: always;
  }

  .category-header {
    font-size: 13pt;
    font-weight: bold;
    margin: 8pt 0 6pt 0;
    padding: 0;
    border-bottom: none;
  }

  .protocol-table {
    width: 100%;
    border-collapse: collapse;
    border-radius: 0;
    margin-bottom: 15px;
    font-size: 10px;
    border: 1px solid black;
    table-layout: fixed;
    page-break-inside: auto;  /* Allow breaks inside the table */
  }

  .protocol-table thead {
    display: table-header-group;  /* Repeat header on each page */
  }

  .protocol-table th,
  .protocol-table td {
    border: 1px solid black;
    padding: 3px 2px;
    text-align: center;
    height: 20px;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .protocol-table th {
    background: #f0f0f0;
    font-weight: bold;
    padding: 2px 1px;
    font-size: 8px;
    text-transform: uppercase;
  }

  .col-lot { width: 3%; }
  .col-name { width: 14%; text-align: left !important; padding-left: 5px !important; }
  .col-firstname { width: 11%; text-align: left !important; padding-left: 5px !important; }
  .col-team { width: 5%; }
  .col-cat { width: 6%; }
  .col-bw { width: 5%; }
  .col-born { width: 8%; }
  .col-attempt { width: 3.5%; text-align: center !important; }
  .col-max { width: 4%; text-align: center !important; }
  .col-rank { width: 3.5%; text-align: center !important; }
  .col-total { width: 4%; text-align: center !important; font-weight: bold; }

  .rank-1 { background-color: #FFD700; font-weight: bold; font-size: 1.2em; } /* Gold */
  .rank-2 { background-color: #C0C0C0; font-weight: bold; font-size: 1.2em; } /* Silver */
  .rank-3 { background-color: #CD7F32; font-weight: bold; font-size: 1.2em; } /* Bronze */

  .category-row {
    background: #e8e8e8;
    font-weight: bold;
    font-size: 12pt;
  }

  .category-row td {
    text-align: left !important;
    padding-left: 8px !important;
  }

  /* Each category is its own table - keep it together */
  .category-block {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  /* Page break before 2nd+ category blocks */
  .category-block.page-break-before {
    break-before: page;
    page-break-before: always;
  }

  /* Spacer between categories - this is where page breaks can occur */
  .category-spacer {
    height: 8pt;
  }
</style>
