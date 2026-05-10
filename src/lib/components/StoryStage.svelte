<script>
  /* StoryStage holds every visualization on a fixed canvas and toggles
   * which one is on top based on the active section.
   *
   * Each visualization sits as a persistent layer. Layers do not
   * unmount when the reader scrolls between sections. They fade in
   * and out via opacity, with a directional gradient mask so the
   * incoming layer wipes from one edge while the outgoing layer
   * recedes from the opposite. The mask is decorative; if a browser
   * does not support it the layers cross-fade evenly.
   *
   * Each layer carries its own IntersectionObserver. Charts animate
   * only when the layer is conceptually active AND visibly on screen,
   * which prevents the cold-load case where a chart silently runs
   * its draw before the reader has scrolled past the opening. */

  import { onMount, onDestroy } from 'svelte';
  import TimeSeriesChart from '$lib/components/TimeSeriesChart.svelte';
  import PriceWedgeChart from '$lib/components/PriceWedgeChart.svelte';
  import StoryMap from '$lib/components/StoryMap.svelte';
  import NeighborhoodTimeline from '$lib/components/NeighborhoodTimeline.svelte';
  import NeighborhoodLeaderboard from '$lib/components/NeighborhoodLeaderboard.svelte';

  export let activeSection = null;
  export let geoData = null;
  export let ranges = {};
  export let counts = {};
  export let loadError = '';

  $: viz = activeSection?.viz ?? null;
  let mapState = 'gray';
  $: if (activeSection?.mapState) {
    mapState = activeSection.mapState;
  }
  $: sectionId = activeSection?.id ?? 'none';
  $: useCompactChartFrame = viz === 'timeseries';

  /* Per-layer "is this section the active one" flags. */
  $: tsActive = viz === 'timeseries';
  $: pwActive = viz === 'pricewedge';
  $: tlActive = viz === 'timeline';
  $: mapActive = viz === 'map';
  $: lbActive = viz === 'leaderboard';

  /* Per-layer "is the layer's DOM actually on screen" flags. The
   * combination of active and inViewport is what unlocks the chart
   * draw animation. */
  let tsLayerEl, pwLayerEl, tlLayerEl, mapLayerEl, lbLayerEl;
  let tsInViewport = false;
  let pwInViewport = false;
  let tlInViewport = false;
  let mapInViewport = false;

  /* Bloom caption visibility. Set to true 250 ms after the radial
   * bloom completes; cleared when the reader leaves the map's
   * classified state. */
  let bloomCaptionVisible = false;
  let bloomCaptionTimer = null;

  let observer = null;

  function setupObserver() {
    if (typeof IntersectionObserver === 'undefined') return;
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          var t = entry.target;
          var on = entry.isIntersecting && entry.intersectionRatio >= 0.4;
          if (t === tsLayerEl) tsInViewport = on;
          else if (t === pwLayerEl) pwInViewport = on;
          else if (t === tlLayerEl) tlInViewport = on;
          else if (t === mapLayerEl) mapInViewport = on;
        });
      },
      { threshold: [0, 0.4, 0.8] }
    );
    if (tsLayerEl) observer.observe(tsLayerEl);
    if (pwLayerEl) observer.observe(pwLayerEl);
    if (tlLayerEl) observer.observe(tlLayerEl);
    if (mapLayerEl) observer.observe(mapLayerEl);
    if (lbLayerEl) observer.observe(lbLayerEl);
  }

  onMount(() => {
    setupObserver();
  });

  onDestroy(() => {
    if (observer) observer.disconnect();
    observer = null;
    if (bloomCaptionTimer) {
      clearTimeout(bloomCaptionTimer);
      bloomCaptionTimer = null;
    }
  });

  /* Bloom caption is keyed to the classified state being current
   * AND the reader being on the map layer. When the reader leaves
   * either, the caption fades and the timer is cancelled. */
  $: if (sectionId === 'map-intro' && mapInViewport) {
    if (bloomCaptionTimer) clearTimeout(bloomCaptionTimer);
    bloomCaptionTimer = setTimeout(() => {
      bloomCaptionVisible = true;
      bloomCaptionTimer = null;
    }, 2400);
  }

  $: if (sectionId !== 'map-intro' || !mapInViewport) {
    if (bloomCaptionTimer) {
      clearTimeout(bloomCaptionTimer);
      bloomCaptionTimer = null;
    }
    bloomCaptionVisible = false;
  }
</script>

<div class="story-stage" class:story-stage-chart={useCompactChartFrame}>
  {#if loadError}
    <div class="stage-message">{loadError}</div>
  {:else}
    <div class="chart-stage ts-stage layer layer-from-right"
         class:active={tsActive}
         aria-hidden={!tsActive}
         bind:this={tsLayerEl}>
      <div class="chart-body">
        <TimeSeriesChart width={680} height={620}
                         active={tsActive}
                         inViewport={tsInViewport}
                         visible={tsActive} />
      </div>
    </div>

    <div class="chart-stage pw-stage layer layer-from-left"
         class:pricewedge-titled={sectionId === 'price-wedge'}
         class:active={pwActive}
         aria-hidden={!pwActive}
         bind:this={pwLayerEl}>
      {#if sectionId === 'price-wedge'}
        <div class="stage-title-block" aria-hidden="true">
          <p class="stage-title">Investor Price Premium by Strategy</p>
          <p class="stage-subtitle">Holding and flipping tracts, 2000 to 2022</p>
        </div>
      {/if}
      <div class="chart-body">
        <PriceWedgeChart width={680} height={420}
                         active={pwActive}
                         inViewport={pwInViewport}
                         visible={pwActive} />
      </div>
    </div>

    <div class="chart-stage timeline-stage layer layer-from-right"
         class:active={tlActive}
         aria-hidden={!tlActive}
         bind:this={tlLayerEl}>
      <div class="timeline-body">
        <NeighborhoodTimeline active={tlActive}
                              inViewport={tlInViewport}
                              visible={tlActive} />
      </div>
    </div>

    <div class="map-stage layer"
         class:active={mapActive}
         aria-hidden={!mapActive}
         bind:this={mapLayerEl}>
      <StoryMap {geoData} {ranges} {counts} {mapState} />

      <div class="bloom-caption"
           class:visible={bloomCaptionVisible}
           aria-hidden={!bloomCaptionVisible}>
        173 tracts  ·  Two strategies
      </div>
    </div>

    <div class="leaderboard-stage layer layer-from-left"
         class:active={lbActive}
         aria-hidden={!lbActive}
         bind:this={lbLayerEl}>
      <NeighborhoodLeaderboard {geoData} />
    </div>
  {/if}
</div>

<style>
  .story-stage {
    position: relative;
    width: 100%;
    height: min(84vh, 760px);
    min-height: 500px;
  }
  .story-stage.story-stage-chart {
    height: min(88vh, 860px);
    min-height: 620px;
  }

  /* Persistent stacked layers. Active fades in, others fade out.
   * Inactive layers stay mounted so their internal state survives
   * a return visit. */
    .layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    pointer-events: none;
    transition: opacity 420ms cubic-bezier(0.4, 0, 0.2, 1);
  }
  .layer.active {
    opacity: 1;
    pointer-events: auto;
  }
  .layer-from-left {
    -webkit-mask-image: linear-gradient(to right, #000 60%, transparent 100%);
            mask-image: linear-gradient(to right, #000 60%, transparent 100%);
    -webkit-mask-size: 220% 100%;
            mask-size: 220% 100%;
    -webkit-mask-position: -100% 0;
            mask-position: -100% 0;
    -webkit-mask-repeat: no-repeat;
            mask-repeat: no-repeat;
  }
  .layer-from-left.active {
    -webkit-mask-position: 0% 0;
            mask-position: 0% 0;
  }

  .chart-stage {
    display: flex;
    flex-direction: column;
    justify-content: center;
    overflow: hidden;
    padding: 16px 12px 12px;
  }
  .ts-stage {
    padding: 8px 10px 6px;
  }
  .pw-stage {
    overflow: visible;
    -webkit-mask-image: none;
            mask-image: none;
    -webkit-mask-size: auto;
            mask-size: auto;
    -webkit-mask-position: 0 0;
            mask-position: 0 0;
  }
  .pw-stage .chart-body {
    overflow: visible;
  }
  .pw-stage.pricewedge-titled {
    justify-content: center;
    padding-top: 0;
  }
  .pw-stage.pricewedge-titled .stage-title-block {
    position: relative;
    top: auto;
    left: auto;
    margin: 0 0 8px 14px;
    max-width: min(520px, calc(100% - 24px));
  }
  .pw-stage.pricewedge-titled .chart-body {
    flex: 0 0 auto;
    min-height: auto;
    width: 100%;
    align-items: flex-start;
    justify-content: flex-start;
  }

  .chart-body {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .chart-body :global(svg) {
    width: 100%;
    height: auto;
    max-height: 100%;
  }

  .timeline-body {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  .timeline-stage {
    padding-left: 6px;
    padding-right: 4px;
  }
  .leaderboard-stage {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px 8px;
    -webkit-mask-image: none;
            mask-image: none;
    -webkit-mask-size: auto;
            mask-size: auto;
    -webkit-mask-position: 0 0;
            mask-position: 0 0;
  }

  .stage-message {
    display: grid;
    height: 100%;
    place-items: center;
    padding: 24px;
    color: var(--sub);
    font-size: 14px;
    text-align: center;
  }

  /* Bloom caption. Sits in the top-right of the map layer, fades in
   * after the radial color spread completes. Mono caps, low opacity,
   * letter-spaced. The screenshot moment for Section 02. */
  .bloom-caption {
    position: absolute;
    top: clamp(14px, 2.4vh, 22px);
    left: clamp(16px, 2.4vw, 28px);
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(25, 24, 22, 0.55);
    opacity: 0;
    transform: translateY(-2px);
    transition: opacity 420ms cubic-bezier(0.4, 0, 0.2, 1),
                transform 420ms cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: none;
  }
  .bloom-caption.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .stage-title-block {
    position: absolute;
    top: 24px;
    left: 14px;
    z-index: 4;
    pointer-events: none;
    max-width: min(520px, calc(100% - 28px));
  }
  .stage-title {
    margin: 0;
    font-family: "DM Serif Display", Georgia, serif;
    font-size: 20px;
    font-weight: 400;
    line-height: 1.06;
    color: #191816;
    letter-spacing: -0.01em;
  }
  .stage-subtitle {
    margin: 4px 0 0;
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: 10.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(70, 67, 60, 0.85);
    line-height: 1.3;
  }

  @media (max-width: 760px) {
    .story-stage { height: 100%; min-height: 0; }
    .chart-stage { padding: 12px 6px 8px; }
    .bloom-caption { font-size: 9.5px; }
    .stage-title-block {
      top: 8px;
      left: 8px;
    }
    .stage-title { font-size: 18px; }
    .stage-subtitle { font-size: 9px; }
    .pw-stage.pricewedge-titled {
      padding-top: 0;
    }
    .pw-stage.pricewedge-titled .stage-title-block {
      margin-left: 8px;
      margin-bottom: 6px;
      max-width: calc(100% - 16px);
    }
  }

</style>
