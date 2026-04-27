<script>
  import { afterUpdate, onDestroy } from 'svelte';
  import {
    buildOverviewSections,
    buildDetailModel,
    drawDivergingBars,
    drawPairedDivergingBars,
    renderMetric,
    formatDollars,
    formatPercent,
    formatScore
  } from '$lib/panelContent';

  export let hoveredTract = null;
  export let counts = { holdCount: 0, flipCount: 0, mixedCount: 0, lowDataCount: 0 };
  export let ranges = {};
  export let cityAverages = {};
  export let holdingAverages = {};
  export let flippingAverages = {};

  let barsContainer;
  let pairedBarsContainer;

  let activeTract = null;
  let detail = null;
  let overviewSections = { overview: '', howToExplore: '', about: '' };
  let overviewTab = 'overview';

  let metricsHtml = {
    price: '', investors: '', flipRate: '',
    condos: '', multiFamily: '', nonWhite: ''
  };

  let lastDrawnGeoid = null;
  let pairedDrawn = false;

  $: overviewSections = buildOverviewSections(counts);
  $: activeTract = hoveredTract;

  $: if (activeTract) {
    detail = buildDetailModel(activeTract);
    metricsHtml = {
      price: renderMetric('Price', activeTract.median_price, 'median_price', formatDollars, detail.barColor, ranges, cityAverages),
      investors: renderMetric('Investors', activeTract.investor_share, 'investor_share', formatPercent, detail.barColor, ranges, cityAverages),
      flipRate: renderMetric('Flip rate', activeTract.flip_rate, 'flip_rate', formatPercent, detail.barColor, ranges, cityAverages),
      condos: renderMetric('Condos', activeTract.condo_share, 'condo_share', formatPercent, detail.barColor, ranges, cityAverages),
      multiFamily: renderMetric('Multi-family', activeTract.r23_share, 'r23_share', formatPercent, detail.barColor, ranges, cityAverages),
      nonWhite: renderMetric('Non-white', activeTract.pct_nonwhite, 'pct_nonwhite', formatPercent, detail.barColor, ranges, cityAverages)
    };
  } else {
    detail = null;
    lastDrawnGeoid = null;
  }

  $: if (!activeTract) {
    pairedDrawn = false;
  }

  afterUpdate(() => {
    if (activeTract && detail && barsContainer) {
      var gid = activeTract.geoid;
      if (gid !== lastDrawnGeoid) {
        drawDivergingBars(barsContainer, activeTract, ranges, cityAverages, detail.accent);
        lastDrawnGeoid = gid;
      }
    }

    if (!activeTract && overviewTab === 'overview' && pairedBarsContainer
        && holdingAverages && Object.keys(holdingAverages).length > 0 && !pairedDrawn) {
      drawPairedDivergingBars(pairedBarsContainer, holdingAverages, flippingAverages, ranges, cityAverages);
      pairedDrawn = true;
    }
  });
</script>

<aside class="detail-panel" id="detail-panel">
  {#if !activeTract}
    <div class="overview-tabs">
      <button class:active={overviewTab === 'overview'} on:click={() => { overviewTab = 'overview'; pairedDrawn = false; }}>Overview</button>
      <button class:active={overviewTab === 'howToExplore'} on:click={() => (overviewTab = 'howToExplore')}>
        How to explore
      </button>
      <button class:active={overviewTab === 'about'} on:click={() => (overviewTab = 'about')}>Methodology</button>
    </div>

    <div class="overview-tab-panel">
      {#if overviewTab === 'overview'}
        {@html overviewSections.overview}
        <div class="section-heading" style="margin-top: 16px">Citywide comparison</div>
        <div class="profile-chart-container" bind:this={pairedBarsContainer}></div>
        <div class="profile-caption">
          Average metric values for each tract type, relative to the city average (center line).
          <span style="color: var(--navy)">\u25A0</span> Holding &ensp;
          <span style="color: var(--amber)">\u25A0</span> Flipping
        </div>
      {:else if overviewTab === 'howToExplore'}
        {@html overviewSections.howToExplore}
      {:else}
        {@html overviewSections.about}
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

    <div class="tract-context">{@html detail.contextText}</div>

    <div class="section-heading">Profile vs. city average</div>
    <div class="profile-chart-container" bind:this={barsContainer}></div>
    <div class="profile-caption">
      Bar shows deviation from city average (center line).
      Right of center = above average.
    </div>

    <div class="section-heading">Intensity scores</div>
    <div class="score-row">
      <div class="score-box">
        <div class="score-label">Hold</div>
        <span class="score-number" style="color: var(--navy)">
          {formatScore(activeTract.hold_score)}
        </span>
      </div>
      <div class="score-box">
        <div class="score-label">Flip</div>
        <span class="score-number" style="color: var(--amber)">
          {formatScore(activeTract.flip_score)}
        </span>
      </div>
    </div>

    <div class="policy-box">
      <div class="policy-header">Recommended policy response</div>
      <div class="policy-name" style="color: {detail.accent}">{detail.policyName}</div>
      <div class="policy-description">{@html detail.policyDesc}</div>
    </div>
  {/if}
</aside>
