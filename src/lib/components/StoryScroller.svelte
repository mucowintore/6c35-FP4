<script>
  import { onMount } from 'svelte';
  import { NARRATIVE_SECTIONS, FOOTER_CONTENT } from '$lib/narrativeSections';
  import { loadTractProfileData } from '$lib/mapData';
  import StoryStage from '$lib/components/StoryStage.svelte';
  import StoryExplorer from '$lib/components/StoryExplorer.svelte';
  import StoryStepBody from '$lib/components/StoryStepBody.svelte';

  const STORY_SECTIONS = NARRATIVE_SECTIONS.filter(
    (section) => section.id !== 'neighborhood-trajectories'
  );
  const openingSection = STORY_SECTIONS.find((section) => section.layout === 'fullscreen');
  const storySteps = STORY_SECTIONS.filter((section) => section.layout === 'split');
  const renderedStorySteps = storySteps.filter((section) => section.id !== 'map-classified');
  const explorerSection = STORY_SECTIONS.find((section) => section.layout === 'explorer');
  const mapIntroStep = storySteps.find((section) => section.id === 'map-intro');
  const progressSections = STORY_SECTIONS.filter(
    (section) => section.layout !== 'fullscreen' && section.id !== 'map-classified'
  );

  let activeId = storySteps[0]?.id ?? '';
  let observer;
  let observedNodes = [];
  let openingSectionEl;
  let storyRegionEl;
  let storyStepNodes = {};
  let explorerSectionEl;
  let isStepTransitioning = false;
  let stepTransitionTimer;
  let wheelGestureConsumed = false;
  let wheelGestureResetTimer;
  let previousScrollRestoration = null;
  let wheelGuardUntil = 0;
  let stepCursorId = storySteps[0]?.id ?? '';
  let activeLockUntil = 0;
  let chapter2NarrativeStepId = 'map-intro';

  const STEP_SCROLL_COOLDOWN_MS = 640;
  const WHEEL_GESTURE_IDLE_MS = 320;
  const INITIAL_WHEEL_GUARD_MS = 700;
  const ACTIVE_LOCK_MS = 950;
  const STORY_TOP_RAIL_PX = 28;

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
  $: chapter2NarrativeContent =
    storySteps.find((section) => section.id === chapter2NarrativeStepId)?.content ??
    mapIntroStep?.content ??
    '';

  function themeClass(section) {
    return `theme-${section?.theme ?? 'mixed'}`;
  }

  function trackStep(node) {
    observedNodes = [...observedNodes, node];
    const sectionId = node?.dataset?.sectionId;
    if (sectionId) {
      storyStepNodes = { ...storyStepNodes, [sectionId]: node };
    }
    observer?.observe(node);

    return {
      destroy() {
        observer?.unobserve(node);
        observedNodes = observedNodes.filter((entry) => entry !== node);
        if (sectionId && storyStepNodes[sectionId] === node) {
          const nextNodes = { ...storyStepNodes };
          delete nextNodes[sectionId];
          storyStepNodes = nextNodes;
        }
      }
    };
  }

  function isDesktopOrTablet() {
    return typeof window !== 'undefined' && window.innerWidth > 760;
  }

  function inView(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < window.innerHeight;
  }

  function storyStepModeActive() {
    if (!storyRegionEl) return false;
    const rect = storyRegionEl.getBoundingClientRect();
    return rect.top <= 28;
  }

  function explorerAtTop() {
    if (!explorerSectionEl) return false;
    return explorerSectionEl.getBoundingClientRect().top >= -12;
  }

  function activateStep(sectionId) {
    if (!sectionId) return;
    activeId = sectionId;
    stepCursorId = sectionId;
    if (sectionId === 'map-intro' || sectionId === 'map-classified') {
      chapter2NarrativeStepId = sectionId;
    }
    activeLockUntil = Date.now() + ACTIVE_LOCK_MS;
    isStepTransitioning = true;
    window.clearTimeout(stepTransitionTimer);
    stepTransitionTimer = window.setTimeout(() => {
      isStepTransitioning = false;
    }, STEP_SCROLL_COOLDOWN_MS);
  }

  function scrollToStep(targetEl, targetSectionId = '') {
    if (!targetEl) return;
    const isStoryStepTarget =
      targetSectionId && storySteps.some((section) => section.id === targetSectionId);

    if (isStoryStepTarget) {
      activateStep(targetSectionId);
    } else {
      isStepTransitioning = true;
      window.clearTimeout(stepTransitionTimer);
      stepTransitionTimer = window.setTimeout(() => {
        isStepTransitioning = false;
      }, STEP_SCROLL_COOLDOWN_MS);
    }

    if (isDesktopOrTablet() && isStoryStepTarget) {
      const targetTop = window.scrollY + targetEl.getBoundingClientRect().top - STORY_TOP_RAIL_PX;
      window.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
      return;
    }

    targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function queueWheelGestureReset() {
    window.clearTimeout(wheelGestureResetTimer);
    wheelGestureResetTimer = window.setTimeout(() => {
      wheelGestureConsumed = false;
    }, WHEEL_GESTURE_IDLE_MS);
  }

  function handleNarrativeWheel(event) {
    if (!isDesktopOrTablet() || event.ctrlKey) return;
    if (Date.now() < wheelGuardUntil) return;

    const openingVisible = inView(openingSectionEl);
    const storyIsVisible = inView(storyRegionEl);
    const storyStepMode = storyStepModeActive();
    const explorerIsVisible = inView(explorerSectionEl);
    if (!openingVisible && !storyIsVisible && !explorerIsVisible) return;

    if (isStepTransitioning || wheelGestureConsumed) {
      event.preventDefault();
      queueWheelGestureReset();
      return;
    }

    if (event.deltaY === 0) return;
    const direction = event.deltaY > 0 ? 1 : -1;

    const referenceId = stepCursorId || activeId;
    const currentIndex = storySteps.findIndex((section) => section.id === referenceId);
    let targetEl = null;
    let targetSectionId = '';

    if (direction > 0) {
      if (openingVisible && !storyStepMode) {
        targetEl = storyStepNodes[storySteps[0]?.id];
        targetSectionId = storySteps[0]?.id ?? '';
      } else {
        if (!storyIsVisible || !storyStepMode) return;
        if (referenceId === 'map-intro') {
          event.preventDefault();
          wheelGestureConsumed = true;
          queueWheelGestureReset();
          activateStep('map-classified');
          return;
        }
        if (currentIndex >= 0 && currentIndex < storySteps.length - 1) {
          targetSectionId = storySteps[currentIndex + 1]?.id ?? '';
          targetEl = storyStepNodes[targetSectionId];
        } else if (currentIndex === storySteps.length - 1) {
          if (explorerIsVisible) return;
          targetEl = explorerSectionEl;
        }
      }
    } else {
      if (explorerIsVisible) {
        if (!explorerAtTop()) return;
        targetSectionId = storySteps[storySteps.length - 1]?.id ?? '';
        targetEl = storyStepNodes[targetSectionId];
      } else if (referenceId === 'map-classified') {
        event.preventDefault();
        wheelGestureConsumed = true;
        queueWheelGestureReset();
        activateStep('map-intro');
        return;
      } else if (currentIndex > 0) {
        targetSectionId = storySteps[currentIndex - 1]?.id ?? '';
        targetEl = storyStepNodes[targetSectionId];
        if (!targetEl && targetSectionId === 'map-classified') {
          targetEl = storyStepNodes['map-intro'];
        }
      } else if (currentIndex === 0) {
        targetEl = openingSectionEl;
      }
    }

    if (!targetEl) return;

    event.preventDefault();
    wheelGestureConsumed = true;
    queueWheelGestureReset();
    scrollToStep(targetEl, targetSectionId);
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
    if (typeof history !== 'undefined' && 'scrollRestoration' in history) {
      previousScrollRestoration = history.scrollRestoration;
      history.scrollRestoration = 'manual';
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });
    wheelGuardUntil = Date.now() + INITIAL_WHEEL_GUARD_MS;

    observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visible?.target?.dataset?.sectionId) {
          const observedId = visible.target.dataset.sectionId;
          if (Date.now() < activeLockUntil && observedId !== stepCursorId) return;
          if (stepCursorId === 'map-classified' && observedId === 'map-intro') return;
          activeId = observedId;
          if (storySteps.some((section) => section.id === observedId)) {
            stepCursorId = observedId;
            if (observedId === 'map-intro') {
              chapter2NarrativeStepId = 'map-intro';
            }
          }
        }
      },
      {
        root: null,
        rootMargin: '-34% 0px -42% 0px',
        threshold: [0.1, 0.35, 0.6, 0.85]
      }
    );

    observedNodes.forEach((node) => observer.observe(node));
    window.addEventListener('wheel', handleNarrativeWheel, { passive: false });

    return () => {
      observer?.disconnect();
      window.removeEventListener('wheel', handleNarrativeWheel);
      window.clearTimeout(stepTransitionTimer);
      window.clearTimeout(wheelGestureResetTimer);
      if (typeof history !== 'undefined' && 'scrollRestoration' in history && previousScrollRestoration) {
        history.scrollRestoration = previousScrollRestoration;
      }
    };
  });
</script>

<svelte:head>
  <title>Speculation Has a Geography | FP3 Story</title>
</svelte:head>

<article class="story-page">
  <section class="story-opening" id={openingSection.id} bind:this={openingSectionEl}>
    <div class="opening-inner">
      {@html openingSection.content}
    </div>
  </section>

  <section class="story-scroll-region" aria-label="Scrollytelling narrative" bind:this={storyRegionEl}>
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
      {#each renderedStorySteps as section}
        <section
          class="story-step"
          class:chapter-two-step={section.id === 'map-intro'}
          id={section.id}
          data-section-id={section.id}
          use:trackStep
        >
          <div class="chapter-mark {themeClass(section)}">{section.chapter}</div>
          <h2>{section.title}</h2>
          {#if section.id === 'map-intro'}
            <StoryStepBody
              html={chapter2NarrativeContent}
              animate={true}
              contentKey={chapter2NarrativeStepId}
            />
          {:else}
            <StoryStepBody html={section.content} />
          {/if}
        </section>
      {/each}
    </div>
  </section>

  <section
    class="story-explorer-section"
    id={explorerSection.id}
    data-section-id={explorerSection.id}
    use:trackStep
    bind:this={explorerSectionEl}
  >
    <div class="explorer-intro">
      <div class="chapter-mark {themeClass(explorerSection)}">{explorerSection.chapter}</div>
      <h2>{explorerSection.title}</h2>
      <StoryStepBody html={explorerSection.content} />
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
    font-size: clamp(32px, 6vw, 72px);
    line-height: 0.98;
    letter-spacing: 0;
  }

  .story-opening :global(.scroll-headline em) {
    color: var(--amber);
    font-style: normal;
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

  .story-scroll-region {
    --story-top-rail: 28px;
    display: grid;
    grid-template-columns: minmax(88px, 0.22fr) minmax(320px, 0.92fr) minmax(480px, 1.45fr);
    grid-template-areas: "progress text viz";
    align-items: start;
    gap: clamp(22px, 3vw, 56px);
    width: min(1440px, 100%);
    margin: 0 auto;
    padding: var(--story-top-rail) clamp(18px, 4vw, 64px) 14vh;
  }

  .story-progress {
    position: sticky;
    top: var(--story-top-rail);
    height: calc(100vh - var(--story-top-rail));
    grid-area: progress;
    align-self: start;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 10px;
    padding-top: 0;
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
    box-sizing: border-box;
    min-height: calc(100vh - var(--story-top-rail));
    flex-direction: column;
    justify-content: center;
    padding: clamp(18px, 4vh, 42px) 0;
  }

  .story-step.chapter-two-step :global(.story-copy) {
    min-height: clamp(280px, 34vh, 420px);
  }

  .chapter-mark {
    margin-bottom: 14px;
    font-family: "IBM Plex Mono", monospace;
    font-size: 12px;
    font-weight: 500;
  }

  .chapter-mark::after {
    content: "";
    display: inline-block;
    width: 34px;
    height: 3px;
    margin-left: 9px;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--navy), var(--amber));
    vertical-align: middle;
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

  h2 {
    max-width: 520px;
    margin: 0 0 20px;
    font-family: "DM Serif Display", Georgia, serif;
    font-size: clamp(34px, 4vw, 54px);
    line-height: 1.04;
    letter-spacing: 0;
  }

  .story-viz-column {
    position: sticky;
    top: var(--story-top-rail);
    grid-area: viz;
    align-self: start;
    display: flex;
    height: calc(100vh - var(--story-top-rail));
    align-items: center;
  }

  .sticky-stage {
    display: flex;
    width: 100%;
    height: 100%;
    align-items: center;
  }

  .story-explorer-section {
    width: min(1560px, calc(100% - 28px));
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
      align-items: center;
      background: var(--bg);
      box-shadow: 0 8px 18px rgba(25, 24, 22, 0.08);
    }

    .story-text-column {
      padding: 0 22px;
    }

    .sticky-stage {
      min-height: auto;
      align-items: center;
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

  }
</style>
