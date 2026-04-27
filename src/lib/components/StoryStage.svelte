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

  /* The kicker states the finding, not the data description */
  const KICKERS = {
    'regime-shift': 'Before 2008, one in six. After, one in three.',
    'price-wedge': 'In holding zones, investors overpay. In flipping zones, they bought the crisis.'
  };

  $: kicker = KICKERS[activeSection?.id] || '';
</script>

<div class="story-stage" class:story-stage-line={isLineChart}>
  {#if loadError}
    <div class="stage-message">{loadError}</div>
  {:else}
    {#key stageKey}
      {#if viz === 'timeseries'}
        <div class="chart-stage slide-in">
          <div class="stage-kicker">{kicker}</div>
          <TimeSeriesChart width={660} height={420} />
        </div>
      {:else if viz === 'pricewedge'}
        <div class="chart-stage slide-in">
          <div class="stage-kicker">{kicker}</div>
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
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.4);
  }

  .chart-stage :global(svg) {
    width: 100%;
    height: auto;
    max-height: calc(100% - 38px);
  }

  .stage-kicker {
    margin: 0 0 18px 22px;
    color: var(--ink);
    font-family: "DM Serif Display", Georgia, serif;
    font-size: 20px;
    font-weight: 400;
    line-height: 1.25;
  }

  .stage-message {
    display: grid;
    height: 100%;
    place-items: center;
    padding: 24px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.4);
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
    }

    .stage-kicker {
      margin-left: 10px;
      font-size: 16px;
    }
  }
</style>
