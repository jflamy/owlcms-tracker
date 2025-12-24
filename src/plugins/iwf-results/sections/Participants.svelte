<script>
  export let data = {};
  $: athletes = data.athletes || [];
  $: sessions = data.sessions || [];
</script>

<div class="section-page" id="participants">
  <h1 class="section-title">Participants</h1>
  
  <div class="placeholder-content">
    <p><strong>Section under development</strong></p>
    <p>This section will contain:</p>
    <ul>
      <li>Complete list of participating athletes</li>
      <li>Grouped by session and category</li>
      <li>Athlete details: Name, Nation, Birth Year, Body Weight</li>
      <li>Competition numbers and lot numbers</li>
    </ul>
    
    <p class="stats">
      Total Athletes: {athletes.length || 0}<br>
      Total Sessions: {sessions.length || 0}
    </p>
  </div>
</div>

<style>
  .section-page {
    page-break-before: always;
    page-break-after: always;
    padding: 40pt 60pt;
    background: white;
  }

  .section-title {
    font-size: 20pt;
    font-weight: bold;
    margin-bottom: 20pt;
    text-align: center;
    border-bottom: 2pt solid #333;
    padding-bottom: 10pt;
  }

  .placeholder-content {
    font-size: 11pt;
    line-height: 1.6;
    color: #666;
  }

  .placeholder-content strong {
    color: #333;
    font-size: 12pt;
  }

  .placeholder-content ul {
    margin: 15pt 0;
    padding-left: 30pt;
  }

  .placeholder-content li {
    margin: 5pt 0;
  }

  .stats {
    margin-top: 20pt;
    font-weight: bold;
    color: #333;
  }
</style>
