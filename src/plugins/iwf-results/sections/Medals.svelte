<script>
  export let data = {};
  const _keepDataProp = data;
</script>

<div class="section-page" id="medals">
  <h1 class="section-title">Medals</h1>
  
  <div class="placeholder-content">
    <p><strong>Section under development</strong></p>
    <p>This section will contain:</p>
    <ul>
      <li>Medal standings by nation</li>
      <li>Gold, Silver, Bronze counts</li>
      <li>Medal winners by category</li>
      <li>Podium results for each weight class</li>
    </ul>
  </div>
</div>

<style>
  .section-page {
    page-break-before: always;
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
</style>
