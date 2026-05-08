<script>
  import { afterUpdate, createEventDispatcher, onDestroy } from 'svelte';
  import {
    buildOverviewSections,
    buildDetailModel,
    drawDivergingBars
  } from '$lib/panelContent';

  export let hoveredTract = null;
  export let counts = { holdCount: 0, flipCount: 0, mixedCount: 0, lowDataCount: 0 };
  export let ranges = {};
  export let cityAverages = {};

  const dispatch = createEventDispatcher();

  let panelEl;
  let overviewPanelEl;
  let barsContainer;

  let activeTract = null;
  let detail = null;
  let overviewSections = { overview: '', howToExplore: '' };
  let overviewTab = 'overview';

  let lastDrawnGeoid = null;
  let lastBoundTiles = null;

  $: overviewSections = buildOverviewSections(counts);
  $: activeTract = hoveredTract;

  $: if (activeTract) {
    detail = buildDetailModel(activeTract);
  } else {
    detail = null;
    lastDrawnGeoid = null;
  }

  /* Bind hover and focus on the overview's preview tiles. The tiles
   * are emitted as plain html by buildOverviewSections, so we have to
   * find them after each update and attach listeners imperatively. */
  function bindPreviewTiles() {
    if (!overviewPanelEl) return;
    var tiles = overviewPanelEl.querySelectorAll('[data-preview-kind]');
    if (tiles.length === 0) {
      lastBoundTiles = null;
      return;
    }
    if (lastBoundTiles && tiles.length === lastBoundTiles.length
        && Array.from(tiles).every(function (t, i) { return t === lastBoundTiles[i]; })) {
      return;
    }

    tiles.forEach(function (tile) {
      var kind = tile.getAttribute('data-preview-kind');
      var onEnter = function () { dispatch('preview', { kind: kind }); };
      var onLeave = function () { dispatch('previewClear'); };
      tile.addEventListener('mouseenter', onEnter);
      tile.addEventListener('focus', onEnter);
      tile.addEventListener('mouseleave', onLeave);
      tile.addEventListener('blur', onLeave);
    });

    lastBoundTiles = Array.from(tiles);
  }

  function handlePanelLeave() {
    dispatch('previewClear');
  }

  afterUpdate(() => {
    if (activeTract && detail && barsContainer) {
      var gid = activeTract.geoid;
      if (gid !== lastDrawnGeoid) {
        drawDivergingBars(barsContainer, activeTract, ranges, cityAverages, detail.accent);
        lastDrawnGeoid = gid;
      }
    }

    bindPreviewTiles();
  });

  onDestroy(() => {
    lastBoundTiles = null;
  });
</script>

<aside
  class="detail-panel"
  id="detail-panel"
  bind:this={panelEl}
  on:mouseleave={handlePanelLeave}>

  {#if !activeTract}
    <div class="overview-tabs">
      <button class:active={overviewTab === 'overview'} on:click={() => (overviewTab = 'overview')}>Overview</button>
      <button class:active={overviewTab === 'howToExplore'} on:click={() => (overviewTab = 'howToExplore')}>
        How to explore
      </button>
    </div>

    <div class="overview-tab-panel" bind:this={overviewPanelEl}>
      {#if overviewTab === 'overview'}
        {@html overviewSections.overview}
      {:else}
        {@html overviewSections.howToExplore}
      {/if}
    </div>
  {:else}
    <div style="display: flex; gap: 8px; margin-bottom: 8px">
      <div style="width: 4px; border-radius: 2px; background: {detail.accent}; flex-shrink: 0"></div>
      <div>
        <div class="tract-name">{detail.neighborhood}</div>
        <div class="tract-id">Census tract {activeTract.geoid}</div>
        <div class="tract-tag" style="background: {detail.tagBg}; color: {detail.accent}">{detail.tagLabel}</div>
      </div>
    </div>

    <div class="policy-box">
      <div class="policy-header">Recommended policy response</div>
      <div class="policy-name" style="color: {detail.accent}">{detail.policyName}</div>
      <div class="policy-description">{@html detail.policyDesc}</div>
    </div>

    <div class="section-heading">Tract profile vs city average</div>
    <div class="profile-chart-container" bind:this={barsContainer}></div>
    <div class="profile-caption">
      Center line is Boston. Each row shows this tract's value and its
      distance from that baseline.
    </div>
  {/if}
</aside>
