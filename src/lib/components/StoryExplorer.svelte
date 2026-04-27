<script>
  import MapPane from '$lib/components/MapPane.svelte';
  import SidePanel from '$lib/components/SidePanel.svelte';
  import {
    DEFAULT_CONTEXT,
    buildHoverContextHtml,
    buildTooltipModel,
    isLowDataTract
  } from '$lib/formatters';

  export let geoData = null;
  export let ranges = {};
  export let counts = { holdCount: 0, flipCount: 0, mixedCount: 0, lowDataCount: 0 };
  export let cityAverages = {};
  export let holdingAverages = {};
  export let flippingAverages = {};

  let focusMode = 'all';
  let hoveredTract = null;
  let lockedTract = null;
  let contextHtml = DEFAULT_CONTEXT;

  let tooltip = {
    visible: false,
    x: 0,
    y: 0,
    className: '',
    html: ''
  };

  $: activeTract = lockedTract ?? hoveredTract;

  function clearToOverview() {
    hoveredTract = null;
    lockedTract = null;
    contextHtml = DEFAULT_CONTEXT;
  }

  function hideTooltip() {
    tooltip = { ...tooltip, visible: false };
  }

  function handleTooltipShow(event) {
    const feature = event.detail.feature;
    const props = feature.properties;
    const model = buildTooltipModel(props);
    const mouseEvent = event.detail.event;

    tooltip = {
      visible: true,
      x: mouseEvent.clientX + 14,
      y: mouseEvent.clientY - 10,
      className: model.className,
      html: model.html
    };
  }

  function handleTooltipMove(event) {
    const mouseEvent = event.detail.event;
    tooltip = {
      ...tooltip,
      x: mouseEvent.clientX + 14,
      y: mouseEvent.clientY - 10
    };
  }

  function handleHover(event) {
    const props = event.detail.feature.properties;
    if (isLowDataTract(props)) {
      hoveredTract = null;
      contextHtml = 'Insufficient data (&lt;250 sales).';
      return;
    }

    hoveredTract = props;
    contextHtml = buildHoverContextHtml(props);
  }

  function handleHoverClear() {
    hoveredTract = null;
    contextHtml = lockedTract ? buildHoverContextHtml(lockedTract) : DEFAULT_CONTEXT;
  }

  function handleSelect(event) {
    const props = event.detail.feature.properties;
    lockedTract = props;
    if (!hoveredTract) {
      contextHtml = buildHoverContextHtml(props);
    }
  }

  function handleSelectClear() {
    lockedTract = null;
    contextHtml = hoveredTract ? buildHoverContextHtml(hoveredTract) : DEFAULT_CONTEXT;
  }

  function handleReset() {
    clearToOverview();
    hideTooltip();
  }
</script>

<div class="story-explorer-app app-shell visible">
  <MapPane
    {geoData}
    {ranges}
    {counts}
    focusMode={focusMode}
    {contextHtml}
    {tooltip}
    on:focusChange={(event) => (focusMode = event.detail.mode)}
    on:hover={handleHover}
    on:hoverClear={handleHoverClear}
    on:select={handleSelect}
    on:selectClear={handleSelectClear}
    on:background={handleReset}
    on:reset={handleReset}
    on:tooltipShow={handleTooltipShow}
    on:tooltipMove={handleTooltipMove}
    on:tooltipHide={hideTooltip}
  />

  {#if activeTract}
    <SidePanel
      hoveredTract={activeTract}
      {counts}
      {ranges}
      {cityAverages}
      {holdingAverages}
      {flippingAverages}
    />
  {:else}
    <aside class="detail-panel story-explorer-intro">
      <div class="overview-title">Explore every tract</div>
      <p>
        Hover a census tract to see its investor profile. Click a tract to keep it selected while
        you compare the profile against citywide averages.
      </p>
      <div class="story-stat-grid">
        <div>
          <span style="color: var(--navy)">{counts.holdCount}</span>
          <small>holding-dominant tracts</small>
        </div>
        <div>
          <span style="color: var(--amber)">{counts.flipCount}</span>
          <small>flipping-dominant tracts</small>
        </div>
        <div>
          <span>{counts.mixedCount}</span>
          <small>mixed tracts</small>
        </div>
      </div>
      <p>
        Use the map filters to isolate holding, flipping, or mixed tracts, or jump to a
        neighborhood to inspect the local pattern.
      </p>
    </aside>
  {/if}
</div>

<style>
  .story-explorer-app {
    height: min(92vh, 860px);
    min-height: 660px;
    overflow: hidden;
    border: 1px solid var(--rule);
    border-radius: 8px;
    background: #fff;
  }

  .story-explorer-intro {
    padding: 24px 26px;
  }

  .story-explorer-intro p {
    margin: 12px 0 0;
    color: var(--sub);
    font-size: 13px;
    line-height: 1.72;
  }

  .story-stat-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
    margin: 18px 0;
  }

  .story-stat-grid div {
    padding: 12px;
    border-radius: 6px;
    background: var(--surface);
  }

  .story-stat-grid span {
    display: block;
    font-family: "IBM Plex Mono", monospace;
    font-size: 26px;
    font-weight: 500;
  }

  .story-stat-grid small {
    display: block;
    margin-top: 2px;
    color: var(--sub);
    font-size: 11px;
    line-height: 1.4;
  }

  @media (max-width: 900px) {
    .story-explorer-app {
      display: block;
      height: auto;
      min-height: 0;
    }

    .story-explorer-app :global(.site-header),
    .story-explorer-app :global(.context-bar),
    .story-explorer-app :global(.map-container),
    .story-explorer-app :global(.detail-panel) {
      grid-column: auto;
      grid-row: auto;
    }

    .story-explorer-app :global(.map-container) {
      height: 68vh;
      min-height: 440px;
    }

    .story-explorer-app :global(.detail-panel) {
      height: auto;
      max-height: none;
      border-left: 0;
      border-top: 1px solid var(--rule);
    }
  }
</style>
