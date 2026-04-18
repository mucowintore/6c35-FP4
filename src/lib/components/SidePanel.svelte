<script>
  import { onDestroy } from 'svelte';
  import {
    buildOverviewSections,
    buildDetailModel,
    drawRadarChart,
    renderMetric,
    formatDollars,
    formatPercent,
    formatScore
  } from '$lib/panelContent';

  export let hoveredTract = null;
  export let counts = { holdCount: 0, flipCount: 0, mixedCount: 0, lowDataCount: 0 };
  export let ranges = {};
  export let cityAverages = {};

  let radarContainer;
  let radarFrame = null;

  let activeTract = null;
  let detail = null;
  let overviewSections = { overview: '', howToExplore: '', about: '' };
  let overviewTab = 'overview';

  let metricsHtml = {
    price: '',
    investors: '',
    flipRate: '',
    condos: '',
    multiFamily: '',
    nonWhite: ''
  };

  $: overviewSections = buildOverviewSections(counts);
  $: activeTract = hoveredTract;

  $: if (activeTract) {
    detail = buildDetailModel(activeTract);

    metricsHtml = {
      price: renderMetric('Price', activeTract.median_price, 'median_price', formatDollars, detail.barColor, ranges, cityAverages),
      investors: renderMetric(
        'Investors',
        activeTract.investor_share,
        'investor_share',
        formatPercent,
        detail.barColor,
        ranges,
        cityAverages
      ),
      flipRate: renderMetric('Flip rate', activeTract.flip_rate, 'flip_rate', formatPercent, detail.barColor, ranges, cityAverages),
      condos: renderMetric('Condos', activeTract.condo_share, 'condo_share', formatPercent, detail.barColor, ranges, cityAverages),
      multiFamily: renderMetric(
        'Multi-family',
        activeTract.r23_share,
        'r23_share',
        formatPercent,
        detail.barColor,
        ranges,
        cityAverages
      ),
      nonWhite: renderMetric(
        'Non-white',
        activeTract.pct_nonwhite,
        'pct_nonwhite',
        formatPercent,
        detail.barColor,
        ranges,
        cityAverages
      )
    };
  }

  $: if (activeTract && detail && radarContainer) {
    if (radarFrame) cancelAnimationFrame(radarFrame);

    const tract = activeTract;
    const accent = detail.accent;

    radarFrame = requestAnimationFrame(() => {
      radarFrame = null;
      if (!radarContainer || !activeTract || activeTract.geoid !== tract.geoid) return;
      drawRadarChart(radarContainer, tract, ranges, cityAverages, accent);
    });
  }

  $: if (!activeTract && radarContainer) {
    if (radarFrame) {
      cancelAnimationFrame(radarFrame);
      radarFrame = null;
    }
    radarContainer.innerHTML = '';
  }

  onDestroy(() => {
    if (radarFrame) cancelAnimationFrame(radarFrame);
    radarFrame = null;
  });
</script>

<aside class="detail-panel" id="detail-panel">
  {#if !activeTract}
    <div class="overview-tabs">
      <button class:active={overviewTab === 'overview'} on:click={() => (overviewTab = 'overview')}>Overview</button>
      <button class:active={overviewTab === 'howToExplore'} on:click={() => (overviewTab = 'howToExplore')}>
        How to explore
      </button>
      <button class:active={overviewTab === 'about'} on:click={() => (overviewTab = 'about')}>Methodology</button>
    </div>

    <div class="overview-tab-panel">
      {#if overviewTab === 'overview'}
        {@html overviewSections.overview}
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
    <div class="radar-container" bind:this={radarContainer}></div>
    <div class="radar-caption">
      Solid shape = this tract. Dashed outline = city average.
      Each axis is normalized to the range across all 173 tracts.
    </div>

    <div class="section-heading">Key metrics</div>
    <div class="metric-grid">
      {@html metricsHtml.price}
      {@html metricsHtml.investors}
      {@html metricsHtml.flipRate}
      {@html metricsHtml.condos}
      {@html metricsHtml.multiFamily}
      {@html metricsHtml.nonWhite}
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
