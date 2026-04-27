<script>
  import TimeSeriesChart from '$lib/components/TimeSeriesChart.svelte';
  import PriceWedgeChart from '$lib/components/PriceWedgeChart.svelte';
  import StoryMap from '$lib/components/StoryMap.svelte';

  export let activeSection = null;
  export let geoData = null;
  export let ranges = {};
  export let counts = {};
  export let loadError = '';

  $: viz = activeSection?.viz ?? 'timeseries';
  $: mapState = activeSection?.mapState ?? 'classified';
  $: stageKey = `${viz}-${mapState}-${activeSection?.id ?? 'none'}`;
  $: isLineChart = viz === 'timeseries' || viz === 'pricewedge';
</script>

<div class="story-stage" class:story-stage-line={isLineChart}>
  {#if loadError}
    <div class="stage-message">{loadError}</div>
  {:else}
    {#key stageKey}
      {#if viz === 'timeseries'}
        <div class="chart-stage chart-stage-timeseries slide-in">
          <div class="stage-kicker">Investor share of Boston purchases</div>
          <TimeSeriesChart width={660} height={420} />
        </div>
      {:else if viz === 'pricewedge'}
        <div class="chart-stage slide-in">
          <div class="stage-kicker">Investor price premium vs. non-investors</div>
          <PriceWedgeChart width={640} height={390} />
        </div>
      {:else if viz === 'map'}
        <div class="map-stage slide-in">
          <StoryMap {geoData} {ranges} {counts} {mapState} />
        </div>
      {:else}
        <div class="stage-message">Keep scrolling to explore every tract.</div>
      {/if}
    {/key}
  {/if}
</div>

<style>
  .story-stage {
    width: 100%;
    height: min(78vh, 700px);
    min-height: 460px;
  }

  .story-stage.story-stage-line {
    height: min(64vh, 560px);
    min-height: 390px;
  }

  .chart-stage,
  .map-stage {
    width: 100%;
    height: 100%;
  }

  .chart-stage {
    display: flex;
    flex-direction: column;
    justify-content: center;
    overflow: hidden;
    padding: 28px 28px 24px;
    border: 1px solid var(--rule);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.72);
  }

  .chart-stage :global(svg) {
    width: 100%;
    height: auto;
    max-height: calc(100% - 34px);
  }

  .stage-kicker {
    margin: 0 0 16px 22px;
    color: #3f3b34;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.01em;
    text-transform: none;
    line-height: 1.25;
  }

  .chart-stage-timeseries .stage-kicker {
    font-size: 16px;
  }

  .stage-message {
    display: grid;
    height: 100%;
    place-items: center;
    padding: 24px;
    border: 1px solid var(--rule);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.72);
    color: var(--sub);
    font-size: 14px;
    text-align: center;
  }

  .slide-in {
    animation: stage-slide-in 640ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes stage-slide-in {
    from {
      opacity: 0;
      transform: translateX(10px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @media (max-width: 760px) {
    .story-stage {
      height: 100%;
      min-height: 0;
    }

    .chart-stage {
      padding: 18px 10px 14px;
      border-radius: 0;
      border-left: 0;
      border-right: 0;
    }

    .stage-kicker {
      margin-left: 10px;
    }
  }
</style>
