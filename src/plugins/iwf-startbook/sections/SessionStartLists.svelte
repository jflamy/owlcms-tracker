<script>
  export let sessions = [];

  // Extract unique age groups and their weight classes from a session
  function getSessionAgeGroups(session) {
    return session.ageGroupsWithWeights || [];
  }

  // Get weight class for an athlete in a specific age group (pre-computed server-side)
  function getAthleteWeightInAgeGroup(athlete, ageGroup) {
    if (!athlete.ageGroupParticipation) return '';
    return athlete.ageGroupParticipation[ageGroup] || '';
  }

  // Check if session has any technical officials
  function hasOfficials(session) {
    if (!session?.officials) return false;
    const officials = session.officials;
    return !!(
      officials.centerReferee ||
      officials.sideReferee1 ||
      officials.sideReferee2 ||
      officials.sideReferee3 ||
      officials.reserveReferee ||
      officials.marshal1 ||
      officials.marshal2 ||
      officials.timekeeper ||
      officials.technicalController1 ||
      officials.technicalController2 ||
      officials.competitionSecretary ||
      officials.competitionSecretary2 ||
      officials.doctor1 ||
      officials.doctor2 ||
      officials.juryPresident ||
      officials.juryMember1 ||
      officials.juryMember2 ||
      officials.juryMember3 ||
      officials.juryMember4 ||
      officials.juryMember5
    );
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

      <!-- Technical Officials section (if any) -->
      {#if hasOfficials(session)}
      <div class="officials-section">
        <h4>Technical Officials</h4>
        <div class="officials-grid">
          <!-- Column 1: Referees, Marshals, Timekeeper -->
          <div class="officials-column">
            {#if session.officials.centerReferee}
              <div class="official-item">
                <span class="label">Center Referee</span>
                <span class="name">{session.officials.centerReferee.fullName} ({session.officials.centerReferee.federation})</span>
              </div>
            {/if}
            {#if session.officials.sideReferee1}
              <div class="official-item">
                <span class="label">Side Referee</span>
                <span class="name">{session.officials.sideReferee1.fullName} ({session.officials.sideReferee1.federation})</span>
              </div>
            {/if}
            {#if session.officials.sideReferee2}
              <div class="official-item">
                <span class="label"></span>
                <span class="name">{session.officials.sideReferee2.fullName} ({session.officials.sideReferee2.federation})</span>
              </div>
            {/if}
            {#if session.officials.sideReferee3}
              <div class="official-item">
                <span class="label"></span>
                <span class="name">{session.officials.sideReferee3.fullName} ({session.officials.sideReferee3.federation})</span>
              </div>
            {/if}
            {#if session.officials.reserveReferee}
              <div class="official-item">
                <span class="label">Reserve Referee</span>
                <span class="name">{session.officials.reserveReferee.fullName} ({session.officials.reserveReferee.federation})</span>
              </div>
            {/if}
            <div class="spacer"></div>
            {#if session.officials.marshal1}
              <div class="official-item">
                <span class="label">Marshal</span>
                <span class="name">{session.officials.marshal1.fullName} ({session.officials.marshal1.federation})</span>
              </div>
            {/if}
            {#if session.officials.marshal2}
              <div class="official-item">
                <span class="label"></span>
                <span class="name">{session.officials.marshal2.fullName} ({session.officials.marshal2.federation})</span>
              </div>
            {/if}
            <div class="spacer"></div>
            {#if session.officials.timekeeper}
              <div class="official-item">
                <span class="label">Timekeeper</span>
                <span class="name">{session.officials.timekeeper.fullName} ({session.officials.timekeeper.federation})</span>
              </div>
            {/if}
          </div>

          <!-- Column 2: Technical Controllers, Secretaries, Doctors -->
          <div class="officials-column">
            {#if session.officials.technicalController1}
              <div class="official-item">
                <span class="label">Technical Controller</span>
                <span class="name">{session.officials.technicalController1.fullName} ({session.officials.technicalController1.federation})</span>
              </div>
            {/if}
            {#if session.officials.technicalController2}
              <div class="official-item">
                <span class="label"></span>
                <span class="name">{session.officials.technicalController2.fullName} ({session.officials.technicalController2.federation})</span>
              </div>
            {/if}
            <div class="spacer"></div>
            {#if session.officials.competitionSecretary}
              <div class="official-item">
                <span class="label">Competition Secretary</span>
                <span class="name">{session.officials.competitionSecretary.fullName} ({session.officials.competitionSecretary.federation})</span>
              </div>
            {/if}
            {#if session.officials.competitionSecretary2}
              <div class="official-item">
                <span class="label"></span>
                <span class="name">{session.officials.competitionSecretary2.fullName} ({session.officials.competitionSecretary2.federation})</span>
              </div>
            {/if}
            <div class="spacer"></div>
            {#if session.officials.doctor1}
              <div class="official-item">
                <span class="label">Doctor</span>
                <span class="name">{session.officials.doctor1.fullName} ({session.officials.doctor1.federation})</span>
              </div>
            {/if}
            {#if session.officials.doctor2}
              <div class="official-item">
                <span class="label"></span>
                <span class="name">{session.officials.doctor2.fullName} ({session.officials.doctor2.federation})</span>
              </div>
            {/if}
          </div>

          <!-- Column 3: Jury -->
          <div class="officials-column">
            {#if session.officials.juryPresident}
              <div class="official-item">
                <span class="label">Jury President</span>
                <span class="name">{session.officials.juryPresident.fullName} ({session.officials.juryPresident.federation})</span>
              </div>
            {/if}
            {#each [1, 2, 3, 4, 5] as i}
              {#if session.officials[`juryMember${i}`]}
                <div class="official-item">
                  <span class="label">{i === 1 || !session.officials[`juryMember${i-1}`] ? 'Jury Member' : ''}</span>
                  <span class="name">{session.officials[`juryMember${i}`].fullName} ({session.officials[`juryMember${i}`].federation})</span>
                </div>
              {/if}
            {/each}
          </div>
        </div>
      </div>
      {/if}

      <!-- Session Records section (if any) -->
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
              {#each session.records as record, i}
                {#if i > 0 && record.federation !== session.records[i - 1].federation}
                  <tr class="federation-spacer">
                    <td colspan="8"></td>
                  </tr>
                {/if}
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

  /* Session-level records: align styling with main records chapter */
  :global(.records-section) {
    margin-top: 15px;
    margin-bottom: 15px;
    page-break-inside: avoid;
    background: transparent;
    padding: 0;
    border: none;
    border-radius: 0;
  }

  .records-section h4 {
    margin: 8px 0 5px 0;
    font-size: 12pt;
    font-weight: bold;
  }

  .records-table {
    width: 100%;
    border-collapse: collapse;
    border-radius: 0;
    font-size: 9px;
    border: none;
    table-layout: fixed;
  }

  .records-table th,
  .records-table td {
    border: 1px solid #999;
    padding: 2px;
    text-align: left;
  }

  /* Widen the Name column in records table */
  .records-table th:nth-child(7),
  .records-table td:nth-child(7) {
    width: 30%;
  }

  /* Center specific records table columns: Age Group (3), Cat. (4), Record (6) */
  .records-table th:nth-child(3),
  .records-table td:nth-child(3),
  .records-table th:nth-child(4),
  .records-table td:nth-child(4),
  .records-table th:nth-child(6),
  .records-table td:nth-child(6) {
    text-align: center;
  }

  .records-table th {
    background: #f0f0f0;
    font-weight: bold;
    text-transform: uppercase;
    font-size: 8pt;
    padding: 3pt 3pt;
  }

  .federation-spacer {
    height: 8px;
    background: transparent;
  }

  .federation-spacer td {
    border: none !important;
    padding: 0;
  }

  /* Compact the records area on small landscape screens (e.g., 896x414) */
  @media (max-width: 926px) and (orientation: landscape) {
    .records-section {
      margin-top: 8px;
    }

    .records-table {
      font-size: 7px;
    }

    .records-table th,
    .records-table td {
      padding: 0.5px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Fixed widths to stay within viewport */
    .records-table th:nth-child(1), .records-table td:nth-child(1) { width: 10%; }
    .records-table th:nth-child(2), .records-table td:nth-child(2) { width: 18%; }
    .records-table th:nth-child(3), .records-table td:nth-child(3) { width: 10%; }
    .records-table th:nth-child(4), .records-table td:nth-child(4) { width: 8%; }
    .records-table th:nth-child(5), .records-table td:nth-child(5) { width: 10%; }
    .records-table th:nth-child(6), .records-table td:nth-child(6) { width: 8%; }
    .records-table th:nth-child(7), .records-table td:nth-child(7) { width: 26%; }
    .records-table th:nth-child(8), .records-table td:nth-child(8) { width: 10%; }
  }

  .officials-section {
    margin-top: 20px;
    page-break-inside: avoid;
  }

  .officials-section h4 {
    font-size: 12pt;
    font-weight: bold;
    margin-bottom: 10px;
  }

  .officials-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 20px;
  }

  .officials-column {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .official-item {
    display: flex;
    font-size: 9pt;
    line-height: 1.2;
  }

  .official-item .label {
    font-weight: bold;
    min-width: 140px;
  }

  .official-item .name {
    flex: 1;
  }

  .spacer {
    height: 8px;
  }
</style>
