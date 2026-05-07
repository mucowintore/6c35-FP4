<script>
  import { NARRATIVE_SECTIONS, FOOTER_CONTENT } from '$lib/narrativeSections';
</script>

<div class="narrative-preview">
  {#each NARRATIVE_SECTIONS as section}
    <div class="preview-section" id={section.id}>
      <div class="preview-meta">
        {section.id} &middot; layout: {section.layout} &middot; viz: {section.viz || 'none'} &middot; map: {section.mapState || 'none'}
      </div>
      {@html section.content}
    </div>
  {/each}
  <div class="preview-section">
    <div class="preview-meta">footer</div>
    {@html FOOTER_CONTENT}
  </div>
</div>

<style>
  :global(html), :global(body) {
    overflow: auto !important;
    height: auto !important;
  }
  .narrative-preview {
    max-width: 640px;
    margin: 40px auto;
    padding: 20px;
    font-family: Plus Jakarta Sans, sans-serif;
    color: #191816;
  }
  .preview-section {
    margin-bottom: 48px;
    padding-bottom: 48px;
    border-bottom: 1px solid #D6D2C8;
  }
  .preview-meta {
    font-size: 11px;
    font-family: Plus Jakarta Sans, sans-serif;
    color: #9C9890;
    background: #F0EFEB;
    padding: 4px 10px;
    border-radius: 4px;
    margin-bottom: 16px;
    display: inline-block;
  }
  .narrative-preview :global(h1) {
    font-family: DM Serif Display, serif;
    font-size: 32px;
    line-height: 1.2;
    margin-bottom: 16px;
  }
  .narrative-preview :global(h2) {
    font-family: DM Serif Display, serif;
    font-size: 22px;
    margin-bottom: 12px;
  }
  .narrative-preview :global(p) {
    font-size: 15px;
    line-height: 1.7;
    color: #46433C;
    margin-bottom: 12px;
  }
  .narrative-preview :global(strong) {
    color: #191816;
  }
</style>
