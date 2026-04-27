<script>
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
  $: stageKey = viz + '-' + mapState + '-' + sectionId;
  $: isChart = viz === 'timeseries' || viz === 'pricewedge' || viz === 'timeline';

  const KICKERS = {
    'regime-shift': {
      text: 'Before 2008, one in six. After, one in three.',
      accent: 'var(--navy)'
    },
    'price-wedge': {
      text: 'In holding zones, investors overpay. In flipping zones, they bought the crisis.',
      accent: 'linear-gradient(90deg, var(--navy), var(--amber))'
    },
    'neighborhood-trajectories': {
      text: 'How each neighborhood arrived where it is today.',
      accent: 'var(--neutral)'
    }
  };

  $: kicker = KICKERS[sectionId] || null;
</script>

<div class="story-stage" class:story-stage-chart={isChart}>
  {#if loadError}
    <div class="stage-message">{loadError}</div>
  {:else}
    {#key stageKey}
      {#if viz === 'timeseries'}
        <div class="chart-stage entrance">
          {#if kicker}
            <div class="stage-kicker">
              <span class="kicker-text">{kicker.text}</span>
              <span class="kicker-accent" style="background: {kicker.accent}"></span>
            </div>
          {/if}
          <TimeSeriesChart width={640} height={400} active={true} />
        </div>
      {:else if viz === 'pricewedge'}
        <div class="chart-stage entrance">
          {#if kicker}
            <div class="stage-kicker">
              <span class="kicker-text">{kicker.text}</span>
              <span class="kicker-accent" style="background: {kicker.accent}"></span>
            </div>
          {/if}
          <PriceWedgeChart width={620} height={370} active={true} />
        </div>
      {:else if viz === 'timeline'}
        <div class="chart-stage entrance">
          {#if kicker}
            <div class="stage-kicker">
              <span class="kicker-text">{kicker.text}</span>
              <span class="kicker-accent" style="background: {kicker.accent}"></span>
            </div>
          {/if}
          <div class="timeline-inner">
            <NeighborhoodTimeline active={true} />
          </div>
        </div>
      {:else if viz === 'map'}
        <div class="map-stage entrance">
          <StoryMap {geoData} {ranges} {counts} {mapState} />
        </div>
      {:else}
        <div class="stage-message">Keep scrolling to explore every tract.</div>
      {/if}
    {/key}
  {/if}
</div>

<style>
  .story-stage { width: 100%; height: min(78vh, 700px); min-height: 460px; }
  .story-stage.story-stage-chart { height: min(68vh, 600px); min-height: 400px; }
  .chart-stage, .map-stage { width: 100%; height: 100%; }

  .chart-stage {
    display: flex; flex-direction: column; justify-content: center;
    overflow: hidden; padding: 16px 12px 12px;
  }

  .chart-stage :global(svg) { width: 100%; height: auto; max-height: calc(100% - 48px); }
  .timeline-inner { flex: 1; min-height: 0; overflow: hidden; }

  .stage-kicker { margin: 0 0 14px 12px; }

  .kicker-text {
    display: block; color: var(--ink);
    font-family: "DM Serif Display", Georgia, serif;
    font-size: 20px; font-weight: 400; line-height: 1.25;
    margin-bottom: 6px;
  }

  .kicker-accent { display: block; width: 40px; height: 2px; border-radius: 1px; }

  .stage-message {
    display: grid; height: 100%; place-items: center;
    padding: 24px; color: var(--sub); font-size: 14px; text-align: center;
  }

  .entrance { animation: stage-entrance 800ms cubic-bezier(0.16, 1, 0.3, 1); }

  @keyframes stage-entrance {
    from { opacity: 0; transform: scale(0.97); }
    to { opacity: 1; transform: scale(1); }
  }

  @media (max-width: 760px) {
    .story-stage { height: 100%; min-height: 0; }
    .chart-stage { padding: 12px 6px 8px; }
    .kicker-text { font-size: 16px; }
    .stage-kicker { margin-left: 6px; }
  }
</style>
