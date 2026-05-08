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

  let focusMode = 'all';
  let hoveredTract = null;
  let lockedTract = null;
  let contextHtml = DEFAULT_CONTEXT;

  /* Subset preview kind. Set when the reader hovers an overview tile.
   * Forwarded as a prop to MapPane, which translates it into a call
   * on the controller. Independent of focusMode so the preview never
   * disturbs the underlying filter state. */
  let previewKind = null;

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
    previewKind = null;
  }

  function handlePreview(event) {
    var kind = event?.detail?.kind;
    if (kind !== 'hold' && kind !== 'flip' && kind !== 'mixed') return;
    previewKind = kind;
  }

  function handlePreviewClear() {
    previewKind = null;
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
    {previewKind}
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

  <SidePanel
    hoveredTract={activeTract}
    {counts}
    {ranges}
    {cityAverages}
    on:preview={handlePreview}
    on:previewClear={handlePreviewClear}
  />
</div>

<style>
  .story-explorer-app {
    grid-template-columns: minmax(0, 1fr) minmax(320px, 24vw);
    height: min(100vh, 1000px);
    min-height: 740px;
    overflow: hidden;
    border-radius: 0;
    background: #fff;
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
