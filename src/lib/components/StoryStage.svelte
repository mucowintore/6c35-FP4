<script>
  /* StoryStage holds every visualization on a fixed canvas and decides
   * which one is visible based on the active section. The previous
   * version used {#key stageKey} which tore down and rebuilt the
   * chart components every time the section changed. That destroys
   * any in-flight animation, which is why the round one timed draws
   * never had a chance to actually run.
   *
   * Round two: every chart component is mounted once and stays
   * mounted. We toggle their visibility by class. Each chart receives
   * active and visible flags and decides for itself when to play the
   * draw animation. Section enters, active flips true, the chart's
   * internal observer plays its 3500 ms draw. Section leaves, active
   * flips false, the chart resets so the next entry replays. */

  import TimeSeriesChart from '$lib/components/TimeSeriesChart.svelte';
  import PriceWedgeChart from '$lib/components/PriceWedgeChart.svelte';
  import StoryMap from '$lib/components/StoryMap.svelte';
  import NeighborhoodTimeline from '$lib/components/NeighborhoodTimeline.svelte';

  export let activeSection = null;
  export let geoData = null;
  export let ranges = {};
  export let counts = {};
  export let loadError = '';

  $: viz = activeSection?.viz ?? 'timeseries';
  $: mapState = activeSection?.mapState ?? 'classified';
  $: sectionId = activeSection?.id ?? 'none';
  $: isChart = viz === 'timeseries' || viz === 'pricewedge' || viz === 'timeline';

  /* Editorial kickers, set above each chart when its section is
   * active. The kicker is the headline above the visualization. */
  const KICKERS = {
    'regime-shift': {
      text: 'Before 2008, one in six. After, one in three.',
      accent: 'var(--navy-light)'
    },
    'price-wedge': {
      text: 'In holding zones, investors overpay. In flipping zones, they bought the crisis.',
      accent: 'linear-gradient(90deg, var(--navy-light), var(--amber-mid))'
    },
    'neighborhood-trajectories': {
      text: 'How each neighborhood arrived where it is today.',
      accent: 'var(--neutral)'
    }
  };

  $: kicker = KICKERS[sectionId] || null;

  /* Per-chart active / visible flags. The chart components use these
   * to decide when to animate. */
  $: tsActive = viz === 'timeseries';
  $: pwActive = viz === 'pricewedge';
  $: tlActive = viz === 'timeline';
  $: mapActive = viz === 'map';
</script>

<div class="story-stage" class:story-stage-chart={isChart}>
  {#if loadError}
    <div class="stage-message">{loadError}</div>
  {:else}
    <!-- Section 01: investor share time series -->
    <div class="chart-stage layer" class:active={tsActive} aria-hidden={!tsActive}>
      {#if tsActive && kicker && sectionId === 'regime-shift'}
        <div class="stage-kicker">
          <span class="kicker-text">{kicker.text}</span>
          <span class="kicker-accent" style="background: {kicker.accent}"></span>
        </div>
      {/if}
      <div class="chart-body">
        <TimeSeriesChart width={680} height={420} active={tsActive} visible={tsActive} />
      </div>
    </div>

    <!-- Section 03: price wedge -->
    <div class="chart-stage layer" class:active={pwActive} aria-hidden={!pwActive}>
      {#if pwActive && kicker && sectionId === 'price-wedge'}
        <div class="stage-kicker">
          <span class="kicker-text">{kicker.text}</span>
          <span class="kicker-accent" style="background: {kicker.accent}"></span>
        </div>
      {/if}
      <div class="chart-body">
        <PriceWedgeChart width={680} height={420} active={pwActive} visible={pwActive} />
      </div>
    </div>

    <!-- Section 05: neighborhood trajectories -->
    <div class="chart-stage layer" class:active={tlActive} aria-hidden={!tlActive}>
      {#if tlActive && kicker && sectionId === 'neighborhood-trajectories'}
        <div class="stage-kicker">
          <span class="kicker-text">{kicker.text}</span>
          <span class="kicker-accent" style="background: {kicker.accent}"></span>
        </div>
      {/if}
      <div class="timeline-body">
        <NeighborhoodTimeline active={tlActive} visible={tlActive} />
      </div>
    </div>

    <!-- Sections 02, 04, 06: map -->
    <div class="map-stage layer" class:active={mapActive} aria-hidden={!mapActive}>
      <StoryMap {geoData} {ranges} {counts} {mapState} />
    </div>
  {/if}
</div>

<style>
  .story-stage {
    position: relative;
    width: 100%;
    height: min(78vh, 700px);
    min-height: 460px;
  }
  .story-stage.story-stage-chart {
    height: min(72vh, 640px);
    min-height: 440px;
  }

  /* Persistent layers, stacked. The active one fades in, the
   * inactive ones fade out. Inactive layers stay mounted so their
   * state and animations survive across section changes. */
  .layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    pointer-events: none;
    transition: opacity 380ms cubic-bezier(0.4, 0, 0.2, 1);
  }
  .layer.active {
    opacity: 1;
    pointer-events: auto;
  }

  .chart-stage {
    display: flex;
    flex-direction: column;
    justify-content: center;
    overflow: hidden;
    padding: 16px 12px 12px;
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

  .stage-kicker { margin: 0 0 14px 12px; }

  .kicker-text {
    display: block;
    color: rgba(242, 240, 234, 0.92);
    font-family: "DM Serif Display", Georgia, serif;
    font-size: 20px;
    font-weight: 400;
    line-height: 1.25;
    margin-bottom: 6px;
  }

  /* On lighter backgrounds (Section 05), the kicker takes ink color. */
  :global(.story-page:not(.bg-dark)) .kicker-text {
    color: var(--ink);
  }

  .kicker-accent {
    display: block;
    width: 40px;
    height: 2px;
    border-radius: 1px;
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

  @media (max-width: 760px) {
    .story-stage { height: 100%; min-height: 0; }
    .chart-stage { padding: 12px 6px 8px; }
    .kicker-text { font-size: 16px; }
    .stage-kicker { margin-left: 6px; }
  }
</style>
