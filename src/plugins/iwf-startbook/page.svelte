<script>
  import { onMount } from 'svelte';
  import SessionStartLists from './sections/SessionStartLists.svelte';
  import TitlePage from './sections/TitlePage.svelte';
  import TableOfContents from './sections/TableOfContents.svelte';
  import Participants from './sections/Participants.svelte';
  import CategoryParticipants from './sections/CategoryParticipants.svelte';
  import Records from './sections/Records.svelte';

  export let data = {};
  export let options = {};

  $: labels = data.labels || {};
  $: sessions = data.sessions || [];
  $: competition = data.competition || {};
  $: rankings = data.rankings || [];
  $: allRecords = data.allRecords || [];
  $: hasRecords = data.hasRecords || false;
  $: newRecordsBroken = data.newRecordsBroken || false;
  $: format = options.format || 'complete';
  $: includeSessionStartLists = data.includeSessionStartLists !== false;
  $: includeOfficials = data.includeOfficials !== false;
  $: includeCategoryParticipants = data.includeCategoryParticipants !== false;
  $: competitionName = competition.name || 'Competition';
  $: competitionDates = competition.dateRange || '';
  $: headerLeftUrl = data.headerLeftUrl || '';
  $: headerRightUrl = data.headerRightUrl || '';
  
  // Debug: trace data flow
  $: console.log('[iwf-startbook] data received:', {
    hasData: !!data,
    status: data?.status,
    sessionsCount: sessions?.length,
    competitionName: competition?.name,
    participantsChampionships: data?.participants?.championships?.length,
    allRecordsCount: allRecords?.length
  });

  // Format current date/time for footer (local time with timezone)
  $: generationTime = (() => {
    if (data.productionTime) {
      const dt = new Date(data.productionTime);
      const year = dt.getFullYear();
      const month = String(dt.getMonth() + 1).padStart(2, '0');
      const day = String(dt.getDate()).padStart(2, '0');
      const hours = String(dt.getHours()).padStart(2, '0');
      const minutes = String(dt.getMinutes()).padStart(2, '0');
      
      // Get timezone abbreviation (e.g., "EST", "CET", "PST")
      const timezone = new Intl.DateTimeFormat('en', { timeZoneName: 'short' })
        .formatToParts(dt)
        .find(part => part.type === 'timeZoneName')?.value || '';
      
      return `${year}-${month}-${day} ${hours}:${minutes} ${timezone}`;
    }
    return '';
  })();
  
  // Format exportDate and version for footer (local time with timezone)
  $: footerInfo = (() => {
    const version = competition.owlcmsVersion || '';
    const exportDate = competition.exportDate || '';
    if (exportDate) {
      // Parse ISO 8601 timestamp and format as local time with timezone
      const dt = new Date(exportDate);
      const year = dt.getFullYear();
      const month = String(dt.getMonth() + 1).padStart(2, '0');
      const day = String(dt.getDate()).padStart(2, '0');
      const hours = String(dt.getHours()).padStart(2, '0');
      const minutes = String(dt.getMinutes()).padStart(2, '0');
      
      // Get timezone abbreviation (e.g., "EST", "CET", "PST")
      const timezone = new Intl.DateTimeFormat('en', { timeZoneName: 'short' })
        .formatToParts(dt)
        .find(part => part.type === 'timeZoneName')?.value || '';
      
      const formattedDate = `${year}-${month}-${day} ${hours}:${minutes} ${timezone}`;
      return version ? `OWLCMS ${version} – ${formattedDate}` : `– ${formattedDate}`;
    }
    return version ? `OWLCMS ${version}` : '';
  })();
  
  // Load Paged.js dynamically when format is 'complete'
  onMount(() => {
    if (format === 'complete' && typeof window !== 'undefined') {
      // Prevent Paged.js from running multiple times (e.g., due to HMR or re-renders)
      if (window.__pagedjs_started) {
        console.log('[Paged.js] Already started, skipping');
        return;
      }
      window.__pagedjs_started = true;
      
      // Set up Paged.js completion handler BEFORE loading the script
      // Use auto: false and manually trigger after DOM is stable
      window.PagedConfig = {
        auto: false,
        after: () => {
          console.log('[Paged.js] Rendering complete, setting ready flag');
          setTimeout(() => {
            window.__pagedjs_ready = true;
            console.log('[Paged.js] Ready flag set');
          }, 500);
        }
      };
      
      const script = document.createElement('script');
      // Use locally bundled Paged.js (pinned to 0.4.3)
      script.src = '/node_modules/pagedjs/dist/paged.polyfill.js';
      script.onload = () => {
        // Wait for DOM to stabilize, then trigger Paged.js manually
        console.log('[Paged.js] Script loaded, waiting for DOM to stabilize...');
        setTimeout(() => {
          console.log('[Paged.js] Triggering preview...');
          if (window.PagedPolyfill) {
            window.PagedPolyfill.preview();
          }
        }, 100);
      };
      document.head.appendChild(script);
      
      // Safety timeout: if Paged.js takes more than 30 seconds, something is wrong
      setTimeout(() => {
        if (!window.__pagedjs_ready) {
          console.error('[Paged.js] Timeout - layout taking too long, may be stuck in loop');
        }
      }, 30000);
    }
  });

  $: timetableRows = data.technicalOfficialsTimetableRows || [];
  $: timetableRoleInfo = data.technicalOfficialsTimetableRoles || [];
  $: showPlatformColumn = data.technicalOfficialsTimetableHasMultiplePlatforms;
  $: officialSections = data.officialSections || [];

  // Build team listing for a role category: group officials by team number
  function buildTeamListing(officials = [], roleCategory) {
    const teamMap = new Map();
    
    // Normalize MARSHAL/MARSHALL spelling
    const normalizeRole = (role) => {
      if (role === 'MARSHALL') return 'MARSHAL';
      return role;
    };
    const normalizedRoleCategory = normalizeRole(roleCategory);
    
    officials.forEach(official => {
      // Field is technicalOfficialTeam, not teamNumber
      const officialRole = normalizeRole(official.teamRole);
      if (officialRole === normalizedRoleCategory && official.technicalOfficialTeam) {
        const teamNum = official.technicalOfficialTeam;
        if (!teamMap.has(teamNum)) {
          teamMap.set(teamNum, []);
        }
        const fullName = official.fullName || 
          (official.firstName && official.lastName 
            ? `${official.lastName}, ${official.firstName}`
            : (official.lastName || official.firstName || 'Unknown'));
        const federation = official.federation || '';
        teamMap.get(teamNum).push({ name: fullName, federation });
      }
    });

    // For JURY role, also include JURY_PRESIDENT officials
    if (normalizedRoleCategory === 'JURY') {
      officials.forEach(official => {
        if (official.teamRole === 'JURY_PRESIDENT' && official.technicalOfficialTeam) {
          const teamNum = official.technicalOfficialTeam;
          if (!teamMap.has(teamNum)) {
            teamMap.set(teamNum, []);
          }
          const fullName = official.fullName || 
            (official.firstName && official.lastName 
              ? `${official.lastName}, ${official.firstName}`
              : (official.lastName || official.firstName || 'Unknown'));
          const federation = official.federation || '';
          // Mark as president
          teamMap.get(teamNum).unshift({ name: fullName, federation, isPresident: true });
        }
      });
    }

    // Sort team numbers and format names with federations
    return Array.from(teamMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([teamNumber, officialList]) => {
        // For jury, separate president and members
        if (normalizedRoleCategory === 'JURY') {
          const president = officialList.find(o => o.isPresident);
          const members = officialList.filter(o => !o.isPresident)
            .sort((a, b) => a.name.localeCompare(b.name));
          
          return {
            teamNumber,
            isJury: true,
            president: president ? `President: ${president.name} (${president.federation})` : null,
            members: members.length > 0 
              ? 'Members: ' + members.map(m => `${m.name} (${m.federation})`).join(', ')
              : null
          };
        } else {
          // For other roles, just list names with federations
          const sorted = officialList.sort((a, b) => a.name.localeCompare(b.name));
          return {
            teamNumber,
            displayText: sorted.map(o => `${o.name} (${o.federation})`).join('; ')
          };
        }
      });
  }
</script>

<svelte:head>
  <title>Start Book - {competitionName}</title>
  <link rel="stylesheet" href="/iwf-results-print.css" />
</svelte:head>

<!-- Running elements for header logos (positioned via CSS) -->
{#if headerLeftUrl}
  <div class="header-left-logo"><img src="{headerLeftUrl}" alt="Left logo" /></div>
{:else}
  <div class="header-left-logo"></div>
{/if}
{#if headerRightUrl}
  <div class="header-right-logo"><img src="{headerRightUrl}" alt="Right logo" /></div>
{:else}
  <div class="header-right-logo"></div>
{/if}

<!-- Running element for centered header -->
<div class="header-center">
  <div class="header-competition-name">{competitionName}</div>
  <div class="header-competition-dates">{competitionDates}</div>
</div>

<!-- Hidden elements for Paged.js string() function -->
<div style="display: none;">
  <span class="competition-name-string">{competitionName}</span>
  <span class="competition-dates-string">{competitionDates}</span>
  <span class="generation-time-string">{generationTime}</span>
  <span class="footer-info-string">{footerInfo}</span>
</div>

<div class="protocol-container">
  {#if data.status === 'waiting'}
    <div class="loading">{data.message}</div>
  {:else if !sessions || sessions.length === 0}
    <div class="no-data">{data.message || 'No session data available.'}</div>
  {:else if format === 'complete'}
    <div class="title-section">
      <TitlePage {competition} />
    </div>
    <div class="toc-section">
      <TableOfContents {sessions} {rankings} {allRecords} {hasRecords} hasTechnicalOfficials={includeOfficials && data?.technicalOfficials?.length > 0} />
    </div>
    <Participants {data} />
    {#if includeOfficials && data?.technicalOfficials && data.technicalOfficials.length > 0}
      <section class="technical-officials-section" id="technical-officials">
        <!-- Wrap header + Teams in a single no-break block -->
        <div class="officials-teams-block">
          <h2 class="section-title">Technical Officials</h2>
          
          <!-- Teams - flat listing by role and team number -->
          <div class="teams-container">
            <h3>Teams</h3>
            {#each timetableRoleInfo as roleInfo}
              {#each buildTeamListing(data.technicalOfficials, roleInfo.roleCategory) as team}
                {#if team.isJury}
                  <div class="team-entry">
                    <strong>{data.officialRoleLabels?.[roleInfo.roleCategory] || roleInfo.roleCategory} Team {team.teamNumber}:</strong>
                  </div>
                  {#if team.president}
                    <div class="team-detail-line">{team.president}</div>
                  {/if}
                  {#if team.members}
                    <div class="team-detail-line">{team.members}</div>
                  {/if}
                {:else}
                  <div class="team-entry">
                    <strong>{data.officialRoleLabels?.[roleInfo.roleCategory] || roleInfo.roleCategory} Team {team.teamNumber}:</strong>
                    <span>{team.displayText}</span>
                  </div>
                {/if}
              {/each}
            {/each}
          </div>
        </div>
        
        <!-- Time Table Matrix (roles excluding JURY_PRESIDENT) -->
        {#if timetableRows && timetableRows.length > 0}
          <div class="timetable-container">
            <h3>Time Table</h3>
            <table class="timetable-matrix">
              <colgroup>
                <col style="width: 4ch;">
                <col style="width: auto;">
                <col style="width: 12ch;">
                <col style="width: 5ch;">
                {#if showPlatformColumn}
                  <col style="width: 8ch;">
                {/if}
                {#each timetableRoleInfo as _}
                  <col style="width: 12ch;">
                {/each}
              </colgroup>
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Description</th>
                  <th>Date</th>
                  <th>Time</th>
                  {#if showPlatformColumn}
                    <th>Platform</th>
                  {/if}
                  {#each timetableRoleInfo as roleInfo}
                    <th class="role-col">{data.officialRoleLabels?.[roleInfo.roleCategory] || roleInfo.roleCategory}</th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each timetableRows as row}
                  <tr>
                    <td>{row.sessionName}</td>
                    <td>{row.description}</td>
                    <td>{row.date}</td>
                    <td>{row.time}</td>
                    {#if showPlatformColumn}
                      <td>{row.platform}</td>
                    {/if}
                    {#each timetableRoleInfo as roleInfo}
                      <td class="role-col">
                        {#if row.roles[roleInfo.roleCategory] && row.roles[roleInfo.roleCategory].length > 0}
                          {#each row.roles[roleInfo.roleCategory] as teamNumber}
                            <div class="team-number">{teamNumber}</div>
                          {/each}
                        {/if}
                      </td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </section>
    {/if}
    {#if includeCategoryParticipants}
      <CategoryParticipants {rankings} {competition} />
    {/if}
    {#if includeSessionStartLists}
      <SessionStartLists {sessions} {competition} {includeOfficials} productionTime={data.productionTime} />
    {/if}
    <Records {allRecords} {hasRecords} {newRecordsBroken} {labels} />
  {:else}
    {#if includeSessionStartLists}
      <SessionStartLists {sessions} {competition} {includeOfficials} productionTime={data.productionTime} />
    {/if}
  {/if}
</div>

<style>
  :global(body) {
    background: white;
    margin: 0;
    padding: 0;
  }

  /* Capture strings for Paged.js headers/footers */
  :global(.competition-name-string) {
    /* stylelint-disable-next-line property-no-unknown */
    string-set: competition-name content();
  }
  
  :global(.competition-dates-string) {
    /* stylelint-disable-next-line property-no-unknown */
    string-set: competition-dates content();
  }
  
  :global(.generation-time-string) {
    /* stylelint-disable-next-line property-no-unknown */
    string-set: generation-time content();
  }
  
  :global(.footer-info-string) {
    /* stylelint-disable-next-line property-no-unknown */
    string-set: footer-info content();
  }

  .protocol-container {
    background: white;
    color: black;
    padding: 0;
    font-family: Arial, sans-serif;
    font-size: 11px;
  }

  .loading, .no-data {
    padding: 20px;
    text-align: center;
    color: #666;
    font-size: 14px;
  }

  /* Technical Officials Section Styling */
  :global(.technical-officials-section) {
    margin-top: 1rem;
    padding: 1rem;
  }

  :global(.officials-teams-block) {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  :global(.section-title) {
    font-size: 14pt;
    font-weight: bold;
    border-bottom: 2px solid black;
    margin: 0 0 1rem 0;
    padding-bottom: 0.5rem;
  }

  :global(.timetable-container) {
    margin-bottom: 2rem;
    page-break-before: always;
  }

  :global(.timetable-container h3) {
    font-size: 12pt;
    margin: 0.5rem 0;
    font-weight: bold;
  }

  :global(.timetable-matrix) {
    width: 100%;
    border-collapse: collapse;
    font-size: 9pt;
    border-radius: 0;
  }

  :global(.timetable-matrix th),
  :global(.timetable-matrix td) {
    border: 1px solid black;
    padding: 4px 6px;
    text-align: left;
    vertical-align: top;
    border-radius: 0;
  }

  :global(.timetable-matrix th) {
    background-color: #f0f0f0;
    font-weight: bold;
    font-size: 7pt;
  }

  /* Role columns - centered with 12ch width */
  :global(.timetable-matrix th.role-col),
  :global(.timetable-matrix td.role-col) {
    text-align: center;
  }

  :global(.timetable-matrix td.role-col .team-number) {
    text-align: center;
  }

  :global(.official-name) {
    font-size: 8pt;
    line-height: 1.2;
    white-space: nowrap;
  }

  :global(.team-number) {
    font-size: 9pt;
    line-height: 1.2;
    font-weight: bold;
  }

  :global(.teams-container) {
    margin-top: 1rem;
  }

  :global(.teams-container h3) {
    font-size: 12pt;
    margin: 0.5rem 0;
    font-weight: bold;
  }

  :global(.team-entry) {
    font-size: 9pt;
    line-height: 1.4;
    margin: 0.3rem 0;
    padding: 0.2rem 0;
  }

  :global(.team-entry strong) {
    font-weight: bold;
    margin-right: 0.5rem;
  }

  :global(.team-entry span) {
    font-size: 9pt;
  }

  :global(.team-detail-line) {
    font-size: 9pt;
    line-height: 1.4;
    margin-left: 1.5rem;
    padding-left: 0;
  }

  /* Ensure no rounded corners anywhere */
  :global(.technical-officials-section *) {
    border-radius: 0 !important;
  }
</style>
