<script>
  import { onDestroy, onMount } from 'svelte';
  import TimeSeriesChart from '$lib/components/TimeSeriesChart.svelte';
  import PriceWedgeChart from '$lib/components/PriceWedgeChart.svelte';
  import StoryMap from '$lib/components/StoryMap.svelte';
  import NeighborhoodTimeline from '$lib/components/NeighborhoodTimeline.svelte';
  import NeighborhoodLeaderboard from '$lib/components/NeighborhoodLeaderboard.svelte';

  export let section = null;
  export let active = false;
  export let geoData = null;
  export let ranges = {};
  export let counts = {};
  export let loadError = '';

  let rootEl = null;
  let observer = null;
  let inViewport = false;

  let introMapState = 'gray';
  let introMapRaf = 0;
  let bloomCaptionVisible = false;
  let bloomCaptionTimer = null;

  $: viz = section?.viz ?? null;
  $: isMapIntro = section?.id === 'map-intro';
  $: mapState = isMapIntro ? introMapState : (section?.mapState ?? 'classified');

  $: if (isMapIntro && active && inViewport) {
    if (introMapRaf) cancelAnimationFrame(introMapRaf);
    introMapRaf = requestAnimationFrame(function () {
      introMapRaf = 0;
      introMapState = section?.mapState ?? 'classified';
    });

    if (!bloomCaptionTimer && !bloomCaptionVisible) {
      bloomCaptionTimer = setTimeout(function () {
        bloomCaptionVisible = true;
        bloomCaptionTimer = null;
      }, 2400);
    }
  } else if (isMapIntro) {
    if (bloomCaptionTimer) {
      clearTimeout(bloomCaptionTimer);
      bloomCaptionTimer = null;
    }
    bloomCaptionVisible = false;
    introMapState = 'gray';
  }

  onMount(function () {
    if (typeof IntersectionObserver === 'undefined' || !rootEl) return;
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.target === rootEl) {
          inViewport = entry.isIntersecting && entry.intersectionRatio >= 0.4;
        }
      });
    }, { threshold: [0, 0.4, 0.8] });
    observer.observe(rootEl);
  });

  onDestroy(function () {
    if (observer) observer.disconnect();
    observer = null;
    if (introMapRaf) cancelAnimationFrame(introMapRaf);
    introMapRaf = 0;
    if (bloomCaptionTimer) clearTimeout(bloomCaptionTimer);
    bloomCaptionTimer = null;
  });
</script>

<div class="step-viz-shell"
  class:viz-timeseries={viz === 'timeseries'}
  class:viz-pricewedge={viz === 'pricewedge'}
  class:viz-map={viz === 'map'}
  class:viz-timeline={viz === 'timeline'}
  class:viz-leaderboard={viz === 'leaderboard'}
  bind:this={rootEl}>
  {#if loadError}
    <div class="stage-message">{loadError}</div>
  {:else if viz === 'timeseries'}
    <div class="chart-stage ts-stage">
      <div class="chart-body">
        <TimeSeriesChart width={680} height={620}
          active={active}
          inViewport={inViewport}
          visible={active} />
      </div>
    </div>
  {:else if viz === 'pricewedge'}
    <div class="chart-stage pw-stage">
      <div class="stage-title-block" aria-hidden="true">
        <p class="stage-title">Investor Price Premium by Strategy</p>
        <p class="stage-subtitle">Holding and flipping tracts, 2000 to 2022</p>
      </div>
      <div class="chart-body">
        <PriceWedgeChart width={680} height={420}
          active={active}
          inViewport={inViewport}
          visible={active} />
      </div>
    </div>
  {:else if viz === 'map'}
    <div class="map-stage">
      <StoryMap
        {geoData}
        {ranges}
        {counts}
        {mapState}
        visible={active} />
      {#if isMapIntro}
        <div class="bloom-caption" class:visible={bloomCaptionVisible}>
          173 tracts  ·  Two strategies
        </div>
      {/if}
    </div>
  {:else if viz === 'timeline'}
    <div class="chart-stage timeline-stage">
      <div class="timeline-body">
        <NeighborhoodTimeline
          active={active}
          inViewport={inViewport}
          visible={active} />
      </div>
    </div>
  {:else if viz === 'leaderboard'}
    <div class="leaderboard-stage">
      <NeighborhoodLeaderboard {geoData} />
    </div>
  {/if}
</div>

<style>
  .step-viz-shell {
    position: relative;
    width: 100%;
    height: min(84vh, 760px);
    min-height: 500px;
  }
  .step-viz-shell.viz-timeseries {
    height: min(88vh, 860px);
    min-height: 620px;
  }
  .step-viz-shell.viz-timeline {
    height: clamp(620px, 78vh, 920px);
    min-height: 620px;
  }
  .step-viz-shell.viz-leaderboard {
    min-height: 420px;
  }

  .chart-stage {
    position: absolute;
    inset: 0;
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
    justify-content: center;
    padding-top: 0;
  }
  .pw-stage .chart-body {
    overflow: visible;
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

  .timeline-stage {
    padding-left: 6px;
    padding-right: 4px;
  }
  .timeline-body {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .map-stage {
    position: absolute;
    inset: 0;
  }

  .leaderboard-stage {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    padding: 12px 8px;
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

  .stage-title-block {
    position: relative;
    margin: 0 0 8px 14px;
    max-width: min(520px, calc(100% - 24px));
    pointer-events: none;
    z-index: 4;
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

  @media (max-width: 760px) {
    .step-viz-shell {
      height: 46vh;
      min-height: 300px;
    }
    .step-viz-shell.viz-timeseries,
    .step-viz-shell.viz-timeline {
      height: 52vh;
      min-height: 340px;
    }
    .chart-stage { padding: 12px 6px 8px; }
    .stage-title-block {
      margin-left: 8px;
      margin-bottom: 6px;
      max-width: calc(100% - 16px);
    }
    .stage-title { font-size: 18px; }
    .stage-subtitle { font-size: 9px; }
    .bloom-caption { font-size: 9.5px; }
  }
</style>
