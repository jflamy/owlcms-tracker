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

  // Split array into chunks of max 20 items
  function chunk(arr, size = 20) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
</script>

<div class="section-page" id="category-participants">
  <h1 class="section-header">Category Participants</h1>
  
  {#each rankings as championship, champIndex}
    {@const firstCategory = { value: true }}
    {#each championship.genders as genderGroup, genderIndex}
      {#each genderGroup.categories as category, catIndex}
        {@const athleteChunks = chunk(category.items, 20)}
        {@const totalChunks = athleteChunks.length}
        {#each athleteChunks as athleteChunk, chunkIndex}
          {@const isFirstInGender = catIndex === 0 && chunkIndex === 0}
          {@const categoryId = `catparticipant-${slugify(championship.name)}-${slugify(genderGroup.genderName)}-${slugify(category.categoryName)}`}
          <div class="category-block" class:page-break-before={!firstCategory.value} id="{chunkIndex === 0 ? categoryId : `${categoryId}-${chunkIndex}`}">
            {#if isFirstInGender}
              <h2 class="championship-header">{championship.name} - {genderGroup.genderName}</h2>
            {/if}
            <table class="protocol-table">
              <thead>
                <tr>
                  <th class="col-lot">Lot</th>
                  <th class="col-name">Last Name</th>
                  <th class="col-firstname">First Name</th>
                  <th class="col-team">Team</th>
                  <th class="col-bw">B.W.</th>
                  <th class="col-born">Born</th>
                  <th class="col-total">Entry Total</th>
                </tr>
              </thead>
              <tbody>
                <tr class="category-row">
                  <td colspan="7">{category.categoryName}{totalChunks > 1 ? ` (${chunkIndex + 1}/${totalChunks})` : ''}{void (firstCategory.value = false)}</td>
                </tr>
                {#each athleteChunk as athlete}
                  <tr>
                    <td class="col-lot">{athlete.lotNumber}</td>
                    <td class="col-name">{athlete.lastName}</td>
                    <td class="col-firstname">{athlete.firstName}</td>
                    <td class="col-team">{athlete.team}</td>
                    <td class="col-bw">{athlete.bodyWeight}</td>
                    <td class="col-born">{athlete.formattedBirth}</td>
                    <td class="col-total">{athlete.total || '-'}</td>
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
  .section-page {
    background: white;
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
    /* stylelint-disable-next-line property-no-unknown */
    bookmark-level: 1; /* non-standard property for PDF bookmarks */
    /* stylelint-disable-next-line property-no-unknown */
    bookmark-label: "Category Participants"; /* non-standard property for PDF bookmarks */
  }

  .category-block {
    /* stylelint-disable-next-line property-no-unknown */
    bookmark-level: 2; /* non-standard property for PDF bookmarks */
  }

  .championship-header {
    font-size: 14pt;
    font-weight: bold;
    text-align: center;
    margin: 10pt 0 10pt 0;
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

  .col-lot { width: 5%; }
  .col-name { width: 20%; text-align: left !important; padding-left: 5px !important; }
  .col-firstname { width: 18%; text-align: left !important; padding-left: 5px !important; }
  .col-team { width: 12%; }
  .col-bw { width: 10%; }
  .col-born { width: 12%; }
  .col-total { width: 12%; text-align: center !important; font-weight: bold; }

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
</style>
