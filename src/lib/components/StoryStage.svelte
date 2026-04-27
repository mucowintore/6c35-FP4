<script>
  /* StoryStage holds all four visualization types as persistent,
   * layered components. They mount once when the page loads and stay
   * alive for the lifetime of the story. Visibility is controlled by
   * a class that toggles opacity. State changes inside each component
   * (the map shifting from gray to classified, the chart line drawing
   * as the reader scrolls) happen on living components.
   *
   * This replaces the {#key} pattern that destroyed and rebuilt
   * components on every section change. Persistence makes the bloom
   * actually transition (the gray tracts are still there to bloom
   * outward), the chart's data is loaded long before the reader
   * arrives at it, and every cross-fade between viz types is smooth
   * because both layers exist simultaneously during the fade. */

  import TimeSeriesChart from '$lib/components/TimeSeriesChart.svelte';
  import PriceWedgeChart from '$lib/components/PriceWedgeChart.svelte';
  import StoryMap from '$lib/components/StoryMap.svelte';
  import NeighborhoodTimeline from '$lib/components/NeighborhoodTimeline.svelte';

  export let activeSection = null;
  export let geoData = null;
  export let ranges = {};
  export let counts = {};
  export let loadError = '';
  export let sectionProgress = {};

  $: viz = activeSection?.viz ?? 'timeseries';
  $: sectionId = activeSection?.id ?? 'none';
  $: isMap = viz === 'map';

  /* Keep the last known map state when the active section is not a
   * map. The map sits hidden underneath in the right state, ready for
   * the next cross-fade with no jarring transition mid-fade. */
  let _mapState = 'gray';
  $: if (activeSection?.viz === 'map' && activeSection?.mapState) {
    _mapState = activeSection.mapState;
  }
  $: mapState = _mapState;

  /* Per-section scroll progress lookups. Charts hide via opacity, so
   * passing each chart its own section's progress means it stays in
   * sync even when the reader scrolls back. */
  $: regimeProgress = sectionProgress['regime-shift'] ?? 0;
  $: wedgeProgress = sectionProgress['price-wedge'] ?? 0;

  /* Section kicker: one sentence headline that introduces a viz the
   * moment it enters the stage. Lighter accents for dark backgrounds. */
  const KICKERS = {
    'regime-shift': {
      text: 'Before 2008, one in six. After, one in three.',
      accent: 'linear-gradient(90deg, #8AAEC8, #D8A45A)'
    },
    'price-wedge': {
      text: 'In holding zones, investors overpay. In flipping zones, they bought the crisis.',
      accent: 'linear-gradient(90deg, #8AAEC8, #D8A45A)'
    },
    'neighborhood-trajectories': {
      text: 'How each neighborhood arrived where it is today.',
      accent: 'var(--neutral)'
    }
  };

  $: kicker = KICKERS[sectionId] || null;
</script>

<div class="story-stage" class:story-stage-map={isMap}>
  {#if loadError}
    <div class="stage-message">{loadError}</div>
  {:else}
    <div class="viz-layer chart-layer" class:visible={viz === 'timeseries'}>
      {#if kicker && viz === 'timeseries'}
        <div class="stage-kicker">
          <span class="kicker-text">{kicker.text}</span>
          <span class="kicker-accent" style="background: {kicker.accent}"></span>
        </div>
      {/if}
      <TimeSeriesChart width={680} height={400} progress={regimeProgress} visible={viz === 'timeseries'} />
    </div>

    <div class="viz-layer chart-layer" class:visible={viz === 'pricewedge'}>
      {#if kicker && viz === 'pricewedge'}
        <div class="stage-kicker">
          <span class="kicker-text">{kicker.text}</span>
          <span class="kicker-accent" style="background: {kicker.accent}"></span>
        </div>
      {/if}
      <PriceWedgeChart width={680} height={380} progress={wedgeProgress} visible={viz === 'pricewedge'} />
    </div>

    <div class="viz-layer map-layer" class:visible={viz === 'map'}>
      <StoryMap {geoData} {ranges} {counts} {mapState} visible={viz === 'map'} />
    </div>

    <div class="viz-layer chart-layer timeline-layer" class:visible={viz === 'timeline'}>
      {#if kicker && viz === 'timeline'}
        <div class="stage-kicker">
          <span class="kicker-text">{kicker.text}</span>
          <span class="kicker-accent" style="background: {kicker.accent}"></span>
        </div>
      {/if}
      <div class="timeline-inner">
        <NeighborhoodTimeline active={viz === 'timeline'} visible={viz === 'timeline'} />
      </div>
    </div>
  {/if}
</div>

<style>
  /* Stage holds all viz layers stacked. Each layer is absolutely
   * positioned at full size. Cross-fade happens when the visible class
   * moves from one layer to another. Both layers render during the
   * 320ms transition. */
  .story-stage {
    position: relative;
    width: 100%;
    height: min(78vh, 720px);
    min-height: 480px;
  }

  /* Map sections give the map the entire stage with no internal
   * padding so it reads as the environment. */
  .story-stage.story-stage-map { padding: 0; }

  .viz-layer {
    position: absolute;
    inset: 0;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    will-change: opacity;
    transition: opacity 320ms cubic-bezier(0.4, 0, 0.2, 1),
                visibility 0s linear 320ms;
  }

  .viz-layer.visible {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    transition: opacity 320ms cubic-bezier(0.4, 0, 0.2, 1),
                visibility 0s linear 0s;
  }

  /* Chart layers get internal padding so the chart breathes. The map
   * layer has none. */
  .chart-layer {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 22px 18px 14px;
    overflow: hidden;
  }

  .timeline-layer .timeline-inner {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .map-layer {
    display: flex;
    align-items: stretch;
    justify-content: stretch;
  }

  .stage-kicker {
    margin: 0 0 16px 8px;
    max-width: 560px;
  }

  .kicker-text {
    display: block;
    color: rgba(242, 240, 234, 0.92);
    font-family: "DM Serif Display", Georgia, serif;
    font-size: 21px;
    font-weight: 400;
    line-height: 1.28;
    margin-bottom: 8px;
    letter-spacing: -0.005em;
  }

  .kicker-accent {
    display: block;
    width: 44px;
    height: 2px;
    border-radius: 1px;
    opacity: 0.7;
  }

  .stage-message {
    display: grid;
    place-items: center;
    height: 100%;
    padding: 24px;
    color: var(--sub);
    font-size: 14px;
    text-align: center;
  }

  @media (max-width: 1040px) {
    .story-stage { height: min(72vh, 640px); }
  }

  @media (max-width: 760px) {
    .story-stage { height: 100%; min-height: 0; }
    .chart-layer { padding: 14px 8px 8px; }
    .kicker-text { font-size: 17px; }
    .stage-kicker { margin-left: 4px; max-width: 100%; }
  }
</style>
