<script>
  import { onMount } from 'svelte';
  import { NARRATIVE_SECTIONS, FOOTER_CONTENT } from '$lib/narrativeSections';
  import { loadTractProfileData } from '$lib/mapData';
  import StoryStage from '$lib/components/StoryStage.svelte';
  import StoryExplorer from '$lib/components/StoryExplorer.svelte';
  import StoryStepBody from '$lib/components/StoryStepBody.svelte';
  import NeighborhoodTimeline from '$lib/components/NeighborhoodTimeline.svelte';

  const STORY_SECTIONS = NARRATIVE_SECTIONS.filter(
    (section) => section.id !== 'neighborhood-trajectories'
  );
  const timelineSection = NARRATIVE_SECTIONS.find(
    (section) => section.id === 'neighborhood-trajectories'
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
    return 'theme-' + (section?.theme ?? 'mixed');
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

  function scrollToStep(targetEl, targetSectionId) {
    targetSectionId = targetSectionId || '';
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
  <title>Speculation Has a Geography</title>
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
          class:theme-hold={section.theme === 'hold'}
          class:theme-flip={section.theme === 'flip'}
          class:theme-policy={section.theme === 'policy'}
        >
          <span class="progress-dot"></span>
          <span class="progress-num">{section.chapter}</span>
          <span class="progress-label">{section.title}</span>
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
          <div class="chapter-rule {themeClass(section)}"></div>
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

  <div class="story-transition-strip">
    <span>The story above is the city's story. Now explore every tract.</span>
  </div>

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

  {#if timelineSection}
    <section class="story-timeline-section">
      <div class="timeline-intro">
        <div class="chapter-mark">{timelineSection.chapter}</div>
        <h2>{timelineSection.title}</h2>
        <StoryStepBody html={timelineSection.content} />
      </div>
      <div class="timeline-chart-wrap">
        <NeighborhoodTimeline />
      </div>
    </section>
  {/if}

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

  /* ================================================================
     Opening title card
     ================================================================ */

  .story-opening {
    display: grid;
    min-height: 100vh;
    place-items: center;
    padding: 48px 24px;
    text-align: center;
  }

  .opening-inner {
    width: min(740px, 100%);
  }

  .story-opening :global(.scroll-headline) {
    margin: 0 auto 18px;
    font-family: "DM Serif Display", Georgia, serif;
    font-size: clamp(36px, 7vw, 80px);
    line-height: 0.92;
    letter-spacing: -0.01em;
  }

  .story-opening :global(.scroll-headline em) {
    color: var(--amber);
    font-style: normal;
  }

  .story-opening :global(.opening-stats) {
    display: flex;
    justify-content: center;
    gap: clamp(16px, 4vw, 40px);
    margin: 32px auto 28px;
    max-width: 600px;
  }

  .story-opening :global(.opening-stat) {
    flex: 1;
    padding: 22px 18px;
    border-radius: 12px;
    text-align: center;
  }

  .story-opening :global(.opening-stat-hold) {
    background: linear-gradient(160deg, rgba(27, 58, 92, 0.05), rgba(27, 58, 92, 0.09));
  }

  .story-opening :global(.opening-stat-flip) {
    background: linear-gradient(160deg, rgba(198, 139, 60, 0.05), rgba(198, 139, 60, 0.09));
  }

  .story-opening :global(.opening-stat-number) {
    display: block;
    font-family: "IBM Plex Mono", monospace;
    font-size: clamp(48px, 9vw, 72px);
    font-weight: 500;
    line-height: 1;
    margin-bottom: 10px;
  }

  .story-opening :global(.opening-stat-hold .opening-stat-number) {
    color: var(--navy);
  }

  .story-opening :global(.opening-stat-flip .opening-stat-number) {
    color: var(--amber);
  }

  .story-opening :global(.opening-stat-label) {
    display: block;
    font-family: "DM Serif Display", Georgia, serif;
    font-size: 14px;
    font-weight: 400;
    line-height: 1.45;
    color: var(--sub);
  }

  .story-opening :global(.opening-rule) {
    width: 48px;
    height: 1px;
    margin: 0 auto 24px;
    background: var(--neutral);
  }

  .story-opening :global(.scroll-subline) {
    max-width: 560px;
    margin: 0 auto 22px;
    color: var(--sub);
    font-size: clamp(16px, 2vw, 21px);
    line-height: 1.55;
  }

  .story-opening :global(.scroll-byline) {
    color: var(--faint);
    font-size: 12px;
    line-height: 1.6;
    letter-spacing: 0.03em;
  }

  .story-opening :global(.scroll-cue-wrap) {
    margin-top: 48px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .story-opening :global(.scroll-cue-text) {
    font-family: "IBM Plex Mono", monospace;
    font-size: 11px;
    color: var(--faint);
    letter-spacing: 0.04em;
  }

  .story-opening :global(.scroll-cue-chevron) {
    color: var(--faint);
    animation: cue-pulse 2.5s ease-in-out infinite;
  }

  @keyframes cue-pulse {
    0%, 100% { opacity: 0.3; transform: translateY(0); }
    50% { opacity: 1; transform: translateY(5px); }
  }

  /* ================================================================
     Scrollytelling region (three column grid)
     ================================================================ */

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

  /* ── Progress sidebar with colored dots ── */

  .story-progress {
    position: sticky;
    top: var(--story-top-rail);
    height: calc(100vh - var(--story-top-rail));
    grid-area: progress;
    align-self: start;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 12px;
    padding-top: 0;
  }

  .story-progress a {
    display: grid;
    grid-template-columns: 8px 24px 1fr;
    gap: 6px;
    align-items: center;
    color: var(--faint);
    font-size: 10px;
    line-height: 1.35;
    text-decoration: none;
    transition: color 0.18s ease;
  }

  .progress-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    border: 1px solid var(--faint);
    transition: all 0.25s ease;
  }

  .story-progress a.active .progress-dot {
    border-color: var(--ink);
    background: var(--ink);
  }

  .story-progress a.active.theme-hold .progress-dot {
    border-color: var(--navy);
    background: var(--navy);
  }

  .story-progress a.active.theme-flip .progress-dot {
    border-color: var(--amber);
    background: var(--amber);
  }

  .story-progress a.active.theme-policy .progress-dot {
    border-color: var(--ink);
    background: var(--ink);
  }

  .progress-num {
    font-family: "IBM Plex Mono", monospace;
    font-size: 10px;
  }

  .progress-label {
    font-size: 10px;
  }

  .story-progress a.active {
    color: var(--ink);
    font-weight: 600;
  }

  /* ── Text column ── */

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

  /* thin colored rule above each chapter marker */
  .chapter-rule {
    width: 32px;
    height: 1px;
    margin-bottom: 14px;
    background: var(--neutral);
  }

  .chapter-rule.theme-hold { background: var(--navy); }
  .chapter-rule.theme-flip { background: var(--amber); }
  .chapter-rule.theme-policy { background: var(--ink); }

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

  .chapter-mark.theme-hold { color: var(--navy); }
  .chapter-mark.theme-flip { color: var(--amber-dark); }
  .chapter-mark.theme-mixed { color: var(--navy); }
  .chapter-mark.theme-policy { color: var(--ink); }

  h2 {
    max-width: 520px;
    margin: 0 0 20px;
    font-family: "DM Serif Display", Georgia, serif;
    font-size: clamp(34px, 4vw, 54px);
    line-height: 1.04;
    letter-spacing: 0;
  }

  /* section takeaway: concluding insight in serif, visually distinguished */
  .story-step :global(.section-takeaway) {
    font-family: "DM Serif Display", Georgia, serif;
    font-size: 17px;
    line-height: 1.55;
    color: var(--ink);
    margin-top: 8px;
    margin-bottom: 0;
  }

  /* equity stat callouts */
  .story-step :global(.equity-stats) {
    display: flex;
    gap: 16px;
    margin: 8px 0 16px;
  }

  .story-step :global(.equity-stat) {
    flex: 1;
    text-align: center;
  }

  .story-step :global(.equity-number) {
    display: block;
    font-family: "IBM Plex Mono", monospace;
    font-size: 48px;
    font-weight: 500;
    line-height: 1;
    margin-bottom: 4px;
  }

  .story-step :global(.equity-label) {
    font-size: 12px;
    color: var(--sub);
  }

  /* ── Sticky visualization column ── */

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

  /* ================================================================
     Transition strip between guided narrative and explorer
     ================================================================ */

  .story-transition-strip {
    background: var(--ink);
    color: rgba(255, 255, 255, 0.6);
    text-align: center;
    padding: 20px 24px;
    font-family: "IBM Plex Mono", monospace;
    font-size: 12px;
    letter-spacing: 0.03em;
  }

  /* ================================================================
     Explorer section
     ================================================================ */

  .story-explorer-section {
    width: min(1560px, calc(100% - 28px));
    margin: 0 auto 80px;
    padding-top: 6vh;
  }

  .explorer-intro {
    max-width: 620px;
    margin-bottom: 28px;
  }

  /* ================================================================
     Timeline section
     ================================================================ */

  .story-timeline-section {
    width: min(1560px, calc(100% - 28px));
    margin: 0 auto 60px;
    padding-top: 6vh;
  }

  .timeline-intro {
    max-width: 620px;
    margin-bottom: 24px;
  }

  .timeline-chart-wrap {
    padding: 28px;
    border: 1px solid var(--rule);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.4);
  }

  /* ================================================================
     Footer
     ================================================================ */

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

  .story-footer :global(.footer-mapc) {
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 18px;
  }

  .story-footer :global(.footer-sources) {
    margin-bottom: 18px;
  }

  .story-footer :global(.footer-source-heading) {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--faint);
    margin-bottom: 4px;
  }

  .story-footer :global(.footer-sources div) {
    font-size: 12px;
    line-height: 1.65;
  }

  .story-footer :global(.footer-note) {
    margin-top: 6px;
    font-style: italic;
    color: var(--faint);
  }

  .story-footer :global(.footer-team) {
    font-size: 12px;
    font-weight: 600;
    color: var(--text);
  }

  /* ================================================================
     Responsive
     ================================================================ */

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

    .story-timeline-section {
      width: 100%;
      padding: 4vh 16px 0;
    }

    .timeline-chart-wrap {
      padding: 16px 10px;
    }

    .story-step :global(.equity-number) {
      font-size: 36px;
    }

    .story-opening :global(.opening-stat-number) {
      font-size: 48px;
    }
  }
</style>
