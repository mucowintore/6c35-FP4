<script>
  import { onMount } from 'svelte';
  import { NARRATIVE_SECTIONS, FOOTER_CONTENT } from '$lib/narrativeSections';
  import { loadTractProfileData } from '$lib/mapData';
  import StoryStage from '$lib/components/StoryStage.svelte';
  import StoryExplorer from '$lib/components/StoryExplorer.svelte';
  import StoryStepBody from '$lib/components/StoryStepBody.svelte';

  /* timeline is now section 05 inside the scroll flow, rendered by StoryStage */
  const openingSection = NARRATIVE_SECTIONS.find((s) => s.layout === 'fullscreen');
  const storySteps = NARRATIVE_SECTIONS.filter((s) => s.layout === 'split');
  const renderedStorySteps = storySteps.filter((s) => s.id !== 'map-classified');
  const explorerSection = NARRATIVE_SECTIONS.find((s) => s.layout === 'explorer');
  const mapIntroStep = storySteps.find((s) => s.id === 'map-intro');
  const progressSections = NARRATIVE_SECTIONS.filter(
    (s) => s.layout !== 'fullscreen' && s.id !== 'map-classified'
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

  $: activeSection = storySteps.find((s) => s.id === activeId) ?? storySteps[0];
  $: activeChapter =
    NARRATIVE_SECTIONS.find((s) => s.id === activeId)?.chapter ?? activeSection?.chapter;
  $: chapter2NarrativeContent =
    storySteps.find((s) => s.id === chapter2NarrativeStepId)?.content ??
    mapIntroStep?.content ?? '';

  function themeOf(section) { return 'theme-' + (section?.theme ?? 'mixed'); }

  function trackStep(node) {
    observedNodes = [...observedNodes, node];
    const sectionId = node?.dataset?.sectionId;
    if (sectionId) storyStepNodes = { ...storyStepNodes, [sectionId]: node };
    observer?.observe(node);
    return {
      destroy() {
        observer?.unobserve(node);
        observedNodes = observedNodes.filter((e) => e !== node);
        if (sectionId && storyStepNodes[sectionId] === node) {
          const next = { ...storyStepNodes };
          delete next[sectionId];
          storyStepNodes = next;
        }
      }
    };
  }

  function isWide() { return typeof window !== 'undefined' && window.innerWidth > 760; }
  function inView(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  }
  function storyStepMode() {
    return storyRegionEl && storyRegionEl.getBoundingClientRect().top <= 28;
  }
  function explorerAtTop() {
    return explorerSectionEl && explorerSectionEl.getBoundingClientRect().top >= -12;
  }

  function activateStep(id) {
    if (!id) return;
    activeId = id;
    stepCursorId = id;
    if (id === 'map-intro' || id === 'map-classified') chapter2NarrativeStepId = id;
    activeLockUntil = Date.now() + ACTIVE_LOCK_MS;
    isStepTransitioning = true;
    window.clearTimeout(stepTransitionTimer);
    stepTransitionTimer = window.setTimeout(() => { isStepTransitioning = false; }, STEP_SCROLL_COOLDOWN_MS);
  }

  function scrollToStep(targetEl, targetId) {
    targetId = targetId || '';
    if (!targetEl) return;
    const isStep = targetId && storySteps.some((s) => s.id === targetId);
    if (isStep) { activateStep(targetId); }
    else {
      isStepTransitioning = true;
      window.clearTimeout(stepTransitionTimer);
      stepTransitionTimer = window.setTimeout(() => { isStepTransitioning = false; }, STEP_SCROLL_COOLDOWN_MS);
    }
    if (isWide() && isStep) {
      const top = window.scrollY + targetEl.getBoundingClientRect().top - STORY_TOP_RAIL_PX;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      return;
    }
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function queueWheelReset() {
    window.clearTimeout(wheelGestureResetTimer);
    wheelGestureResetTimer = window.setTimeout(() => { wheelGestureConsumed = false; }, WHEEL_GESTURE_IDLE_MS);
  }

  function handleWheel(event) {
    if (!isWide() || event.ctrlKey) return;
    if (Date.now() < wheelGuardUntil) return;
    const ov = inView(openingSectionEl), sv = inView(storyRegionEl);
    const sm = storyStepMode(), ev = inView(explorerSectionEl);
    if (!ov && !sv && !ev) return;
    if (isStepTransitioning || wheelGestureConsumed) { event.preventDefault(); queueWheelReset(); return; }
    if (event.deltaY === 0) return;
    const dir = event.deltaY > 0 ? 1 : -1;
    const ref = stepCursorId || activeId;
    const idx = storySteps.findIndex((s) => s.id === ref);
    let tEl = null, tId = '';

    if (dir > 0) {
      if (ov && !sm) { tEl = storyStepNodes[storySteps[0]?.id]; tId = storySteps[0]?.id ?? ''; }
      else {
        if (!sv || !sm) return;
        if (ref === 'map-intro') { event.preventDefault(); wheelGestureConsumed = true; queueWheelReset(); activateStep('map-classified'); return; }
        if (idx >= 0 && idx < storySteps.length - 1) { tId = storySteps[idx + 1]?.id ?? ''; tEl = storyStepNodes[tId]; }
        else if (idx === storySteps.length - 1) { if (ev) return; tEl = explorerSectionEl; }
      }
    } else {
      if (ev) { if (!explorerAtTop()) return; tId = storySteps[storySteps.length - 1]?.id ?? ''; tEl = storyStepNodes[tId]; }
      else if (ref === 'map-classified') { event.preventDefault(); wheelGestureConsumed = true; queueWheelReset(); activateStep('map-intro'); return; }
      else if (idx > 0) { tId = storySteps[idx - 1]?.id ?? ''; tEl = storyStepNodes[tId]; if (!tEl && tId === 'map-classified') tEl = storyStepNodes['map-intro']; }
      else if (idx === 0) { tEl = openingSectionEl; }
    }
    if (!tEl) return;
    event.preventDefault(); wheelGestureConsumed = true; queueWheelReset();
    scrollToStep(tEl, tId);
  }

  async function loadData() {
    try {
      const ld = await loadTractProfileData();
      counts = ld.counts; ranges = ld.ranges; cityAverages = ld.cityAverages;
      holdingAverages = ld.holdingAverages; flippingAverages = ld.flippingAverages;
      geoData = ld.geoData;
    } catch (e) {
      console.error('Could not load story data:', e);
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
    requestAnimationFrame(() => { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }); });
    wheelGuardUntil = Date.now() + INITIAL_WHEEL_GUARD_MS;

    observer = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (vis?.target?.dataset?.sectionId) {
        const oid = vis.target.dataset.sectionId;
        if (Date.now() < activeLockUntil && oid !== stepCursorId) return;
        if (stepCursorId === 'map-classified' && oid === 'map-intro') return;
        activeId = oid;
        if (storySteps.some((s) => s.id === oid)) {
          stepCursorId = oid;
          if (oid === 'map-intro') chapter2NarrativeStepId = 'map-intro';
        }
      }
    }, { root: null, rootMargin: '-34% 0px -42% 0px', threshold: [0.1, 0.35, 0.6, 0.85] });

    observedNodes.forEach((n) => observer.observe(n));
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      observer?.disconnect();
      window.removeEventListener('wheel', handleWheel);
      window.clearTimeout(stepTransitionTimer);
      window.clearTimeout(wheelGestureResetTimer);
      if (typeof history !== 'undefined' && 'scrollRestoration' in history && previousScrollRestoration)
        history.scrollRestoration = previousScrollRestoration;
    };
  });
</script>

<svelte:head>
  <title>Speculation Has a Geography</title>
</svelte:head>

<article class="story-page">

  <!-- dark cinematic opening -->
  <section class="story-opening" id={openingSection.id} bind:this={openingSectionEl}>
    <div class="opening-inner">
      {@html openingSection.content}
    </div>
  </section>

  <!-- gradient from dark opening to warm story background -->
  <div class="dark-to-warm"></div>

  <!-- scrollytelling region -->
  <section class="story-scroll-region" bind:this={storyRegionEl} aria-label="Scrollytelling narrative">

    <nav class="story-progress" aria-label="Story sections">
      {#each progressSections as section}
        <a href={'#' + section.id}
          class:active={activeChapter === section.chapter}
          class:t-hold={section.theme === 'hold'}
          class:t-flip={section.theme === 'flip'}
          class:t-policy={section.theme === 'policy'}>
          <span class="prog-dot"></span>
          <span class="prog-num">{section.chapter}</span>
          <span class="prog-label">{section.title}</span>
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
        <section class="story-step" class:chapter-two-step={section.id === 'map-intro'}
          id={section.id} data-section-id={section.id} use:trackStep>
          <div class="chapter-rule {themeOf(section)}"></div>
          <div class="chapter-mark {themeOf(section)}">{section.chapter}</div>
          <h2>{section.title}</h2>
          {#if section.id === 'map-intro'}
            <StoryStepBody html={chapter2NarrativeContent} animate={true} contentKey={chapter2NarrativeStepId} />
          {:else}
            <StoryStepBody html={section.content} />
          {/if}
        </section>
      {/each}
    </div>
  </section>

  <!-- cinematic transition to the explorer -->
  <div class="story-transition-strip">
    <p>The story above is the city's story.</p>
    <p>Now explore every tract.</p>
  </div>

  <!-- full interactive explorer -->
  <section class="story-explorer-section" id={explorerSection.id}
    data-section-id={explorerSection.id} use:trackStep bind:this={explorerSectionEl}>
    <StoryExplorer {geoData} {ranges} {counts} {cityAverages} {holdingAverages} {flippingAverages} />
  </section>

  <footer class="story-footer">
    {@html FOOTER_CONTENT}
  </footer>
</article>

<style>
  /* global accessibility: visible keyboard focus on all interactive elements */
  :global(*:focus-visible) {
    outline: 2px solid var(--navy);
    outline-offset: 2px;
  }

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
     Dark cinematic opening
     ================================================================ */

  .story-opening {
    display: grid;
    min-height: 100vh;
    place-items: center;
    padding: 48px 24px;
    text-align: center;
    background: #111110;
    color: #F2F0EA;
  }

  .opening-inner { width: min(740px, 100%); }

  .story-opening :global(.scroll-headline) {
    margin: 0 auto 24px;
    font-family: "DM Serif Display", Georgia, serif;
    font-size: clamp(36px, 7vw, 80px);
    line-height: 0.92;
    letter-spacing: -0.01em;
    color: #F2F0EA;
  }

  .story-opening :global(.scroll-headline em) {
    color: var(--amber);
    font-style: normal;
  }

  .story-opening :global(.opening-stats) {
    display: flex;
    justify-content: center;
    gap: clamp(16px, 4vw, 40px);
    margin: 32px auto 30px;
    max-width: 600px;
  }

  .story-opening :global(.opening-stat) {
    flex: 1;
    padding: 22px 18px;
    border-radius: 12px;
    text-align: center;
  }

  .story-opening :global(.opening-stat-hold) {
    background: rgba(27, 58, 92, 0.18);
  }

  .story-opening :global(.opening-stat-flip) {
    background: rgba(198, 139, 60, 0.18);
  }

  .story-opening :global(.opening-stat-number) {
    display: block;
    font-family: "IBM Plex Mono", monospace;
    font-size: clamp(48px, 9vw, 72px);
    font-weight: 500;
    line-height: 1;
    margin-bottom: 10px;
  }

  .story-opening :global(.opening-stat-hold .opening-stat-number) { color: #6BA3D6; }
  .story-opening :global(.opening-stat-flip .opening-stat-number) { color: var(--amber); }

  .story-opening :global(.opening-stat-label) {
    display: block;
    font-family: "DM Serif Display", Georgia, serif;
    font-size: 14px;
    font-weight: 400;
    line-height: 1.45;
    color: rgba(242, 240, 234, 0.6);
  }

  .story-opening :global(.opening-rule) {
    width: 48px;
    height: 1px;
    margin: 0 auto 24px;
    background: rgba(242, 240, 234, 0.2);
  }

  .story-opening :global(.scroll-subline) {
    max-width: 560px;
    margin: 0 auto 22px;
    color: rgba(242, 240, 234, 0.7);
    font-size: clamp(16px, 2vw, 21px);
    line-height: 1.55;
  }

  .story-opening :global(.scroll-byline) {
    color: rgba(242, 240, 234, 0.35);
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
    color: rgba(242, 240, 234, 0.3);
    letter-spacing: 0.04em;
  }

  .story-opening :global(.scroll-cue-chevron) {
    color: rgba(242, 240, 234, 0.3);
    animation: cue-pulse 2.5s ease-in-out infinite;
  }

  @keyframes cue-pulse {
    0%, 100% { opacity: 0.3; transform: translateY(0); }
    50% { opacity: 1; transform: translateY(5px); }
  }

  /* gradient from dark opening to warm page */
  .dark-to-warm {
    height: 120px;
    background: linear-gradient(to bottom, #111110, var(--bg));
  }

  /* ================================================================
     Scrollytelling three-column grid
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

  /* ── progress sidebar ── */

  .story-progress {
    position: sticky;
    top: var(--story-top-rail);
    height: calc(100vh - var(--story-top-rail));
    grid-area: progress;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 12px;
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
    transition: color 0.2s;
  }

  .prog-dot {
    width: 6px; height: 6px; border-radius: 50%;
    border: 1px solid var(--faint);
    transition: all 0.25s;
  }
  .story-progress a.active .prog-dot { border-color: var(--ink); background: var(--ink); }
  .story-progress a.active.t-hold .prog-dot { border-color: var(--navy); background: var(--navy); }
  .story-progress a.active.t-flip .prog-dot { border-color: var(--amber); background: var(--amber); }
  .story-progress a.active.t-policy .prog-dot { border-color: var(--ink); background: var(--ink); }

  .prog-num { font-family: "IBM Plex Mono", monospace; font-size: 10px; }
  .prog-label { font-size: 10px; }
  .story-progress a.active { color: var(--ink); font-weight: 600; }

  /* ── text column ── */

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
  .chapter-rule { width: 32px; height: 2px; margin-bottom: 14px; background: var(--neutral); }
  .chapter-rule.theme-hold { background: var(--navy); }
  .chapter-rule.theme-flip { background: var(--amber); }
  .chapter-rule.theme-policy { background: var(--ink); }

  .chapter-mark {
    margin-bottom: 14px;
    font-family: "IBM Plex Mono", monospace;
    font-size: 12px;
    font-weight: 500;
  }

  /* solid color bar instead of gradient; encodes section theme */
  .chapter-mark::after {
    content: "";
    display: inline-block;
    width: 28px; height: 3px;
    margin-left: 9px;
    border-radius: 999px;
    vertical-align: middle;
    background: var(--neutral);
  }
  .chapter-mark.theme-hold { color: var(--navy); }
  .chapter-mark.theme-hold::after { background: var(--navy); }
  .chapter-mark.theme-flip { color: var(--amber-dark); }
  .chapter-mark.theme-flip::after { background: var(--amber); }
  .chapter-mark.theme-mixed { color: var(--navy); }
  .chapter-mark.theme-mixed::after { background: linear-gradient(90deg, var(--navy), var(--amber)); }
  .chapter-mark.theme-policy { color: var(--ink); }
  .chapter-mark.theme-policy::after { background: var(--ink); }

  h2 {
    max-width: 520px;
    margin: 0 0 28px;
    font-family: "DM Serif Display", Georgia, serif;
    font-size: clamp(34px, 4vw, 54px);
    line-height: 1.04;
  }

  /* section takeaway: concluding insight rendered as a serif pullquote with left accent */
  .story-step :global(.section-takeaway) {
    font-family: "DM Serif Display", Georgia, serif;
    font-size: 17px;
    line-height: 1.5;
    color: var(--ink);
    margin-top: 8px;
    margin-bottom: 0;
    padding-left: 14px;
    border-left: 2px solid var(--neutral);
  }

  .story-step.theme-hold :global(.section-takeaway) { border-left-color: var(--navy); }
  /* TODO: fix theme class propagation if needed */

  /* equity stat callouts */
  .story-step :global(.equity-stats) { display: flex; gap: 16px; margin: 8px 0 16px; }
  .story-step :global(.equity-stat) { flex: 1; text-align: center; }
  .story-step :global(.equity-number) {
    display: block; font-family: "IBM Plex Mono", monospace;
    font-size: 48px; font-weight: 500; line-height: 1; margin-bottom: 4px;
  }
  .story-step :global(.equity-label) { font-size: 12px; color: var(--sub); }

  /* ── sticky visualization column ── */

  .story-viz-column {
    position: sticky;
    top: var(--story-top-rail);
    grid-area: viz;
    align-self: start;
    display: flex;
    height: calc(100vh - var(--story-top-rail));
    align-items: center;
  }

  .sticky-stage { display: flex; width: 100%; height: 100%; align-items: center; }

  /* ================================================================
     Transition strip: cinematic curtain before the explorer
     ================================================================ */

  .story-transition-strip {
    background: #111110;
    color: rgba(242, 240, 234, 0.55);
    text-align: center;
    padding: 56px 24px;
    font-family: "DM Serif Display", Georgia, serif;
    font-size: 22px;
    line-height: 1.5;
  }

  .story-transition-strip p { margin: 0; }

  /* ================================================================
     Explorer: nearly full-bleed
     ================================================================ */

  .story-explorer-section {
    width: calc(100% - 16px);
    max-width: 1600px;
    margin: 0 auto 60px;
    padding-top: 4vh;
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

  .story-footer :global(.project-footer) { max-width: 760px; margin: 0 auto; }
  .story-footer :global(p), .story-footer :global(div) { font-size: 12px; line-height: 1.65; }
  .story-footer :global(a) { color: var(--navy); font-weight: 700; }
  .story-footer :global(.footer-mapc) { font-size: 13px; font-weight: 600; margin-bottom: 18px; }
  .story-footer :global(.footer-sources) { margin-bottom: 18px; }
  .story-footer :global(.footer-source-heading) {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.08em; color: var(--faint); margin-bottom: 4px;
  }
  .story-footer :global(.footer-note) { margin-top: 6px; font-style: italic; color: var(--faint); }
  .story-footer :global(.footer-access) {
    margin-bottom: 14px; font-size: 11px; color: var(--faint);
    font-family: "IBM Plex Mono", monospace; letter-spacing: 0.02em;
  }
  .story-footer :global(.footer-team) { font-size: 12px; font-weight: 600; color: var(--text); }

  /* ================================================================
     Responsive
     ================================================================ */

  @media (max-width: 1040px) {
    .story-scroll-region {
      grid-template-columns: minmax(280px, 0.9fr) minmax(420px, 1.1fr);
      grid-template-areas: "text viz";
    }
    .story-progress { display: none; }
  }

  @media (max-width: 760px) {
    .story-scroll-region { display: block; gap: 0; padding: 0 0 8vh; }

    .story-viz-column {
      position: sticky; top: 0; z-index: 4; height: 46vh;
      background: var(--bg); box-shadow: 0 8px 18px rgba(25, 24, 22, 0.08);
    }

    .story-text-column { padding: 0 22px; }
    .sticky-stage { min-height: auto; }
    .story-step { min-height: 74vh; padding: 18vh 0; }
    h2 { font-size: 36px; }

    .story-explorer-section { width: 100%; padding: 4vh 12px 0; }

    .story-transition-strip { font-size: 18px; padding: 40px 20px; }

    .dark-to-warm { height: 80px; }

    .story-step :global(.equity-number) { font-size: 36px; }
    .story-opening :global(.opening-stat-number) { font-size: 48px; }
  }
</style>
