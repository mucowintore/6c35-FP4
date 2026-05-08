<script>
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import { createMapController } from '$lib/mapController';
  import { HOLD_RAMP, FLIP_RAMP } from '$lib/formatters';

  export let geoData = null;
  export let ranges = null;
  export let counts = { holdCount: 0, flipCount: 0, mixedCount: 0, lowDataCount: 0 };
  export let focusMode = 'all';
  export let contextHtml = '';
  export let tooltip = { visible: false, x: 0, y: 0, className: '', html: '' };

  /* Subset preview from the explorer side panel. The parent passes
   * 'hold', 'flip', 'mixed', or null. Anything non-null dims every
   * other tract. Independent of focusMode so previewing leaves the
   * underlying filter alone. */
  export let previewKind = null;

  const dispatch = createEventDispatcher();

  let mapCanvas;
  let mapContainer;
  let controller = null;
  let selectedNeighborhood = null;
  let zoomScale = 1;
  let nonTractClearTimer = null;

  const jumpNeighborhoods = [
    { name: 'Downtown', label: 'Downtown', color: 'var(--navy-mid)' },
    { name: 'Back Bay', label: 'Back Bay', color: 'var(--navy-mid)' },
    { name: 'South Boston Waterfront', label: 'Seaport', color: 'var(--navy-mid)' },
    { name: 'South End', label: 'South End', color: 'var(--navy-mid)' },
    { name: 'Dorchester', label: 'Dorchester', color: 'var(--amber)' },
    { name: 'East Boston', label: 'East Boston', color: 'var(--amber)' },
    { name: 'Mattapan', label: 'Mattapan', color: 'var(--amber)' },
    { name: 'Roxbury', label: 'Roxbury', color: 'var(--amber)' }
  ];

  function clearPendingNonTractTimer() {
    if (!nonTractClearTimer) return;
    clearTimeout(nonTractClearTimer);
    nonTractClearTimer = null;
  }

  function initializeController() {
    if (!mapCanvas || !geoData || !ranges?.hold_score || !ranges?.flip_score || controller) return;

    controller = createMapController({
      onHover: ({ feature, event }) => {
        clearPendingNonTractTimer();
        dispatch('hover', { feature, event });
      },
      onHoverMove: ({ feature, event }) => {
        clearPendingNonTractTimer();
        dispatch('hoverMove', { feature, event });
      },
      onFocusChange: ({ mode }) => dispatch('focusChange', { mode }),
      onHoverClear: () => dispatch('hoverClear'),
      onSelect: ({ feature }) => dispatch('select', { feature }),
      onSelectClear: () => dispatch('selectClear'),
      onTooltipShow: ({ feature, event }) => dispatch('tooltipShow', { feature, event }),
      onTooltipMove: ({ event }) => dispatch('tooltipMove', { event }),
      onTooltipHide: () => dispatch('tooltipHide'),
      onNeighborhoodChange: ({ name }) => {
        selectedNeighborhood = name;
      },
      onBackgroundClick: () => {
        dispatch('background');
      },
      onZoomChange: ({ k }) => {
        zoomScale = k;
        dispatch('zoomChange', { k });
      }
    });

    controller.init({ containerEl: mapCanvas, data: geoData, metricRanges: ranges });
    controller.setFocus(focusMode);
    if (previewKind) controller.previewSubset(previewKind);
  }

  function handleFocusChange(mode) {
    dispatch('focusChange', { mode });
  }

  function handleJump(name) {
    if (!controller) return;
    controller.jumpToNeighborhood(name);
    dispatch('jump', { name });
  }

  function handleReset() {
    if (!controller) return;
    selectedNeighborhood = null;
    controller.resetZoom();
    dispatch('reset');
  }

  export function resetView() {
    if (!controller) return;
    selectedNeighborhood = null;
    controller.resetZoom();
    dispatch('reset');
  }

  function handleResize() {
    if (!controller) return;
    selectedNeighborhood = null;
    controller.resize();
    dispatch('reset');
  }

  function handleMapContainerLeave() {
    clearPendingNonTractTimer();
    if (!controller) return;
    controller.clearHover();
  }

  function handleMapContainerMove(event) {
    if (!controller) return;

    const target = event.target;
    const overTract = target instanceof Element && Boolean(target.closest('.tract'));

    if (overTract) {
      clearPendingNonTractTimer();
      return;
    }

    if (nonTractClearTimer) return;
    nonTractClearTimer = setTimeout(() => {
      nonTractClearTimer = null;
      controller?.clearHover();
    }, 70);
  }

  onMount(() => {
    window.addEventListener('resize', handleResize);

    if (mapContainer) {
      mapContainer.addEventListener('mouseleave', handleMapContainerLeave);
      mapContainer.addEventListener('mousemove', handleMapContainerMove);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      clearPendingNonTractTimer();
      if (mapContainer) {
        mapContainer.removeEventListener('mouseleave', handleMapContainerLeave);
        mapContainer.removeEventListener('mousemove', handleMapContainerMove);
      }
    };
  });

  onDestroy(() => {
    clearPendingNonTractTimer();
    if (controller) controller.destroy();
    controller = null;
  });

  $: if (mapCanvas && geoData && ranges?.hold_score && ranges?.flip_score && !controller) {
    initializeController();
  }

  $: if (controller) {
    controller.setFocus(focusMode);
  }

  /* Forward the preview prop into the controller. Any change runs
   * one of two methods, never both, so the controller's internal
   * dim machinery handles the visual transition. */
  $: if (controller) {
    if (previewKind) {
      controller.previewSubset(previewKind);
    } else {
      controller.clearPreview();
    }
  }
</script>

<header class="site-header">
  <div class="site-title">
    Tract Policy Explorer
  </div>
  <div class="explorer-chapter-tag" aria-label="Section five of seven, Explore">
    05 &middot; Explore
  </div>
</header>

<div class="context-bar" id="context-bar">
  <span class="context-content">{@html contextHtml}</span>
</div>

<section class="map-container" bind:this={mapContainer}>
  <div id="map-canvas" bind:this={mapCanvas}></div>

  <div class="left-controls">
    <div class="jump-nav">
      <div class="jump-nav-title">Click to zoom to a neighborhood</div>
      {#each jumpNeighborhoods as neighborhood}
        <button
          class="jump-btn"
          class:active={selectedNeighborhood === neighborhood.name}
          on:click={() => handleJump(neighborhood.name)}
        >
          <span class="jump-dot" style="background: {neighborhood.color}"></span>{neighborhood.label}
        </button>
      {/each}
    </div>

    <div class="strategy-nav" class:strategy-active-hold={focusMode === 'hold'}
                              class:strategy-active-flip={focusMode === 'flip'}
                              class:strategy-active-mixed={focusMode === 'mixed'}>
      <div class="jump-nav-title">Filter by speculator strategy</div>
      <button class="jump-btn strategy-btn strategy-all" class:active={focusMode === 'all'} on:click={() => handleFocusChange('all')}>
        All tracts
      </button>
      <button class="jump-btn strategy-btn strategy-hold" class:active={focusMode === 'hold'} on:click={() => handleFocusChange('hold')}>
        Holding tracts
      </button>
      <button class="jump-btn strategy-btn strategy-flip" class:active={focusMode === 'flip'} on:click={() => handleFocusChange('flip')}>
        Flipping tracts
      </button>
      <button
        class="jump-btn strategy-btn strategy-mixed"
        class:active={focusMode === 'mixed'}
        on:click={() => handleFocusChange('mixed')}
      >
        Mixed tracts
      </button>
    </div>
  </div>

  <div class="map-legend" id="map-legend">
    <div class="legend-title">Speculator strategy</div>
    <div
      class="legend-gradient"
      style="background: linear-gradient(to right,
      {HOLD_RAMP[3]}, {HOLD_RAMP[1]}, #D4D0C6, {FLIP_RAMP[1]}, {FLIP_RAMP[3]})"
    ></div>
    <div class="legend-endpoints">
      <span style="color: var(--navy)">Holding</span>
      <span style="color: var(--amber)">Flipping</span>
    </div>
    <div class="legend-divider"></div>
    <div class="legend-item">
      <div class="legend-swatch" style="background: var(--navy)"></div>
      {counts.holdCount} holding-dominant tracts
    </div>
    <div class="legend-item">
      <div class="legend-swatch" style="background: var(--amber)"></div>
      {counts.flipCount} flipping-dominant tracts
    </div>
    <div class="legend-item">
      <div class="legend-swatch" style="background: var(--neutral)"></div>
      {counts.mixedCount} mixed (score gap &lt; 0.75 SD)
    </div>
    <div class="legend-divider"></div>
    <div class="legend-note">
      Darker shading = more intense activity.
    </div>
    <div class="legend-note">
      Areas with less than 250 recorded sales (parks, institutions, or low-activity tracts) are unshaded.
    </div>
  </div>

  <button class="reset-btn" id="reset-btn"
    style:display={(zoomScale > 1.1 || selectedNeighborhood || focusMode !== 'all') ? 'block' : 'none'}
    on:click={handleReset}>Reset view</button
  >
</section>

<div
  class="hover-tooltip {tooltip.className}"
  id="tooltip"
  style:opacity={tooltip.visible ? 1 : 0}
  style:left={tooltip.x + 'px'}
  style:top={tooltip.y + 'px'}
>
  {@html tooltip.html}
</div>
