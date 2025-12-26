<script>
  export let sessions = [];
  export let competition = {};

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

<div class="protocols-section" id="protocols">
  <h1 class="section-header">Session Protocols</h1>
  
  {#each sessions as session}
    <div class="session-page" id="session-{session.name}">
      <div class="session-title">
        <p><strong>Session {session.name} : {session.description}</strong>     {session.startTime}</p>
      </div>

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
          {#each session.athletes as category}
            <tr class="category-row">
              <td colspan="19">{category.categoryName}</td>
            </tr>
            {#each category.items as athlete}
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
          {/each}
        </tbody>
      </table>

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

      {#if session.newRecords && session.newRecords.length > 0}
        <div class="records-section new-records">
          <h4>New Records</h4>
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
              {#each session.newRecords as record}
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

      {#if hasOfficials(session)}
      <div class="officials-section">
        <h4>Technical Officials</h4>
        <div class="officials-grid">
          <!-- Column 1: Referees, Marshals, Timekeeper -->
          <div class="officials-column">
            {#if session.officials.centerReferee}
              <div class="official-item">
                <span class="label">Center Referee</span>
                <span class="name">{session.officials.centerReferee.fullName}</span>
              </div>
            {/if}
            {#if session.officials.sideReferee1}
              <div class="official-item">
                <span class="label">Side Referee</span>
                <span class="name">{session.officials.sideReferee1.fullName}</span>
              </div>
            {/if}
            {#if session.officials.sideReferee2}
              <div class="official-item">
                <span class="label">Side Referee</span>
                <span class="name">{session.officials.sideReferee2.fullName}</span>
              </div>
            {/if}
            {#if session.officials.sideReferee3}
              <div class="official-item">
                <span class="label">Side Referee</span>
                <span class="name">{session.officials.sideReferee3.fullName}</span>
              </div>
            {/if}
            {#if session.officials.reserveReferee}
              <div class="official-item">
                <span class="label">Reserve Referee</span>
                <span class="name">{session.officials.reserveReferee.fullName}</span>
              </div>
            {/if}
            <div class="spacer"></div>
            {#if session.officials.marshal1}
              <div class="official-item">
                <span class="label">Marshal</span>
                <span class="name">{session.officials.marshal1.fullName}</span>
              </div>
            {/if}
            {#if session.officials.marshal2}
              <div class="official-item">
                <span class="label">Marshal</span>
                <span class="name">{session.officials.marshal2.fullName}</span>
              </div>
            {/if}
            <div class="spacer"></div>
            {#if session.officials.timekeeper}
              <div class="official-item">
                <span class="label">Timekeeper</span>
                <span class="name">{session.officials.timekeeper.fullName}</span>
              </div>
            {/if}
          </div>

          <!-- Column 2: Technical Controllers, Secretaries, Doctors -->
          <div class="officials-column">
            {#if session.officials.technicalController1}
              <div class="official-item">
                <span class="label">Technical Controller</span>
                <span class="name">{session.officials.technicalController1.fullName}</span>
              </div>
            {/if}
            {#if session.officials.technicalController2}
              <div class="official-item">
                <span class="label">Technical Controller</span>
                <span class="name">{session.officials.technicalController2.fullName}</span>
              </div>
            {/if}
            <div class="spacer"></div>
            {#if session.officials.competitionSecretary}
              <div class="official-item">
                <span class="label">Competition Secretary</span>
                <span class="name">{session.officials.competitionSecretary.fullName}</span>
              </div>
            {/if}
            {#if session.officials.competitionSecretary2}
              <div class="official-item">
                <span class="label">Competition Secretary</span>
                <span class="name">{session.officials.competitionSecretary2.fullName}</span>
              </div>
            {/if}
            <div class="spacer"></div>
            {#if session.officials.doctor1}
              <div class="official-item">
                <span class="label">Doctor</span>
                <span class="name">{session.officials.doctor1.fullName}</span>
              </div>
            {/if}
            {#if session.officials.doctor2}
              <div class="official-item">
                <span class="label">Doctor</span>
                <span class="name">{session.officials.doctor2.fullName}</span>
              </div>
            {/if}
          </div>

          <!-- Column 3: Jury -->
          <div class="officials-column">
            {#if session.officials.juryPresident}
              <div class="official-item">
                <span class="label">Jury President</span>
                <span class="name">{session.officials.juryPresident.fullName}</span>
              </div>
            {/if}
            {#each [1, 2, 3, 4, 5] as i}
              {#if session.officials[`juryMember${i}`]}
                <div class="official-item">
                  <span class="label">Jury Member</span>
                  <span class="name">{session.officials[`juryMember${i}`].fullName}</span>
                </div>
              {/if}
            {/each}
          </div>
        </div>
      </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .section-header {
    font-size: 20pt;
    font-weight: bold;
    text-align: center;
    margin: 30pt 0 20pt 0;
    page-break-before: always;
    border-bottom: 2pt solid #333;
    padding-bottom: 10pt;
    /* stylelint-disable-next-line property-no-unknown */
    bookmark-level: 1; /* non-standard property for PDF bookmarks */
    /* stylelint-disable-next-line property-no-unknown */
    bookmark-label: "Session Protocols"; /* non-standard property for PDF bookmarks */
  }

  .session-page {
    page-break-after: always;
    padding: 20px;
    position: relative;
    background: white;
    /* stylelint-disable-next-line property-no-unknown */
    bookmark-level: 2; /* non-standard property for PDF bookmarks */
  }

  .session-title {
    text-align: center;
    margin-bottom: 10px;
    line-height: 1.2;
  }

  .session-title p {
    margin: 10px 0;
    font-size: 16pt;
  }

  .protocol-table {
    width: 100%;
    border-collapse: collapse;
    border-radius: 0;
    margin-bottom: 15px;
    font-size: 10px;
    border: 1px solid black;
    table-layout: fixed;
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

  .records-section {
    margin-top: 15px;
    margin-bottom: 15px;
    page-break-inside: avoid;
  }

  .records-section h4 {
    font-size: 9px;
    font-weight: bold;
    margin: 8px 0 5px 0;
  }

  .records-table {
    width: 100%;
    border-collapse: collapse;
    border-radius: 0;
    font-size: 9px;
    border: 1px solid #999;
    table-layout: auto;
  }

  .records-table th,
  .records-table td {
    border: 1px solid #999;
    padding: 2px 3px;
    text-align: center;
    margin: 0;
  }

  .records-table td:nth-child(7),
  .records-table th:nth-child(7) {
    text-align: left;
  }

  .records-table th {
    background: #f0f0f0;
    font-weight: bold;
    padding: 2px 3px;
    font-size: 8px;
    text-transform: uppercase;
  }

  .officials-section {
    margin-top: 20px;
    page-break-inside: avoid;
  }

  .officials-section h4 {
    font-size: 9px;
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
    font-size: 9px;
    line-height: 1.2;
  }

  .official-item .label {
    font-weight: bold;
    min-width: 110px;
  }

  .official-item .name {
    flex: 1;
  }

  .spacer {
    height: 8px;
  }
</style>
