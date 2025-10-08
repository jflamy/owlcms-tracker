<script>
  export let data;
  
  function getScoreboardUrl(type, fop) {
    return `/${type}?fop=${fop}`;
  }
</script>

<svelte:head>
  <title>OWLCMS Tracker - {data.competitionName}</title>
</svelte:head>

<div class="container">
  <header class="header">
    <h1>🏋️ OWLCMS Tracker</h1>
    <p class="competition-name">{data.competitionName}</p>
  </header>

  {#if data.hasData}
    <main class="main">
      <section class="info-section">
        <h2>📊 Available Scoreboards</h2>
        <p class="description">
          {data.scoreboards.length} scoreboard type{data.scoreboards.length !== 1 ? 's' : ''} available
          across {data.fops.length} Platform{data.fops.length !== 1 ? 's' : ''}
        </p>
      </section>

      <section class="scoreboards-grid">
        {#each data.scoreboards as scoreboard}
          <div class="scoreboard-card">
            <h3>{scoreboard.name}</h3>
            <p class="description">{scoreboard.description}</p>
            
            <div class="fop-links">
              <h4>Select Platform:</h4>
              <div class="links">
                {#each data.fops as fop}
                  <a 
                    href={getScoreboardUrl(scoreboard.type, fop)}
                    class="fop-link"
                  >
                    Platform {fop}
                  </a>
                {/each}
              </div>
            </div>
          </div>
        {/each}
      </section>
    </main>
  {:else}
    <div class="waiting">
      <div class="waiting-content">
        <h2>⏳ Waiting for Competition Data</h2>
        <p>No competition data received yet.</p>
        
        <div class="config-help">
          <h3>Configure OWLCMS:</h3>
          <ol>
            <li>Go to <strong>Prepare Competition → Language and System Settings → Connections</strong></li>
            <li>Set <strong>URL for Video Data</strong> to: <code>http://localhost:8095</code></li>
            <li>Start your competition session</li>
          </ol>
        </div>
        
        <p class="note">This page will automatically update when data arrives.</p>
      </div>
    </div>
  {/if}

  <footer class="footer">
    <div class="footer-links">
      <a href="https://github.com/owlcms/owlcms4" target="_blank" class="footer-link">OWLCMS</a>
    </div>
  </footer>
</div>

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
    max-width: 1200px;
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
    border-bottom: 2px solid rgba(255, 255, 255, 0.1);
  }
  
  .header h1 {
    font-size: 3rem;
    margin: 0 0 1rem 0;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  
  .competition-name {
    font-size: 1.5rem;
    color: #a0aec0;
    margin: 0;
  }
  
  .main {
    flex: 1;
  }
  
  .info-section {
    text-align: center;
    margin-bottom: 2rem;
  }
  
  .info-section h2 {
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }
  
  .description {
    color: #a0aec0;
    font-size: 1.1rem;
  }
  
  .scoreboards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 2rem;
    margin-top: 2rem;
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
  
  .fop-links h4 {
    font-size: 0.9rem;
    color: #a0aec0;
    margin: 0 0 0.75rem 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .links {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  
  .fop-link {
    display: inline-block;
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 600;
    transition: transform 0.2s, box-shadow 0.2s;
    font-size: 0.95rem;
  }
  
  .fop-link:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }
  
  .waiting {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
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
  
  .config-help {
    margin: 2rem 0;
    padding: 1.5rem;
    background: rgba(102, 126, 234, 0.1);
    border-radius: 8px;
    border: 1px solid rgba(102, 126, 234, 0.3);
  }
  
  .config-help h3 {
    margin: 0 0 1rem 0;
    color: #667eea;
  }
  
  .config-help ol {
    text-align: left;
    margin: 0;
    padding-left: 1.5rem;
  }
  
  .config-help li {
    margin: 0.75rem 0;
    line-height: 1.6;
  }
  
  .config-help code {
    background: rgba(0, 0, 0, 0.3);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-family: 'Courier New', monospace;
    color: #667eea;
  }
  
  .note {
    margin-top: 1.5rem;
    font-size: 0.9rem;
    color: #a0aec0;
    font-style: italic;
  }
  
  .footer {
    margin-top: 4rem;
    padding-top: 2rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    text-align: center;
  }
  
  .footer-links {
    display: flex;
    justify-content: center;
    gap: 2rem;
  }
  
  .footer-link {
    color: #a0aec0;
    text-decoration: none;
    transition: color 0.2s;
  }
  
  .footer-link:hover {
    color: #667eea;
  }
  
  @media (max-width: 768px) {
    .container {
      padding: 1rem;
    }
    .header h1 {
      font-size: 2rem;
    }
    .competition-name {
      font-size: 1.2rem;
    }
    .scoreboards-grid {
      grid-template-columns: 1fr;
    }
    .waiting-content {
      padding: 2rem 1.5rem;
    }
  }
</style>