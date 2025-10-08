<script>
  import { athletes, competitionInfo } from '$lib/stores';
  import { formatResult, getRankStyle, getAthleteRank, getAthleteTotal } from './helpers.js';
  
  // For now, assume athletes have a structure based on OWLCMS JSON
  $: sortedAthletes = [...$athletes]
    .filter(a => getAthleteTotal(a) > 0)
    .sort((a, b) => getAthleteRank(a) - getAthleteRank(b));
</script>

<svelte:head>
  <title>Leaderboard - OWLCMS Tracker</title>
</svelte:head>

<div class="container">
  <header class="mb-2">
    <h1>📊 Competition Leaderboard</h1>
    {#if $competitionInfo.name}
      <p class="competition-name">{$competitionInfo.name}</p>
    {/if}
    <p>Overall rankings by total</p>
  </header>

  {#if sortedAthletes.length > 0}
    <div class="table-responsive">
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Name</th>
            <th>Team</th>
            <th>Category</th>
            <th>Snatch</th>
            <th>C&J</th>
            <th>Total</th>
            <th>Sinclair</th>
          </tr>
        </thead>
        <tbody>
          {#each sortedAthletes as athlete, index}
            <tr class={getRankStyle(index + 1)}>
              <td class="text-center">
                <strong>{index + 1}</strong>
              </td>
              <td>
                <strong>
                  {athlete.fullName || athlete.firstName + ' ' + athlete.lastName || athlete.name || 'Unknown'}
                </strong>
                <br />
                {#if athlete.startNumber}
                  <small>#{athlete.startNumber}</small>
                {/if}
              </td>
              <td>{athlete.team || athlete.teamName || '-'}</td>
              <td class="text-center">
                {athlete.category || athlete.categoryName || athlete.weightClass || '-'}
              </td>
              <td class="text-center">
                <strong>{athlete.bestSnatch || athlete.snatchTotal || '-'}</strong>
              </td>
              <td class="text-center">
                <strong>{athlete.bestCleanJerk || athlete.cleanJerkTotal || '-'}</strong>
              </td>
              <td class="text-center">
                <strong class="total">{getAthleteTotal(athlete)}</strong>
              </td>
              <td class="text-center">
                {athlete.sinclair ? (typeof athlete.sinclair === 'number' ? athlete.sinclair.toFixed(2) : athlete.sinclair) : '-'}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <div class="no-data text-center">
      <h3>No Results Yet</h3>
      <p>Competition results will appear here as athletes complete their lifts.</p>
      {#if $athletes.length > 0}
        <p class="debug">Found {$athletes.length} athletes but none have totals yet.</p>
      {:else}
        <p class="debug">No athlete data received from OWLCMS.</p>
      {/if}
    </div>
  {/if}

  <div class="mt-2">
    <a href="/">← Back to Home</a>
  </div>
</div>

<style>
  .table-responsive {
    overflow-x: auto;
  }
  
  .total {
    color: var(--primary-color);
    font-size: 1.1em;
  }
  
  .no-data {
    background: var(--surface-color);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 3rem;
    color: var(--text-secondary);
  }
  
  .competition-name {
    font-size: 1.2rem;
    color: var(--primary-color);
    margin: 0 0 0.5rem 0;
  }
  
  .debug {
    font-size: 0.9rem;
    color: var(--warning-color);
    margin-top: 1rem;
  }
  
  small {
    color: var(--text-secondary);
    font-size: 0.8em;
  }
</style>