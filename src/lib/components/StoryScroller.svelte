<script>
  import { onMount } from 'svelte';
  import { NARRATIVE_SECTIONS, FOOTER_CONTENT } from '$lib/narrativeSections';
  import { loadTractProfileData } from '$lib/mapData';
  import StoryStage from '$lib/components/StoryStage.svelte';
  import StoryExplorer from '$lib/components/StoryExplorer.svelte';

  const STORY_SECTIONS = NARRATIVE_SECTIONS.filter(
    (section) => section.id !== 'neighborhood-trajectories'
  );
  const openingSection = STORY_SECTIONS.find((section) => section.layout === 'fullscreen');
  const storySteps = STORY_SECTIONS.filter((section) => section.layout === 'split');
  const explorerSection = STORY_SECTIONS.find((section) => section.layout === 'explorer');
  const progressSections = STORY_SECTIONS.filter(
    (section) => section.layout !== 'fullscreen' && section.id !== 'map-classified'
  );

  let activeId = storySteps[0]?.id ?? '';
  let observer;
  let observedNodes = [];

  let geoData = null;
  let ranges = {};
  let cityAverages = {};
  let holdingAverages = {};
  let flippingAverages = {};
  let counts = { holdCount: 0, flipCount: 0, mixedCount: 0, lowDataCount: 0 };
  let loadError = '';

  $: activeSection = storySteps.find((section) => section.id === activeId) ?? storySteps[0];
  $: activeChapter =
    STORY_SECTIONS.find((section) => section.id === activeId)?.chapter ?? activeSection?.chapter;

  function sectionBody(content) {
    return content.replace(/<h2[^>]*>[\s\S]*?<\/h2>/i, '').trim();
  }

  function themeClass(section) {
    return `theme-${section?.theme ?? 'mixed'}`;
  }

  function trackStep(node) {
    observedNodes = [...observedNodes, node];
    observer?.observe(node);

    return {
      destroy() {
        observer?.unobserve(node);
        observedNodes = observedNodes.filter((entry) => entry !== node);
      }
    };
  }

  async function loadData() {
    try {
      const loaded = await loadTractProfileData();
      counts = loaded.counts;
      ranges = loaded.ranges;
      cityAverages = loaded.cityAverages;
      holdingAverages = loaded.holdingAverages;
      flippingAverages = loaded.flippingAverages;
      geoData = loaded.geoData;
    } catch (error) {
      console.error('Could not load story data:', error);
      loadError = 'Could not load the tract profile data.';
    }
  }

  onMount(() => {
    loadData();

    observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visible?.target?.dataset?.sectionId) {
          activeId = visible.target.dataset.sectionId;
        }
      },
      {
        root: null,
        rootMargin: '-34% 0px -42% 0px',
        threshold: [0.1, 0.35, 0.6, 0.85]
      }
    );

    observedNodes.forEach((node) => observer.observe(node));

    return () => {
      observer?.disconnect();
    };
  });
</script>

<svelte:head>
  <title>Speculation Has a Geography | FP3 Story</title>
</svelte:head>

<article class="story-page">
  <section class="story-opening" id={openingSection.id}>
    <div class="opening-inner">
      {@html openingSection.content}
      <div class="opening-stats" aria-label="Project summary">
        <div>
          <span style="color: var(--navy)">Holding</span>
          <small>capital parked in high-value homes</small>
        </div>
        <div>
          <span style="color: var(--amber)">Flipping</span>
          <small>rapid turnover in vulnerable tracts</small>
        </div>
        <div>
          <span>180,000</span>
          <small>residential transactions analyzed</small>
        </div>
      </div>
    </div>
  </section>

  <section class="story-scroll-region" aria-label="Scrollytelling narrative">
    <nav class="story-progress" aria-label="Story sections">
      {#each progressSections as section}
        <a
          href={'#' + section.id}
          class:active={activeChapter === section.chapter}
        >
          <span>{section.chapter}</span>
          {section.title}
        </a>
      {/each}
    </nav>

    <div class="story-viz-column" aria-live="polite">
      <div class="sticky-stage">
        <StoryStage {activeSection} {geoData} {ranges} {counts} {loadError} />
      </div>
    </div>

    <div class="story-text-column">
      {#each storySteps as section}
        <section
          class="story-step"
          id={section.id}
          data-section-id={section.id}
          use:trackStep
        >
          <div class="chapter-mark {themeClass(section)}">{section.chapter}</div>
          <h2>{section.title}</h2>
          <div class="story-copy">
            {@html sectionBody(section.content)}
          </div>
        </section>
      {/each}
    </div>
  </section>

  <section
    class="story-explorer-section"
    id={explorerSection.id}
    data-section-id={explorerSection.id}
    use:trackStep
  >
    <div class="explorer-intro">
      <div class="chapter-mark {themeClass(explorerSection)}">{explorerSection.chapter}</div>
      <h2>{explorerSection.title}</h2>
      <div class="story-copy">
        {@html sectionBody(explorerSection.content)}
      </div>
    </div>

    <StoryExplorer
      {geoData}
      {ranges}
      {counts}
      {cityAverages}
      {holdingAverages}
      {flippingAverages}
    />
  </section>

  <footer class="story-footer">
    {@html FOOTER_CONTENT}
  </footer>
</article>

<style>
  :global(html) {
    height: auto !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
    scroll-behavior: smooth;
  }

  :global(body) {
    height: auto !important;
    min-height: 100% !important;
    overflow: visible !important;
  }

  .story-page {
    min-height: 100vh;
    background: var(--bg);
    color: var(--ink);
  }

  .story-opening {
    display: grid;
    min-height: 100vh;
    place-items: center;
    padding: 48px 24px;
    text-align: center;
  }

  .opening-inner {
    width: min(720px, 100%);
  }

  .story-opening :global(.scroll-headline) {
    margin: 0 auto 18px;
    font-family: "DM Serif Display", Georgia, serif;
    font-size: clamp(38px, 7vw, 86px);
    line-height: 0.98;
    letter-spacing: 0;
  }

  .story-opening :global(.scroll-headline)::first-line {
    color: var(--navy-dark);
  }

  .story-opening :global(.scroll-subline) {
    max-width: 560px;
    margin: 0 auto 22px;
    color: var(--sub);
    font-size: clamp(16px, 2vw, 21px);
    line-height: 1.55;
  }

  .story-opening :global(.scroll-byline),
  .story-opening :global(.scroll-cue) {
    color: var(--faint);
    font-size: 12px;
    line-height: 1.6;
  }

  .story-opening :global(.scroll-cue) {
    margin-top: 40px;
    font-family: "IBM Plex Mono", monospace;
  }

  .opening-stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    width: min(680px, 100%);
    margin: 34px auto 0;
  }

  .opening-stats div {
    padding: 13px 14px;
    border: 1px solid var(--rule);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.54);
  }

  .opening-stats span {
    display: block;
    font-family: "IBM Plex Mono", monospace;
    font-size: clamp(18px, 2.2vw, 27px);
    font-weight: 500;
    line-height: 1.1;
  }

  .opening-stats small {
    display: block;
    margin-top: 5px;
    color: var(--sub);
    font-size: 11px;
    line-height: 1.35;
  }

  .story-scroll-region {
    display: grid;
    grid-template-columns: minmax(88px, 0.22fr) minmax(320px, 0.92fr) minmax(480px, 1.45fr);
    grid-template-areas: "progress text viz";
    align-items: start;
    gap: clamp(22px, 3vw, 56px);
    width: min(1440px, 100%);
    margin: 0 auto;
    padding: 8vh clamp(18px, 4vw, 64px) 14vh;
  }

  .story-progress {
    position: sticky;
    top: 28px;
    grid-area: progress;
    align-self: start;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 8px;
  }

  .story-progress a {
    display: grid;
    grid-template-columns: 30px 1fr;
    gap: 8px;
    color: var(--faint);
    font-size: 11px;
    line-height: 1.35;
    text-decoration: none;
    transition: color 0.18s ease;
  }

  .story-progress span {
    font-family: "IBM Plex Mono", monospace;
  }

  .story-progress a.active {
    color: var(--ink);
  }

  .story-text-column {
    grid-area: text;
    display: flex;
    flex-direction: column;
  }

  .story-step {
    display: flex;
    min-height: 86vh;
    flex-direction: column;
    justify-content: center;
    padding: 18vh 0;
  }

  .chapter-mark {
    margin-bottom: 14px;
    font-family: "IBM Plex Mono", monospace;
    font-size: 12px;
    font-weight: 500;
  }

  .chapter-mark.theme-hold {
    color: var(--navy);
  }

  .chapter-mark.theme-flip {
    color: var(--amber-dark);
  }

  .chapter-mark.theme-mixed {
    color: var(--navy);
  }

  .chapter-mark.theme-policy {
    color: var(--ink);
  }

  .chapter-mark.theme-mixed::after {
    content: "";
    display: inline-block;
    width: 34px;
    height: 3px;
    margin-left: 9px;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--navy), var(--amber));
    vertical-align: middle;
  }

  h2 {
    max-width: 520px;
    margin: 0 0 20px;
    font-family: "DM Serif Display", Georgia, serif;
    font-size: clamp(34px, 4vw, 54px);
    line-height: 1.04;
    letter-spacing: 0;
  }

  .story-copy {
    max-width: 500px;
  }

  .story-copy :global(p) {
    margin: 0 0 15px;
    color: var(--text);
    font-size: 15px;
    line-height: 1.78;
  }

  .story-copy :global(strong) {
    color: var(--ink);
    font-weight: 700;
  }

  .story-viz-column {
    position: sticky;
    top: 0;
    grid-area: viz;
    align-self: start;
    display: flex;
    height: 100vh;
    align-items: center;
  }

  .sticky-stage {
    display: flex;
    width: 100%;
    height: 100%;
    align-items: center;
  }

  .story-explorer-section {
    width: min(1280px, calc(100% - 48px));
    margin: 0 auto 80px;
    padding-top: 6vh;
  }

  .explorer-intro {
    max-width: 620px;
    margin-bottom: 28px;
  }

  .story-footer {
    border-top: 1px solid var(--rule);
    padding: 34px 24px 42px;
    background: #fff;
    color: var(--sub);
    text-align: center;
  }

  .story-footer :global(.project-footer) {
    max-width: 760px;
    margin: 0 auto;
  }

  .story-footer :global(p) {
    margin: 0 0 10px;
    font-size: 12px;
    line-height: 1.65;
  }

  .story-footer :global(a) {
    color: var(--navy);
    font-weight: 700;
  }

  @media (max-width: 1040px) {
    .story-scroll-region {
      grid-template-columns: minmax(280px, 0.9fr) minmax(420px, 1.1fr);
      grid-template-areas: "text viz";
    }

    .story-progress {
      display: none;
    }

  }

  @media (max-width: 760px) {
    .story-scroll-region {
      display: block;
      gap: 0;
      padding: 0 0 8vh;
    }

    .story-viz-column {
      position: sticky;
      top: 0;
      z-index: 4;
      height: 46vh;
      background: var(--bg);
      box-shadow: 0 8px 18px rgba(25, 24, 22, 0.08);
    }

    .story-text-column {
      padding: 0 22px;
    }

    .sticky-stage {
      min-height: auto;
    }

    .story-step {
      min-height: 74vh;
      padding: 18vh 0;
    }

    h2 {
      font-size: 36px;
    }

    .story-explorer-section {
      width: 100%;
      padding: 7vh 16px 0;
    }

    .opening-stats {
      grid-template-columns: 1fr;
      max-width: 360px;
    }
  }
</style>
