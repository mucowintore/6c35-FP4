<script>
  import { onMount } from 'svelte';
  import IntroOverlay from '$lib/components/IntroOverlay.svelte';
  import MapPane from '$lib/components/MapPane.svelte';
  import SidePanel from '$lib/components/SidePanel.svelte';
  import { loadTractProfileData } from '$lib/mapData';
  import {
    DEFAULT_CONTEXT,
    buildHoverContextHtml,
    buildTooltipModel,
    isLowDataTract
  } from '$lib/formatters';

  let mapPaneRef;

  let geoData = null;
  let ranges = {};
  let cityAverages = {};
  let holdingAverages = {};
  let flippingAverages = {};

  let counts = {
    holdCount: 0,
    flipCount: 0,
    mixedCount: 0,
    lowDataCount: 0
  };

  let focusMode = 'all';
  let hoveredTract = null;
  let lockedTract = null;
  let contextHtml = DEFAULT_CONTEXT;
  let isIntroHidden = false;

  let tooltip = {
    visible: false,
    x: 0,
    y: 0,
    className: '',
    html: ''
  };

  let loadError = '';

  async function loadData() {
    try {
      const loaded = await loadTractProfileData();
      counts = loaded.counts;
      ranges = loaded.ranges;
      cityAverages = loaded.cityAverages;
      holdingAverages = loaded.holdingAverages;
      flippingAverages = loaded.flippingAverages;
      geoData = loaded.geoData;
    } catch (error) {
      console.error('Could not load GeoJSON:', error);
      loadError = 'Could not load the data file. Make sure fp2_boston_tract_profiles.geojson is in the data/ folder.';
    }
  }

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

  function handleTooltipHide() {
    hideTooltip();
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

  function handleBackgroundClick() {
    clearToOverview();
    hideTooltip();
  }

  function handleReset() {
    clearToOverview();
    hideTooltip();
  }

  function setMapRoute() {
    if (typeof window === 'undefined') {
      isIntroHidden = true;
      return;
    }

    if (window.location.hash !== '#map') {
      window.location.hash = 'map';
      return;
    }

    isIntroHidden = true;
    clearToOverview();
    hideTooltip();
  }

  function syncViewFromHash() {
    if (typeof window === 'undefined') return;

    const rawHash = window.location.hash;
    if (rawHash !== '#map' && rawHash !== '#intro') {
      window.history.replaceState(null, '', '#intro');
    }

    const nextHash = window.location.hash || '#intro';
    const showMap = nextHash === '#map';

    isIntroHidden = showMap;
    clearToOverview();
    hideTooltip();

    if (!showMap) {
      mapPaneRef?.resetView();
    }
  }

  onMount(() => {
    loadData();

    syncViewFromHash();
    window.addEventListener('hashchange', syncViewFromHash);

    return () => {
      window.removeEventListener('hashchange', syncViewFromHash);
    };
  });
</script>

<IntroOverlay
  holdCount={counts.holdCount}
  flipCount={counts.flipCount}
  totalCount={180000}
  hidden={isIntroHidden}
  errorMessage={loadError}
  on:begin={setMapRoute}
/>

<div class="app-shell" class:visible={isIntroHidden} id="app-shell">
  <MapPane
    bind:this={mapPaneRef}
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
    on:background={handleBackgroundClick}
    on:reset={handleReset}
    on:tooltipShow={handleTooltipShow}
    on:tooltipMove={handleTooltipMove}
    on:tooltipHide={handleTooltipHide}
  />

  <SidePanel
    hoveredTract={lockedTract ?? hoveredTract}
    {counts}
    {ranges}
    {cityAverages}
    {holdingAverages}
    {flippingAverages}
  />

</div>
