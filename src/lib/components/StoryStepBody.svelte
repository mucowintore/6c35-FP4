<script>
  import { fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  export let html = '';
  export let animate = false;
  export let contentKey = '';
  export let inDuration = 260;
  export let outDuration = 200;
  export let inDelay = 70;

  function sectionBody(content = '') {
    return content.replace(/<h2[^>]*>[\s\S]*?<\/h2>/i, '').trim();
  }

  $: bodyHtml = sectionBody(html);
</script>

{#if animate}
  <div class="story-copy-stack">
    <div class="story-copy story-copy-measure" aria-hidden="true">
      {@html bodyHtml}
    </div>
    {#key contentKey}
      <div
        class="story-copy story-copy-fade"
        in:fade={{ duration: inDuration, delay: inDelay, easing: cubicOut }}
        out:fade={{ duration: outDuration, easing: cubicOut }}
      >
        {@html bodyHtml}
      </div>
    {/key}
  </div>
{:else}
  <div class="story-copy">
    {@html bodyHtml}
  </div>
{/if}

<style>
  .story-copy {
    max-width: 500px;
  }

  .story-copy-fade {
    position: absolute;
    inset: 0;
    will-change: opacity;
  }

  .story-copy-stack {
    position: relative;
  }

  .story-copy-measure {
    visibility: hidden;
    pointer-events: none;
    user-select: none;
  }

  .story-copy :global(p) {
    margin: 0 0 15px;
    color: var(--text);
    font-size: 15px;
    line-height: 1.78;
  }

  .story-copy :global(ul) {
    margin: 0 0 15px;
    padding: 0;
    list-style: none;
  }

  .story-copy :global(li) {
    position: relative;
    margin: 0 0 8px;
    padding-left: 16px;
    color: var(--text);
    font-size: 15px;
    line-height: 1.78;
  }

  .story-copy :global(li)::before {
    content: "\2022";
    position: absolute;
    left: 0;
    color: var(--text);
  }

  .story-copy :global(strong) {
    color: var(--ink);
    font-weight: 700;
  }
</style>
