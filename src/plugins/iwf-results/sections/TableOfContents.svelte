<script>
  export let sessions = [];
</script>

<div class="toc-page">
  <h1>Table of Contents</h1>
  
  <div class="toc-entries">
    <div class="toc-entry">
      <span class="toc-title">Participants</span>
      <span class="toc-leader"></span>
      <span class="toc-page-number" data-ref="#participants"></span>
    </div>
    
    <div class="toc-entry">
      <span class="toc-title">Medals</span>
      <span class="toc-leader"></span>
      <span class="toc-page-number" data-ref="#medals"></span>
    </div>
    
    <div class="toc-entry">
      <span class="toc-title">Rankings</span>
      <span class="toc-leader"></span>
      <span class="toc-page-number" data-ref="#rankings"></span>
    </div>
    
    <div class="toc-entry toc-section">
      <span class="toc-title">Session Protocols</span>
      <span class="toc-leader"></span>
      <span class="toc-page-number" data-ref="#protocols"></span>
    </div>
    
    {#each sessions as session}
      <div class="toc-entry toc-subsection">
        <span class="toc-title">Session {session.name}: {session.description}</span>
        <span class="toc-leader"></span>
        <span class="toc-page-number" data-ref="#session-{session.name}"></span>
      </div>
    {/each}
    
    <div class="toc-entry">
      <span class="toc-title">Records</span>
      <span class="toc-leader"></span>
      <span class="toc-page-number" data-ref="#records"></span>
    </div>
  </div>
</div>

<style>
  .toc-page {
    page-break-after: always;
    padding: 40pt 60pt;
    background: white;
  }

  h1 {
    font-size: 24pt;
    font-weight: bold;
    margin-bottom: 30pt;
    text-align: center;
  }

  .toc-entries {
    display: flex;
    flex-direction: column;
    gap: 8pt;
  }

  .toc-entry {
    display: flex;
    align-items: baseline;
    font-size: 11pt;
  }

  .toc-section {
    font-weight: bold;
    margin-top: 10pt;
  }

  .toc-subsection {
    padding-left: 20pt;
    font-size: 10pt;
  }

  .toc-title {
    flex-shrink: 0;
  }

  .toc-leader {
    flex-grow: 1;
    border-bottom: 1pt dotted #999;
    margin: 0 8pt;
    min-width: 20pt;
  }

  .toc-page-number {
    flex-shrink: 0;
    min-width: 30pt;
    text-align: right;
  }

  /* Paged.js will populate these via content */
  .toc-page-number[data-ref]::after {
    content: target-counter(attr(data-ref, url), page);
  }
</style>
