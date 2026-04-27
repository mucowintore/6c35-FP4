<script>
  import { onDestroy, onMount } from 'svelte';
  import { createMapController } from '$lib/mapController';
  import { HOLD_RAMP, FLIP_RAMP } from '$lib/formatters';

  export let geoData = null;
  export let ranges = {};
  export let counts = { holdCount: 0, flipCount: 0, mixedCount: 0 };
  export let mapState = 'classified';

  let mapCanvas;
  let controller = null;

  function initializeController() {
    if (!mapCanvas || !geoData || !ranges?.hold_score || !ranges?.flip_score || controller) return;

    controller = createMapController();
    controller.init({
      containerEl: mapCanvas,
      data: geoData,
      metricRanges: ranges,
      interactive: false,
      initialPresentationState: mapState
    });
  }

  function handleResize() {
    controller?.resize();
    controller?.setPresentationState(mapState, { animate: false });
  }

  onMount(() => {
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  });

  onDestroy(() => {
    controller?.destroy();
    controller = null;
  });

  $: if (mapCanvas && geoData && ranges?.hold_score && ranges?.flip_score && !controller) {
    initializeController();
  }

  $: if (controller) {
    controller.setPresentationState(mapState, { animate: true });
  }
</script>

<div class="story-map">
  <div class="story-map-canvas" bind:this={mapCanvas}></div>

  <div class="story-map-legend">
    <div class="legend-title">Investor strategy</div>
    <div
      class="legend-gradient"
      style="background: linear-gradient(to right,
      {HOLD_RAMP[3]}, {HOLD_RAMP[1]}, #D4D0C6, {FLIP_RAMP[1]}, {FLIP_RAMP[3]})"
    ></div>
    <div class="legend-endpoints">
      <span style="color: var(--navy)">Holding</span>
      <span style="color: var(--amber)">Flipping</span>
    </div>
    <div class="legend-row">
      <span><b style="color: var(--navy)">{counts.holdCount}</b> holding</span>
      <span><b style="color: var(--amber)">{counts.flipCount}</b> flipping</span>
    </div>
  </div>
</div>

<style>
  .story-map {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 420px;
    overflow: hidden;
    border: 1px solid var(--rule);
    border-radius: 8px;
    /* subtle radial vignette draws the eye to the center of the geography */
    background: radial-gradient(ellipse at 50% 48%, #E8E5DC, #D8D4CA);
  }

  .story-map-canvas {
    width: 100%;
    height: 100%;
  }

  .story-map-legend {
    position: absolute;
    left: 14px;
    bottom: 14px;
    width: 210px;
    padding: 12px 14px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.94);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
    font-size: 11px;
  }

  .legend-title {
    margin-bottom: 6px;
    color: var(--sub);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .legend-gradient {
    height: 6px;
    margin-bottom: 5px;
    border-radius: 3px;
  }

  .legend-endpoints,
  .legend-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }

  .legend-endpoints {
    margin-bottom: 8px;
    font-weight: 700;
  }

  .legend-row {
    color: var(--sub);
  }

  @media (max-width: 760px) {
    .story-map {
      min-height: 320px;
      border-radius: 0;
      border-left: 0;
      border-right: 0;
    }

    .story-map-legend {
      width: 190px;
      left: 10px;
      bottom: 10px;
    }
  }
</style>
