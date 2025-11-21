<script>
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  export let data;
  
  // Store option selections per scoreboard type AND per FOP
  let scoreboardOptions = {};
  
  // Modal state
  let showModal = false;
  let modalScoreboard = null;
  let modalFop = null;
  
  // Collapse state for categories (accordion behavior - only one open at a time)
  let expandedCategory = null; // Start folded

  // Language name translations (for displaying language options)
  const languageNames = {
    'en': 'English',
    'no': 'Norsk'
  };

  function getDisplayName(option, optionKey) {
    // If this is a language option, use the language name translations
    if (optionKey === 'language' && languageNames[option]) {
      return languageNames[option];
    }
    return option;
  }
  
  // Categorize scoreboards
  $: standardScoreboards = [
    data.scoreboards.find(s => s.type === 'lifting-order'),
    data.scoreboards.find(s => s.type === 'session-results'),
    data.scoreboards.find(s => s.type === 'rankings')
  ].filter(Boolean); // Remove any undefined entries
  
  $: lowerThirdScoreboards = data.scoreboards.filter(s => 
    s.isLowerThird === true
  );

  $: documentsScoreboard = data.scoreboards.find(s => s.type === 'referee-assignments');
  
  $: teamScoreboards = data.scoreboards.filter(s => 
    s.type === 'team-scoreboard' || s.type === 'nvf-lagkonkurranse'
  ).sort((a, b) => {
    // Keep team-scoreboard first, then nvf-lagkonkurranse
    if (a.type === 'team-scoreboard') return -1;
    if (b.type === 'team-scoreboard') return 1;
    return 0;
  });
  
  // Toggle function for accordion behavior
  function toggleCategory(category) {
    expandedCategory = expandedCategory === category ? null : category;
  }
  
  // Initialize default options for each scoreboard
  $: {
    data.scoreboards.forEach(scoreboard => {
      if (!scoreboardOptions[scoreboard.type]) {
        scoreboardOptions[scoreboard.type] = {};
      }
      // Initialize defaults for each FOP
      data.fops.forEach(fop => {
        if (!scoreboardOptions[scoreboard.type][fop]) {
          scoreboardOptions[scoreboard.type][fop] = {};
          scoreboard.options.forEach(opt => {
            scoreboardOptions[scoreboard.type][fop][opt.key] = opt.default;
          });
        }
      });
    });
  }
  
  function openOptionsModal(scoreboard, fop) {
    modalScoreboard = scoreboard;
    modalFop = fop;
    showModal = true;
  }
  
  function closeModal() {
    showModal = false;
    modalScoreboard = null;
    modalFop = null;
  }
  
  function openScoreboard(type, fop, withOptions = false) {
    const options = scoreboardOptions[type]?.[fop] || {};
    const params = new URLSearchParams({ fop });
    
    // Find the scoreboard config to get default values
    const scoreboard = data.scoreboards.find(s => s.type === type);
    
    // Add configured options to URL (only if different from default)
    Object.entries(options).forEach(([key, value]) => {
      // Find the option config to get its default value
      const optionConfig = scoreboard?.options?.find(opt => opt.key === key);
      const defaultValue = optionConfig?.default;
      
      // Only include in URL if value is different from default and not empty
      if (value !== defaultValue && value !== undefined && value !== null && value !== '') {
        params.append(key, value);
      }
    });
    
    const url = `/${type}?${params.toString()}`;
    window.open(url, '_blank', 'noopener,noreferrer');

    if (withOptions) {
      closeModal();
    }
  }

  let confirmedFops = data.hasConfirmedFops ?? false;

  onMount(() => {
    if (!browser) return;
    const eventSource = new EventSource('/api/client-stream');
    const markConfirmed = () => {
      confirmedFops = true;
    };

    const handleMessage = (event) => {
      try {
        const payload = JSON.parse(event.data || '{}');
        if (payload?.type === 'state_update' && payload?.data?.fops?.length) {
          markConfirmed();
        }
      } catch (error) {
        console.warn('[Landing Page] Unable to parse SSE payload', error);
      }
    };

    eventSource.addEventListener('message', handleMessage);

    return () => {
      eventSource.removeEventListener('message', handleMessage);
      eventSource.close();
    };
  });

  function getScoreboardUrl(type, fop) {
    const options = scoreboardOptions[type]?.[fop] || {};
    const params = new URLSearchParams({ fop });
    
    // Find the scoreboard config to get default values
    const scoreboard = data.scoreboards.find(s => s.type === type);
    
    // Add configured options to URL (only if different from default)
    Object.entries(options).forEach(([key, value]) => {
      // Find the option config to get its default value
      const optionConfig = scoreboard?.options?.find(opt => opt.key === key);
      const defaultValue = optionConfig?.default;
      
      // Only include in URL if value is different from default and not empty
      if (value !== defaultValue && value !== undefined && value !== null && value !== '') {
        params.append(key, value);
      }
    });
    
    return `/${type}?${params.toString()}`;
  }
</script>

<svelte:head>
  <title>OWLCMS Tracker - {data.competitionName}</title>
</svelte:head>

<div class="container">
  <header class="header">
    <h1>🏋️ OWLCMS Tracker</h1>
  </header>

  {#if !confirmedFops}
    <div class="waiting">
      <div class="waiting-content">
        <h2>⏳ Waiting for Competition Data</h2>
        <p class="waiting-note">This page will automatically update when data arrives.</p>
      </div>
    </div>
  {/if}

    <main class="main">
      <!-- Standard Scoreboards -->
      <section class="scoreboard-category collapsible">
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
        <h2 class="category-title clickable" on:click={() => toggleCategory('standard')}>
          <span class="toggle-icon">{expandedCategory === 'standard' ? '▼' : '▶'}</span>
          Standard Scoreboards
        </h2>
        {#if expandedCategory === 'standard'}
          <div class="scoreboards-grid">
            {#each standardScoreboards as scoreboard}
              <div class="scoreboard-card">
                <h3>{scoreboard.name}</h3>
                <p class="description">{@html scoreboard.description}</p>
                
                <div class="fop-links">
                  <h4>Select Platform:</h4>
                  <div class="fop-list">
                    {#each data.fops as fop}
                      <div class="fop-row">
                        {#if confirmedFops}
                          <a 
                            href={getScoreboardUrl(scoreboard.type, fop)}
                            class="fop-link"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Platform {fop}
                          </a>
                        {:else}
                          <div class="fop-link disabled">
                            Platform {fop}
                            <span class="fop-wait">Awaiting OWLCMS connection</span>
                          </div>
                        {/if}
                          {#if scoreboard.options && scoreboard.options.length > 0}
                            {#if confirmedFops}
                            <button
                              class="options-btn"
                              on:click={() => openOptionsModal(scoreboard, fop)}
                              title="Configure options for Platform {fop}"
                            >
                              ⚙️ Options
                            </button>
                          {:else}
                            <button class="options-btn disabled" disabled title="Waiting for OWLCMS connection">
                              ⚙️ Options
                            </button>
                          {/if}
                        {/if}
                      </div>
                    {/each}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </section>

      <!-- Team Scoreboards -->
      {#if teamScoreboards.length > 0}
        <section class="scoreboard-category collapsible">
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
          <h2 class="category-title clickable" on:click={() => toggleCategory('teams')}>
            <span class="toggle-icon">{expandedCategory === 'teams' ? '▼' : '▶'}</span>
            Team Scoreboards
          </h2>
          {#if expandedCategory === 'teams'}
            <div class="scoreboards-grid">
              {#each teamScoreboards as scoreboard}
                <div class="scoreboard-card">
                  <h3>{scoreboard.name}</h3>
                  <p class="description">{@html scoreboard.description}</p>
                  
                  <div class="fop-links">
                    <h4>Select Platform:</h4>
                    <div class="fop-list">
                      {#each data.fops as fop}
                        <div class="fop-row">
                          {#if confirmedFops}
                            <a 
                              href={getScoreboardUrl(scoreboard.type, fop)}
                              class="fop-link"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Platform {fop}
                            </a>
                          {:else}
                            <div class="fop-link disabled">
                              Platform {fop}
                              <span class="fop-wait">Awaiting OWLCMS connection</span>
                            </div>
                          {/if}
                          {#if scoreboard.options && scoreboard.options.length > 0}
                            {#if confirmedFops}
                              <button
                                class="options-btn"
                                on:click={() => openOptionsModal(scoreboard, fop)}
                                title="Configure options for Platform {fop}"
                              >
                                ⚙️ Options
                              </button>
                            {:else}
                              <button class="options-btn disabled" disabled title="Waiting for OWLCMS connection">
                                ⚙️ Options
                              </button>
                            {/if}
                          {/if}
                        </div>
                      {/each}
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </section>
      {/if}



      {#if documentsScoreboard}
        <section class="scoreboard-category documents-section collapsible">
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
          <h2 class="category-title clickable" on:click={() => toggleCategory('documents')}>
            <span class="toggle-icon">{expandedCategory === 'documents' ? '▼' : '▶'}</span>
            Documents
          </h2>
          {#if expandedCategory === 'documents'}
            <div class="scoreboards-grid">
              <div class="scoreboard-card document-card">
                <h3>{documentsScoreboard.name}</h3>
                <p class="description">
                  {@html documentsScoreboard.description}
                </p>
                <div class="fop-links">
                  <h4>Document Views:</h4>
                  <div class="fop-list">
                    {#each data.fops as fop}
                      <div class="fop-row">
                        {#if confirmedFops}
                          <a 
                            href={getScoreboardUrl(documentsScoreboard.type, fop)}
                            class="fop-link"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Platform {fop}
                          </a>
                          <button
                            class="options-btn"
                            on:click={() => openOptionsModal(documentsScoreboard, fop)}
                            title="Configure document options for Platform {fop}"
                          >
                            ⚙️ Options
                          </button>
                        {:else}
                          <div class="fop-link disabled">
                            Platform {fop}
                            <span class="fop-wait">Awaiting OWLCMS connection</span>
                          </div>
                          <button class="options-btn disabled" disabled title="Waiting for OWLCMS connection">
                            ⚙️ Options
                          </button>
                        {/if}
                      </div>
                    {/each}
                  </div>
                </div>
              </div>
            </div>
          {/if}
        </section>
      {/if}

      <!-- Video Overlays -->
      {#if lowerThirdScoreboards.length > 0}
        <section class="scoreboard-category collapsible">
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
          <h2 class="category-title clickable" on:click={() => toggleCategory('video-overlays')}>
            <span class="toggle-icon">{expandedCategory === 'video-overlays' ? '▼' : '▶'}</span>
            Video Overlays
          </h2>
          {#if expandedCategory === 'video-overlays'}
            <div class="scoreboards-grid">
              {#each lowerThirdScoreboards as scoreboard}
                <div class="scoreboard-card">
                  <h3>{scoreboard.name}</h3>
                  <p class="description">{@html scoreboard.description}</p>
                  
                  <div class="fop-links">
                    <h4>Select Platform:</h4>
                    <div class="fop-list">
                      {#each data.fops as fop}
                        <div class="fop-row">
                          {#if confirmedFops}
                            <a 
                              href={getScoreboardUrl(scoreboard.type, fop)}
                              class="fop-link"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Platform {fop}
                            </a>
                          {:else}
                            <div class="fop-link disabled">
                              Platform {fop}
                              <span class="fop-wait">Awaiting OWLCMS connection</span>
                            </div>
                          {/if}
                          {#if scoreboard.options && scoreboard.options.length > 0}
                            {#if confirmedFops}
                              <button
                                class="options-btn"
                                on:click={() => openOptionsModal(scoreboard, fop)}
                                title="Configure options for Platform {fop}"
                              >
                                ⚙️
                              </button>
                            {:else}
                              <button class="options-btn disabled" disabled title="Waiting for OWLCMS connection">
                                ⚙️
                              </button>
                            {/if}
                          {/if}
                        </div>
                      {/each}
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </section>
      {/if}
    </main>
</div>

<!-- Options Modal -->
{#if showModal && modalScoreboard && modalFop}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="modal-overlay" on:click={closeModal}>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h3>{modalScoreboard.name} - Platform {modalFop}</h3>
        <button class="close-btn" on:click={closeModal}>×</button>
      </div>
      
      <div class="modal-body">
        {#if modalScoreboard.options && modalScoreboard.options.length > 0}
          <div class="options-grid">
            {#each modalScoreboard.options as option}
              <div class="option-field">
                <label for="{modalScoreboard.type}-{modalFop}-{option.key}">
                  {option.label}
                  {#if option.description}
                    <span class="option-help" title={option.description}>ⓘ</span>
                  {/if}
                </label>
                
                {#if option.type === 'select'}
                  <select 
                    id="{modalScoreboard.type}-{modalFop}-{option.key}"
                    bind:value={scoreboardOptions[modalScoreboard.type][modalFop][option.key]}
                  >
                    {#each option.options as opt}
                      <option value={opt}>{getDisplayName(opt, option.key)}</option>
                    {/each}
                  </select>
                {:else if option.type === 'boolean'}
                  <div class="checkbox-wrapper">
                    <input 
                      type="checkbox" 
                      id="{modalScoreboard.type}-{modalFop}-{option.key}"
                      bind:checked={scoreboardOptions[modalScoreboard.type][modalFop][option.key]}
                    />
                    <label for="{modalScoreboard.type}-{modalFop}-{option.key}" class="checkbox-label">
                      {scoreboardOptions[modalScoreboard.type][modalFop][option.key] ? 'Yes' : 'No'}
                    </label>
                  </div>
                {:else if option.type === 'number'}
                  <input 
                    type="number" 
                    id="{modalScoreboard.type}-{modalFop}-{option.key}"
                    bind:value={scoreboardOptions[modalScoreboard.type][modalFop][option.key]}
                    min={option.min}
                    max={option.max}
                  />
                {:else}
                  <input 
                    type="text" 
                    id="{modalScoreboard.type}-{modalFop}-{option.key}"
                    bind:value={scoreboardOptions[modalScoreboard.type][modalFop][option.key]}
                  />
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
      
      <div class="modal-footer">
        <button class="btn-secondary" on:click={closeModal}>Cancel</button>
        <button class="btn-primary" on:click={() => openScoreboard(modalScoreboard.type, modalFop, true)}>
          Open Scoreboard
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    color: #ffffff;
    min-height: 100vh;
  }
  
  .container {
    max-width: 1600px;
    margin: 0 auto;
    padding: 2rem;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  
  .header {
    text-align: center;
    margin-bottom: 3rem;
    padding: 2rem 0;
  }
  
  .header h1 {
    font-size: 3rem;
    margin: 0 0 1rem 0;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  
  .main {
    flex: 1;
  }
  
  .description {
    color: #a0aec0;
    font-size: 1.1rem;
  }
  
  .scoreboard-category {
    margin-bottom: 3rem;
  }
  
  .category-title {
    font-size: 1.8rem;
    margin-bottom: 1rem;
    color: #e2e8f0;
    padding-bottom: 0.5rem;
    border-bottom: 2px solid rgba(102, 126, 234, 0.3);
  }
  
  .category-title.clickable {
    cursor: pointer;
    user-select: none;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    transition: color 0.2s;
  }
  
  .category-title.clickable:hover {
    color: #667eea;
  }
  
  .toggle-icon {
    font-size: 1.2rem;
    transition: transform 0.3s;
  }
  
  .scoreboards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.5rem;
    margin-top: 2rem;
  }
  
  .documents-section .scoreboards-grid {
    margin-top: 1.25rem;
  }

  .scoreboard-card {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    padding: 2rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: transform 0.2s, box-shadow 0.2s;
  }
  
  .scoreboard-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.3);
    border-color: rgba(102, 126, 234, 0.5);
  }
  
  .scoreboard-card h3 {
    font-size: 1.5rem;
    margin: 0 0 0.5rem 0;
    color: #667eea;
  }
  
  .scoreboard-card .description {
    font-size: 0.95rem;
    margin-bottom: 1.5rem;
    min-height: 3em;
  }

  .document-card {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
  }
  
  .fop-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .fop-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .fop-link {
    flex: 1;
    display: block;
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 600;
    transition: transform 0.2s, box-shadow 0.2s;
    font-size: 0.95rem;
    text-align: center;
  }
  
  .fop-link:hover {
    transform: scale(1.02);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  .fop-link.disabled {
    background: rgba(255, 255, 255, 0.15);
    cursor: not-allowed;
    pointer-events: none;
    opacity: 0.65;
  }

  .fop-wait {
    display: block;
    margin-top: 0.35rem;
    font-size: 0.75rem;
    color: #cbd5e0;
    font-weight: 400;
  }
  
  .options-btn {
    width: auto;
    height: 2.5rem;
    padding: 0 1rem;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: white;
    font-size: 0.95rem;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }
  
  .options-btn:hover {
    background: rgba(102, 126, 234, 0.3);
    border-color: #667eea;
    transform: scale(1.05);
  }

  .options-btn.disabled {
    pointer-events: none;
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  /* Modal Styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
  }
  
  .modal-content {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    max-width: 500px;
    width: 90%;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    /* Ensure native form controls (selects, inputs) render in dark mode */
    color-scheme: dark;
  }
  
  .modal-header {
    padding: 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .modal-header h3 {
    margin: 0;
    color: #667eea;
    font-size: 1.3rem;
  }
  
  .close-btn {
    background: none;
    border: none;
    color: #a0aec0;
    font-size: 2rem;
    cursor: pointer;
    padding: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
  }
  
  .close-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }
  
  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }
  
  .modal-footer {
    padding: 1.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
  }
  
  .btn-primary,
  .btn-secondary {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 0.95rem;
  }
  
  .btn-primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }
  
  .btn-primary:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }
  
  .btn-secondary {
    background: rgba(255, 255, 255, 0.05);
    color: #a0aec0;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }
  
  .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }
  
  .options-grid {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .option-field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .option-field > label {
    font-size: 0.9rem;
    color: #cbd5e0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 500;
  }
  
  .option-help {
    font-size: 0.75rem;
    color: #667eea;
    cursor: help;
    font-weight: bold;
  }
  
  .option-field select,
  .option-field input[type="text"],
  .option-field input[type="number"] {
    padding: 0.75rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: white;
    font-size: 0.95rem;
  }

  /* Fix: readable dropdown list items in dark modal (Windows/Chromium/Firefox) */
  .option-field select option {
    background-color: #0f172a; /* slate-900 */
    color: #e5e7eb;            /* slate-200 */
  }
  .option-field select option:checked {
    background-color: #4f46e5; /* indigo-600 */
    color: #ffffff;
  }
  
  .option-field select:focus,
  .option-field input:focus {
    outline: none;
    border-color: #667eea;
    background: rgba(255, 255, 255, 0.1);
  }
  
  .checkbox-wrapper {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  
  .option-field input[type="checkbox"] {
    width: 1.5rem;
    height: 1.5rem;
    cursor: pointer;
  }
  
  .checkbox-label {
    font-size: 0.9rem;
    color: #a0aec0;
  }
  
  .fop-links h4 {
    font-size: 0.9rem;
    color: #a0aec0;
    margin: 0 0 0.75rem 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .waiting {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem 0;
    width: 100%;
  }
  
  .waiting-content {
    max-width: 600px;
    text-align: center;
    background: rgba(255, 255, 255, 0.05);
    padding: 3rem;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .waiting-content h2 {
    font-size: 2rem;
    margin-bottom: 1rem;
  }
  
  .waiting-note {
    margin-top: 1.5rem;
    font-size: 1.1rem;
    color: #a0aec0;
    font-style: italic;
  }
  
  @media (max-width: 768px) {
    .container {
      padding: 1rem;
    }
    .header h1 {
      font-size: 2rem;
    }
    .scoreboards-grid {
      grid-template-columns: 1fr;
    }
    .waiting-content {
      padding: 2rem 1.5rem;
    }
  }
</style>