<script>
  export let data = {};
  export let timetableRoleInfo = [];
  export let timetableRows = [];
  export let showPlatformColumn = false;

  // Debug: log what we receive
  $: console.log('[TechnicalOfficials] data.technicalOfficials:', data?.technicalOfficials?.length, 'timetableRoleInfo:', timetableRoleInfo?.length);

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

{#if data?.technicalOfficials && data.technicalOfficials.length > 0}
<section class="technical-officials-section" id="technical-officials">
  <!-- Wrap header + Teams in a single no-break block -->
  <div class="officials-teams-block">
    <h1 class="section-header">Technical Officials</h1>

    <!-- Teams - flat listing by role and team number -->
    <div class="teams-container">
      <h3>Teams</h3>
      {#each timetableRoleInfo as roleInfo}
        {#each buildTeamListing(data.technicalOfficials, roleInfo.roleCategory) as team, teamIndex}
          {#if team.isJury}
            <div class="team-entry" class:first-in-kind={true}>
              <strong>{data.officialRoleLabels?.[roleInfo.roleCategory] || roleInfo.roleCategory} Team {team.teamNumber}:</strong>
            </div>
            {#if team.president}
              <div class="team-detail-line">{team.president}</div>
            {/if}
            {#if team.members}
              <div class="team-detail-line">{team.members}</div>
            {/if}
          {:else}
            <div class="team-entry" class:first-in-kind={teamIndex === 0}>
              <strong>{data.officialRoleLabels?.[roleInfo.roleCategory] || roleInfo.roleCategory} Team {team.teamNumber}:</strong>
              <span>{team.displayText}</span>
            </div>
          {/if}
        {/each}
      {/each}
    </div>
  </div>
</section>
{/if}

<style>
  .technical-officials-section {
    margin-top: 1rem;
    padding: 1rem;
  }

  .section-header {
    font-size: 20pt;
    font-weight: bold;
    text-align: center;
    margin: 30pt 0 20pt 0;
    page-break-before: always;
    break-before: always;
    border-bottom: 2px solid #333;
    padding-bottom: 10pt;
    width: 100%;
  }

  .teams-container {
    margin-top: 1rem;
  }

  .teams-container h3 {
    font-size: 12pt;
    margin: 0.5rem 0;
    font-weight: bold;
  }

  .team-entry {
    font-size: 9pt;
    line-height: 1.3;
    margin: 0;
    padding: 0.1rem 0;
  }

  .team-entry.first-in-kind {
    margin-top: 0.8rem;
  }

  .team-entry strong {
    font-weight: bold;
    margin-right: 0.5rem;
  }

  .team-entry span {
    font-size: 9pt;
  }

  .team-detail-line {
    font-size: 9pt;
    line-height: 1.3;
    margin-left: 1.5rem;
    padding-left: 0;
    margin-top: 0.05rem;
  }

  /* Ensure no rounded corners anywhere */
  .technical-officials-section * {
    border-radius: 0 !important;
  }
</style>
