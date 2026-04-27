<script>
  /* The single, persistent map for the entire narrative. Mounts once.
   * As the reader scrolls, the parent stage passes new mapState values
   * (gray, classified, holdingDimmed, fullViewAnnotated) and the map
   * controller animates the existing tracts between states. No destroy
   * and recreate. The bloom transition runs on living SVG paths.
   *
   * The map fills its container edge to edge with no border. The legend
   * floats over it as a small piece of frosted glass. */

  import { onDestroy, onMount } from 'svelte';
  import { createMapController } from '$lib/mapController';
  import { HOLD_RAMP, FLIP_RAMP } from '$lib/formatters';

  export let geoData = null;
  export let ranges = {};
  export let counts = { holdCount: 0, flipCount: 0, mixedCount: 0 };
  export let mapState = 'classified';
  export let visible = false;

  let mapCanvas;
  let controller = null;
  let resizeRaf = 0;

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

  /* Throttle to one rebuild per frame. The map redraws by clearing and
   * rebuilding tracts; without throttling, fast resizes thrash layout. */
  function handleResize() {
    if (!controller) return;
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(function () {
      controller.resize();
      controller.setPresentationState(mapState, { animate: false });
    });
  }

  onMount(() => {
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(resizeRaf);
    };
  });

  onDestroy(() => { controller?.destroy(); controller = null; });

  /* Build the controller as soon as data and DOM both exist. The null
   * guard makes this fire exactly once per page lifetime. */
  $: if (mapCanvas && geoData && ranges?.hold_score && ranges?.flip_score && !controller) {
    initializeController();
  }

  /* Push presentation state changes to the live controller. The
   * controller short-circuits no-op transitions internally so this is
   * safe to fire on every reactive tick. */
  $: if (controller && mapState) {
    controller.setPresentationState(mapState, { animate: true });
  }
</script>

<div class="story-map" class:visible>
  <div class="story-map-canvas" bind:this={mapCanvas}></div>
  <div class="story-map-legend">
    <div class="legend-title">Investor strategy</div>
    <div class="legend-gradient"
      style="background: linear-gradient(to right, {HOLD_RAMP[3]}, {HOLD_RAMP[1]}, #D4D0C6, {FLIP_RAMP[1]}, {FLIP_RAMP[3]})">
    </div>
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
  /* Full bleed: the map is the environment, not a card. No border,
   * no border-radius, no box-shadow. The radial gradient gives it
   * just enough atmospheric depth to not feel pasted on. */
  .story-map {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 420px;
    overflow: hidden;
    background: radial-gradient(ellipse at 50% 48%, #ECE9DF 0%, #DCD7CB 100%);
  }

  .story-map-canvas { width: 100%; height: 100%; }

  /* Frosted glass legend. Backdrop blur picks up just enough of the
   * underlying gradient to feel of the map, not pasted on it. */
  .story-map-legend {
    position: absolute;
    left: 18px; bottom: 18px;
    width: 216px;
    padding: 13px 15px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.62);
    backdrop-filter: blur(14px) saturate(140%);
    -webkit-backdrop-filter: blur(14px) saturate(140%);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04),
                0 8px 24px rgba(0, 0, 0, 0.06);
    border: 0.5px solid rgba(255, 255, 255, 0.6);
    font-size: 11px;
  }

  .legend-title {
    margin-bottom: 7px;
    color: var(--sub);
    font-size: 10px; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase;
  }
  .legend-gradient { height: 6px; margin-bottom: 6px; border-radius: 3px; }
  .legend-endpoints, .legend-row { display: flex; justify-content: space-between; gap: 12px; }
  .legend-endpoints { margin-bottom: 8px; font-weight: 700; }
  .legend-row { color: var(--sub); }

  @media (max-width: 760px) {
    .story-map { min-height: 320px; }
    .story-map-legend { width: 196px; left: 12px; bottom: 12px; padding: 11px 13px; }
  }
</style>
