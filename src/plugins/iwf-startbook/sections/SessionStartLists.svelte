<script>
  export let sessions = [];
  export let competition = {};

  // Extract unique age groups and their weight classes from a session
  function getSessionAgeGroups(session) {
    return session.ageGroupsWithWeights || [];
  }

  // Get weight class for an athlete in a specific age group (pre-computed server-side)
  function getAthleteWeightInAgeGroup(athlete, ageGroup) {
    if (!athlete.ageGroupParticipation) return '';
    return athlete.ageGroupParticipation[ageGroup] || '';
  }
</script>

<div class="session-start-lists-section" id="session-start-lists">
  <h1 class="section-header">Session Start Lists</h1>
  
  {#each sessions as session}
    <div class="session-page" id="session-{session.name}">
      <div class="session-title">
        <p><strong>Session {session.name} : {session.description}</strong>     {session.startTime}</p>
      </div>

      <!-- Main lifting order table with entry totals -->
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
            <!-- Dynamic age group columns -->
            {#each getSessionAgeGroups(session) as ageGroupData}
              <th class="col-age-group">{ageGroupData.ageGroup}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each session.athletes as category}
            <tr class="category-row">
              <td colspan="{7 + getSessionAgeGroups(session).length}">{category.categoryName}</td>
            </tr>
            {#each category.items as athlete}
              <tr>
                <td class="col-lot">{athlete.lotNumber}</td>
                <td class="col-name">{athlete.lastName}</td>
                <td class="col-firstname">{athlete.firstName}</td>
                <td class="col-team">{athlete.team}</td>
                <td class="col-bw">{athlete.bodyWeight}</td>
                <td class="col-born">{athlete.formattedBirth}</td>
                <td class="col-total">{athlete.total || '-'}</td>
                <!-- Age group participation markers -->
                {#each getSessionAgeGroups(session) as ageGroupData}
                  <td class="col-age-group">{getAthleteWeightInAgeGroup(athlete, ageGroupData.ageGroup)}</td>
                {/each}
              </tr>
            {/each}
          {/each}
        </tbody>
      </table>

      <!-- Records section (if any) -->
      {#if session.records && session.records.length > 0}
        <div class="records-section">
          <h4>Records</h4>
          <table class="records-table">
            <thead>
              <tr>
                <th>Federation</th>
                <th>Record Name</th>
                <th>Age Group</th>
                <th>Cat.</th>
                <th>Type</th>
                <th>Record</th>
                <th>Name</th>
                <th>Nation</th>
              </tr>
            </thead>
            <tbody>
              {#each session.records as record}
                <tr>
                  <td>{record.federation || 'WFA'}</td>
                  <td>{record.recordName}</td>
                  <td>{record.ageGroup}</td>
                  <td>{record.categoryCode}</td>
                  <td>{record.lift}</td>
                  <td>{record.value}</td>
                  <td>{record.holder}</td>
                  <td>{record.nation}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .session-start-lists-section {
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
    bookmark-level: 1;
    /* stylelint-disable-next-line property-no-unknown */
    bookmark-label: "Session Start Lists";
  }

  .session-page {
    padding: 0 20px 20px 20px;
    page-break-after: always;
  }

  .session-title {
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
    page-break-inside: auto;
  }

  .protocol-table thead {
    display: table-header-group;
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
  .col-age-group { width: 4%; text-align: center !important; }

  .category-row {
    background: #e8e8e8;
    font-weight: bold;
    font-size: 12pt;
  }

  .category-row td {
    text-align: left !important;
    padding-left: 8px !important;
  }

  .records-section {
    margin-top: 20px;
    page-break-inside: avoid;
  }

  .records-section h4 {
    margin: 10px 0 5px 0;
    font-size: 12pt;
    font-weight: bold;
  }

  .records-table {
    width: 100%;
    border-collapse: collapse;
    border-radius: 0;
    font-size: 9px;
    border: 1px solid #999;
  }

  .records-table th,
  .records-table td {
    border: 1px solid #999;
    padding: 2px;
    text-align: left;
  }

  .records-table th {
    background: #f0f0f0;
    font-weight: bold;
  }
</style>
