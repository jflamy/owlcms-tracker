<script>
  import { onMount, onDestroy } from 'svelte';
  import { createTimer } from '$lib/timer-logic.js';
  import CurrentAttemptBar from '$lib/components/CurrentAttemptBar.svelte';

  export let data = {};

  const timer = createTimer();
  let timerState = { seconds: 0, isRunning: false, isWarning: false, display: '0:00' };
  const unsubscribeTimer = timer.subscribe((state) => {
    timerState = state;
  });

  onMount(() => {
    timer.start(data.timer);
  });

  onDestroy(() => {
    timer.stop();
    unsubscribeTimer();
  });

  $: if (data.timer) {
    timer.syncWithServer(data.timer);
  }

  $: teams = data.teams || [];
  $: metric = data.metric || {};
  $: totals = data.totals || {};

  function shouldRenderFlag(url) {
    if (!url) return false;
    if (typeof url === 'string' && url.startsWith('data:image/')) return false;
    return true;
  }

  function formatKg(value) {
    if (!Number.isFinite(value) || value <= 0) return '-';
    return `${Math.round(value)} kg`;
  }
</script>

<svelte:head>
  <title>{data.competition?.name || 'Team Totals'} - Team Totals</title>
</svelte:head>

<div class="scoreboard">
  {#if data.status !== 'waiting'}
    <CurrentAttemptBar
      currentAttempt={data.currentAttempt}
      timerState={timerState}
      decisionState={{}}
      scoreboardName={data.metric?.label || 'Team Totals'}
      sessionStatus={data.sessionStatus}
      competition={data.competition}
      showDecisionLights={false}
      showTimer={true}
      compactMode={true}
    />

    <section class="meta">
      <div class="meta-item">Metric: <strong>{metric.label}</strong></div>
      <div class="meta-item">Top Athletes: <strong>{metric.topN}</strong></div>
      <div class="meta-item">Gender: <strong>{metric.gender === 'MF' ? 'Women & Men' : metric.gender}</strong></div>
      <div class="meta-item">Teams: <strong>{totals.totalTeams || 0}</strong></div>
      <div class="meta-item">Athletes: <strong>{totals.totalAthletes || 0}</strong></div>
    </section>

    {#if teams.length === 0}
      <div class="waiting">
        <p>No team results available yet.</p>
      </div>
    {:else}
      <section class="teams">
        {#each teams as team}
          <article class="team-card">
            <header class="team-header">
              <div class="team-rank">#{team.rank}</div>
              <div class="team-info">
                {#if shouldRenderFlag(team.flagUrl)}
                  <img src={team.flagUrl} alt={team.teamName} class="team-flag" />
                {/if}
                <div class="team-text">
                  <div class="team-name">{team.teamName}</div>
                  <div class="team-score-label">{metric.label}: <span>{team.teamScoreDisplay}</span></div>
                  <div class="team-total">Total Lifted: <span>{formatKg(team.totalKg)}</span></div>
                </div>
              </div>
            </header>

            <div class="athlete-table" role="table">
              <div class="athlete-header" role="row">
                <div class="ath-col rank" role="columnheader">#</div>
                <div class="ath-col name" role="columnheader">Athlete</div>
                <div class="ath-col cat" role="columnheader">Cat.</div>
                <div class="ath-col lifts" role="columnheader">Snatch / CJ</div>
                <div class="ath-col total" role="columnheader">Total</div>
                <div class="ath-col score" role="columnheader">{metric.label}</div>
              </div>

              {#each team.athletes as athlete}
                <div
                  class="athlete-row"
                  class:current={athlete.classname && athlete.classname.includes('current')}
                  class:next={athlete.classname && athlete.classname.includes('next')}
                  role="row"
                >
                  <div class="ath-col rank" role="gridcell">{athlete.rank}</div>
                  <div class="ath-col name" role="gridcell">{athlete.fullName}</div>
                  <div class="ath-col cat" role="gridcell">{athlete.category || ''}</div>
                  <div class="ath-col lifts" role="gridcell">{athlete.bestSnatch || 0} / {athlete.bestCleanJerk || 0}</div>
                  <div class="ath-col total" role="gridcell">{athlete.total || '-'}</div>
                  <div class="ath-col score" role="gridcell">{athlete.scoreDisplay}</div>
                </div>
              {/each}
            </div>
          </article>
        {/each}
      </section>
    {/if}
  {:else}
    <div class="waiting">
      <p>{data.message || 'Waiting for competition data...'}</p>
    </div>
  {/if}
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
    background: #050505;
    color: #f1f5f9;
  }

  .scoreboard {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background: linear-gradient(180deg, #030712 0%, #0f172a 100%);
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    padding: 1rem 2rem;
    background: rgba(15, 23, 42, 0.85);
    border-bottom: 1px solid #1e293b;
    font-size: 1.1rem;
  }

  .meta-item strong {
    color: #38bdf8;
  }

  .teams {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(22rem, 1fr));
    gap: 1.5rem;
    padding: 1.5rem;
  }

  .team-card {
    background: rgba(15, 23, 42, 0.95);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 1rem;
    box-shadow: 0 10px 25px rgba(2, 6, 23, 0.8);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .team-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem;
    background: rgba(30, 41, 59, 0.9);
    border-bottom: 1px solid rgba(148, 163, 184, 0.15);
  }

  .team-rank {
    font-size: 2.25rem;
    font-weight: 700;
    color: #facc15;
    min-width: 3rem;
    text-align: center;
  }

  .team-info {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }

  .team-text {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .team-flag {
    width: 48px;
    height: 32px;
    object-fit: cover;
    border-radius: 4px;
    box-shadow: 0 0 8px rgba(15, 23, 42, 0.6);
  }

  .team-name {
    font-size: 1.4rem;
    font-weight: 700;
  }

  .team-score-label,
  .team-total {
    color: #e2e8f0;
    font-size: 0.95rem;
  }

  .team-score-label span,
  .team-total span {
    color: #38bdf8;
    font-weight: 600;
  }

  .athlete-table {
    display: flex;
    flex-direction: column;
    padding: 0.75rem 1rem 1rem;
    gap: 0.35rem;
  }

  .athlete-header {
    display: grid;
    grid-template-columns: 3rem 1fr 4.5rem 7rem 4.5rem 6rem;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #94a3b8;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid rgba(148, 163, 184, 0.15);
  }

  .athlete-row {
    display: grid;
    grid-template-columns: 3rem 1fr 4.5rem 7rem 4.5rem 6rem;
    align-items: center;
    gap: 0.25rem;
    padding: 0.35rem 0;
    border-bottom: 1px solid rgba(148, 163, 184, 0.08);
  }

  .athlete-row:last-of-type {
    border-bottom: none;
  }

  .ath-col.rank {
    font-weight: 600;
    color: #e2e8f0;
  }

  .ath-col.name {
    font-weight: 600;
  }

  .ath-col.total,
  .ath-col.score {
    font-weight: 700;
    color: #f8fafc;
    text-align: right;
  }

  .athlete-row.current {
    background: rgba(234, 179, 8, 0.12);
  }

  .athlete-row.next {
    background: rgba(248, 113, 113, 0.08);
  }

  .waiting {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    font-size: 1.4rem;
    color: #94a3b8;
    padding: 2rem;
  }

  @media (max-width: 900px) {
    .teams {
      grid-template-columns: 1fr;
      padding: 1rem;
    }
  }
</style>
