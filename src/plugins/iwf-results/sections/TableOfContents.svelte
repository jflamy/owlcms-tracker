<script>
  export let sessions = [];
  export let rankings = [];
  export let allRecords = [];
  export let hasRecords = false;
  
  // Slugify strings for valid HTML IDs (no spaces, lowercase, URL-safe)
  function slugify(str) {
    return String(str || '')
      .replace(/>\s*(\d+)/g, '999')  // Replace >86 style weight classes with 999
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
</script>

<div class="toc-page">
  <h1>Table of Contents</h1>
  
  <div class="toc-entries">
    <!-- Participants -->
    <div class="toc-entry" style="font-weight: bold; margin-top: 8pt;">
      <span class="toc-title">Participants</span>
      <span class="toc-leader"></span>
      <span class="toc-page-number" data-ref="#participants"></span>
    </div>
    
    <!-- Medals -->
    <div class="toc-entry" style="font-weight: bold; margin-top: 8pt;">
      <span class="toc-title">Medals</span>
      <span class="toc-leader"></span>
      <span class="toc-page-number" data-ref="#medals"></span>
    </div>
    
    <!-- Team Points -->
    <div class="toc-entry" style="font-weight: bold; margin-top: 8pt;">
      <span class="toc-title">Team Points</span>
      <span class="toc-leader"></span>
      <span class="toc-page-number" data-ref="#team-points"></span>
    </div>
    
    <!-- Rankings section -->
    <div class="toc-entry" style="font-weight: bold; margin-top: 8pt;">
      <span class="toc-title">Rankings</span>
      <span class="toc-leader"></span>
      <span class="toc-page-number" data-ref="#rankings"></span>
    </div>
    
    {#each rankings as championship}
      {#each championship.genders as genderGroup}
        {#each genderGroup.categories as category}
          <div class="toc-entry" style="padding-left: 20pt; font-size: 10pt;">
            <span class="toc-title">{championship.name} - {genderGroup.genderName} - {category.categoryName}</span>
            <span class="toc-leader"></span>
            <span class="toc-page-number" data-ref="#ranking-{slugify(championship.name)}-{slugify(genderGroup.genderName)}-{slugify(category.categoryName)}"></span>
          </div>
        {/each}
      {/each}
    {/each}
    
    <!-- Session Protocols section -->
    <div class="toc-entry" style="font-weight: bold; margin-top: 8pt;">
      <span class="toc-title">Session Protocols</span>
      <span class="toc-leader"></span>
      <span class="toc-page-number" data-ref="#protocols"></span>
    </div>
    
    {#each sessions as session}
      <div class="toc-entry" style="padding-left: 20pt; font-size: 10pt;">
        <span class="toc-title">Session {session.name}: {session.description}</span>
        <span class="toc-leader"></span>
        <span class="toc-page-number" data-ref="#session-{session.name}"></span>
      </div>
    {/each}
    
    <!-- Records section -->
    {#if hasRecords}
    <div class="toc-entry" style="font-weight: bold; margin-top: 8pt;">
      <span class="toc-title">Records</span>
      <span class="toc-leader"></span>
      <span class="toc-page-number" data-ref="#records"></span>
    </div>
    
    {#each allRecords as fed}
      {#each fed.genders as genderGroup}
        {#each genderGroup.ageGroups as ageGroup}
          <div class="toc-entry" style="padding-left: 20pt; font-size: 10pt;">
            <span class="toc-title">{fed.federation} - {genderGroup.genderName} - {ageGroup.name}</span>
            <span class="toc-leader"></span>
            <span class="toc-page-number" data-ref="#records-{slugify(fed.federation)}-{slugify(genderGroup.genderName)}-{slugify(ageGroup.name)}"></span>
          </div>
        {/each}
      {/each}
    {/each}
    {/if}
  </div>
</div>

<style>
  .toc-page {
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
  }

  .toc-entry {
    display: flex;
    align-items: baseline;
    font-size: 11pt;
    margin-bottom: 4pt;
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

  /* Paged.js target-counter - use :global to bypass Svelte scoping */
  :global(.toc-page-number[data-ref])::after {
    content: target-counter(attr(data-ref url), page);
  }
</style>
