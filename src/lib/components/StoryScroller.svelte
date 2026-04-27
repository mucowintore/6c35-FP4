<script>
  import { onMount } from 'svelte';
  import { NARRATIVE_SECTIONS, FOOTER_CONTENT } from '$lib/narrativeSections';
  import { loadTractProfileData } from '$lib/mapData';
  import StoryStage from '$lib/components/StoryStage.svelte';
  import StoryExplorer from '$lib/components/StoryExplorer.svelte';
  import StoryStepBody from '$lib/components/StoryStepBody.svelte';

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

  function themeOf(s) { return 'theme-' + (s?.theme ?? 'mixed'); }

  function trackStep(node) {
    observedNodes = [...observedNodes, node];
    var sid = node?.dataset?.sectionId;
    if (sid) storyStepNodes = { ...storyStepNodes, [sid]: node };
    observer?.observe(node);
    return {
      destroy() {
        observer?.unobserve(node);
        observedNodes = observedNodes.filter((e) => e !== node);
        if (sid && storyStepNodes[sid] === node) {
          var next = { ...storyStepNodes }; delete next[sid]; storyStepNodes = next;
        }
      }
    };
  }

  function isWide() { return typeof window !== 'undefined' && window.innerWidth > 760; }
  function inView(el) { if (!el) return false; var r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight; }
  function storyStepMode() { return storyRegionEl && storyRegionEl.getBoundingClientRect().top <= 28; }
  function explorerAtTop() { return explorerSectionEl && explorerSectionEl.getBoundingClientRect().top >= -12; }

  function activateStep(id) {
    if (!id) return;
    activeId = id; stepCursorId = id;
    if (id === 'map-intro' || id === 'map-classified') chapter2NarrativeStepId = id;
    activeLockUntil = Date.now() + ACTIVE_LOCK_MS;
    isStepTransitioning = true;
    window.clearTimeout(stepTransitionTimer);
    stepTransitionTimer = window.setTimeout(() => { isStepTransitioning = false; }, STEP_SCROLL_COOLDOWN_MS);
  }

  function scrollToStep(tEl, tId) {
    tId = tId || '';
    if (!tEl) return;
    var isStep = tId && storySteps.some((s) => s.id === tId);
    if (isStep) activateStep(tId);
    else { isStepTransitioning = true; window.clearTimeout(stepTransitionTimer); stepTransitionTimer = window.setTimeout(() => { isStepTransitioning = false; }, STEP_SCROLL_COOLDOWN_MS); }
    if (isWide() && isStep) { var top = window.scrollY + tEl.getBoundingClientRect().top - STORY_TOP_RAIL_PX; window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' }); return; }
    tEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function queueWheelReset() { window.clearTimeout(wheelGestureResetTimer); wheelGestureResetTimer = window.setTimeout(() => { wheelGestureConsumed = false; }, WHEEL_GESTURE_IDLE_MS); }

  function handleWheel(event) {
    if (!isWide() || event.ctrlKey) return;
    if (Date.now() < wheelGuardUntil) return;
    var ov = inView(openingSectionEl), sv = inView(storyRegionEl), sm = storyStepMode(), ev = inView(explorerSectionEl);
    if (!ov && !sv && !ev) return;
    if (isStepTransitioning || wheelGestureConsumed) { event.preventDefault(); queueWheelReset(); return; }
    if (event.deltaY === 0) return;
    var dir = event.deltaY > 0 ? 1 : -1;
    var ref = stepCursorId || activeId;
    var idx = storySteps.findIndex((s) => s.id === ref);
    var tEl = null, tId = '';
    if (dir > 0) {
      if (ov && !sm) { tEl = storyStepNodes[storySteps[0]?.id]; tId = storySteps[0]?.id ?? ''; }
      else { if (!sv || !sm) return; if (ref === 'map-intro') { event.preventDefault(); wheelGestureConsumed = true; queueWheelReset(); activateStep('map-classified'); return; } if (idx >= 0 && idx < storySteps.length - 1) { tId = storySteps[idx + 1]?.id ?? ''; tEl = storyStepNodes[tId]; } else if (idx === storySteps.length - 1) { if (ev) return; tEl = explorerSectionEl; } }
    } else {
      if (ev) { if (!explorerAtTop()) return; tId = storySteps[storySteps.length - 1]?.id ?? ''; tEl = storyStepNodes[tId]; }
      else if (ref === 'map-classified') { event.preventDefault(); wheelGestureConsumed = true; queueWheelReset(); activateStep('map-intro'); return; }
      else if (idx > 0) { tId = storySteps[idx - 1]?.id ?? ''; tEl = storyStepNodes[tId]; if (!tEl && tId === 'map-classified') tEl = storyStepNodes['map-intro']; }
      else if (idx === 0) { tEl = openingSectionEl; }
    }
    if (!tEl) return;
    event.preventDefault(); wheelGestureConsumed = true; queueWheelReset(); scrollToStep(tEl, tId);
  }

  async function loadData() {
    try {
      var ld = await loadTractProfileData();
      counts = ld.counts; ranges = ld.ranges; cityAverages = ld.cityAverages;
      holdingAverages = ld.holdingAverages; flippingAverages = ld.flippingAverages; geoData = ld.geoData;
    } catch (e) { console.error('Could not load story data:', e); loadError = 'Could not load data.'; }
  }

  onMount(() => {
    loadData();
    if (typeof history !== 'undefined' && 'scrollRestoration' in history) { previousScrollRestoration = history.scrollRestoration; history.scrollRestoration = 'manual'; }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    requestAnimationFrame(() => { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }); });
    wheelGuardUntil = Date.now() + INITIAL_WHEEL_GUARD_MS;
    observer = new IntersectionObserver((entries) => {
      var vis = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (vis?.target?.dataset?.sectionId) {
        var oid = vis.target.dataset.sectionId;
        if (Date.now() < activeLockUntil && oid !== stepCursorId) return;
        if (stepCursorId === 'map-classified' && oid === 'map-intro') return;
        activeId = oid;
        if (storySteps.some((s) => s.id === oid)) { stepCursorId = oid; if (oid === 'map-intro') chapter2NarrativeStepId = 'map-intro'; }
      }
    }, { root: null, rootMargin: '-34% 0px -42% 0px', threshold: [0.1, 0.35, 0.6, 0.85] });
    observedNodes.forEach((n) => observer.observe(n));
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      observer?.disconnect(); window.removeEventListener('wheel', handleWheel);
      window.clearTimeout(stepTransitionTimer); window.clearTimeout(wheelGestureResetTimer);
      if (typeof history !== 'undefined' && 'scrollRestoration' in history && previousScrollRestoration) history.scrollRestoration = previousScrollRestoration;
    };
  });
</script>

<svelte:head><title>Speculation Has a Geography</title></svelte:head>

<article class="story-page">

  <section class="story-opening" id={openingSection.id} bind:this={openingSectionEl}>
    <div class="opening-inner">{@html openingSection.content}</div>
  </section>

  <div class="dark-to-warm"></div>

  <section class="story-scroll-region" bind:this={storyRegionEl} aria-label="Scrollytelling narrative">
    <nav class="story-progress" aria-label="Story sections">
      {#each progressSections as section}
        <a href={'#' + section.id}
          class:active={activeChapter === section.chapter}
          class:t-hold={section.theme === 'hold'}
          class:t-flip={section.theme === 'flip'}
          class:t-policy={section.theme === 'policy'}>
          <span class="prog-dot"></span>
          <span class="prog-text">{section.chapter} · {section.label}</span>
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
          <div class="chapter-label {themeOf(section)}">{section.chapter} · {section.label}</div>
          {#if section.id === 'map-intro'}
            <StoryStepBody html={chapter2NarrativeContent} animate={true} contentKey={chapter2NarrativeStepId} />
          {:else}
            <StoryStepBody html={section.content} />
          {/if}
        </section>
      {/each}
    </div>
  </section>

  <div class="story-transition-strip">
    <p>The story above is the city's story.</p>
    <p>Now explore every tract.</p>
  </div>

  <section class="story-explorer-section" id={explorerSection.id}
    data-section-id={explorerSection.id} use:trackStep bind:this={explorerSectionEl}>
    <StoryExplorer {geoData} {ranges} {counts} {cityAverages} {holdingAverages} {flippingAverages} />
  </section>

  <footer class="story-footer">{@html FOOTER_CONTENT}</footer>
</article>

<style>
  :global(*:focus-visible) { outline: 2px solid var(--navy); outline-offset: 2px; }
  :global(html) { height: auto !important; overflow-x: hidden !important; overflow-y: auto !important; scroll-behavior: smooth; }
  :global(body) { height: auto !important; min-height: 100% !important; overflow: visible !important; }

  .story-page { min-height: 100vh; background: var(--bg); color: var(--ink); }

  /* ============================================================
     Dark cinematic opening with ambient gradient
     ============================================================ */
  .story-opening {
    display: grid; min-height: 100vh; place-items: center;
    padding: 48px 24px; text-align: center;
    background: #111110;
    color: #F2F0EA;
    animation: ambient-shift 20s ease-in-out infinite alternate;
  }

  @keyframes ambient-shift {
    0%   { background: radial-gradient(ellipse at 40% 50%, #161614, #0e0e0d); }
    100% { background: radial-gradient(ellipse at 60% 50%, #141413, #0e0e0d); }
  }

  .opening-inner { width: min(760px, 100%); }

  /* typographic cascade: small context, huge keyword, supporting question */
  .story-opening :global(.hero-above) {
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: clamp(14px, 2vw, 22px);
    font-weight: 500;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgba(242, 240, 234, 0.45);
    margin-bottom: 12px;
  }

  .story-opening :global(.hero-word) {
    font-family: "DM Serif Display", Georgia, serif;
    font-size: clamp(56px, 12vw, 110px);
    line-height: 0.9;
    color: var(--amber);
    margin-bottom: 14px;
  }

  .story-opening :global(.hero-below) {
    font-family: "DM Serif Display", Georgia, serif;
    font-size: clamp(22px, 4vw, 42px);
    line-height: 1.15;
    color: rgba(242, 240, 234, 0.8);
    margin-bottom: 36px;
  }

  .story-opening :global(.opening-stats) {
    display: flex; justify-content: center;
    gap: clamp(24px, 6vw, 60px);
    margin: 0 auto 32px; max-width: 540px;
  }

  .story-opening :global(.opening-stat) {
    flex: 1; text-align: center;
  }

  .story-opening :global(.stat-num) {
    font-family: "DM Serif Display", Georgia, serif;
    font-size: clamp(48px, 9vw, 72px);
    font-weight: 400; line-height: 1;
  }

  .story-opening :global(.stat-pct) {
    font-family: "DM Serif Display", Georgia, serif;
    font-size: clamp(24px, 4.5vw, 36px);
    font-weight: 400; opacity: 0.55;
    vertical-align: super;
  }

  .story-opening :global(.opening-stat-label) {
    display: block;
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: 13px; line-height: 1.5;
    color: rgba(242, 240, 234, 0.4);
    margin-top: 8px;
  }

  .story-opening :global(.opening-rule) {
    width: 48px; height: 1px;
    margin: 0 auto 24px;
    background: rgba(242, 240, 234, 0.15);
  }

  .story-opening :global(.scroll-subline) {
    max-width: 480px; margin: 0 auto 20px;
    color: rgba(242, 240, 234, 0.55);
    font-size: clamp(15px, 2vw, 20px); line-height: 1.55;
  }

  .story-opening :global(.scroll-byline) {
    color: rgba(242, 240, 234, 0.25);
    font-size: 11px; letter-spacing: 0.04em;
  }

  .story-opening :global(.scroll-cue-wrap) {
    margin-top: 48px; display: flex; flex-direction: column;
    align-items: center; gap: 8px;
  }

  .story-opening :global(.scroll-cue-text) {
    font-family: "IBM Plex Mono", monospace;
    font-size: 10px; color: rgba(242, 240, 234, 0.2);
    letter-spacing: 0.05em;
  }

  .story-opening :global(.scroll-cue-chevron) {
    color: rgba(242, 240, 234, 0.2);
    animation: cue-pulse 2.5s ease-in-out infinite;
  }

  @keyframes cue-pulse {
    0%, 100% { opacity: 0.2; transform: translateY(0); }
    50% { opacity: 0.8; transform: translateY(5px); }
  }

  .dark-to-warm { height: 140px; background: linear-gradient(to bottom, #111110, var(--bg)); }

  /* ============================================================
     Scrollytelling three-column grid
     ============================================================ */
  .story-scroll-region {
    --story-top-rail: 28px;
    display: grid;
    grid-template-columns: minmax(100px, 0.24fr) minmax(300px, 0.88fr) minmax(480px, 1.5fr);
    grid-template-areas: "progress text viz";
    align-items: start;
    gap: clamp(22px, 3vw, 56px);
    width: min(1440px, 100%);
    margin: 0 auto;
    padding: var(--story-top-rail) clamp(18px, 4vw, 64px) 14vh;
  }

  /* progress sidebar */
  .story-progress {
    position: sticky; top: var(--story-top-rail);
    height: calc(100vh - var(--story-top-rail));
    grid-area: progress; display: flex; flex-direction: column;
    justify-content: center; gap: 14px;
  }

  .story-progress a {
    display: flex; align-items: center; gap: 8px;
    color: var(--faint); font-size: 10px;
    text-decoration: none; transition: color 0.2s;
  }

  .prog-dot {
    width: 5px; height: 5px; border-radius: 50%;
    border: 1px solid var(--faint); flex-shrink: 0;
    transition: all 0.25s;
  }

  .prog-text {
    font-family: "IBM Plex Mono", monospace;
    font-size: 10px; white-space: nowrap;
  }

  .story-progress a.active { color: var(--ink); }
  .story-progress a.active .prog-dot { border-color: var(--ink); background: var(--ink); }
  .story-progress a.active.t-hold .prog-dot { border-color: var(--navy); background: var(--navy); }
  .story-progress a.active.t-flip .prog-dot { border-color: var(--amber); background: var(--amber); }

  /* text column */
  .story-text-column { grid-area: text; display: flex; flex-direction: column; }

  .story-step {
    display: flex; box-sizing: border-box;
    min-height: calc(100vh - var(--story-top-rail));
    flex-direction: column; justify-content: center;
    padding: clamp(18px, 4vh, 42px) 0;
  }

  .story-step.chapter-two-step :global(.story-copy) { min-height: clamp(280px, 34vh, 420px); }

  /* clean single-line chapter label: "01 · The Shift" */
  .chapter-label {
    margin-bottom: 16px;
    font-family: "IBM Plex Mono", monospace;
    font-size: 11px; font-weight: 500;
    letter-spacing: 0.03em;
    color: var(--faint);
  }

  .chapter-label.theme-hold { color: var(--navy); }
  .chapter-label.theme-flip { color: var(--amber-dark); }
  .chapter-label.theme-policy { color: var(--ink); }

  h2 {
    max-width: 520px; margin: 0 0 20px;
    font-family: "DM Serif Display", Georgia, serif;
    font-size: clamp(32px, 4vw, 50px); line-height: 1.06;
  }

  /* section takeaway pullquote with colored left accent */
  .story-step :global(.section-takeaway) {
    font-family: "DM Serif Display", Georgia, serif;
    font-size: 17px; line-height: 1.5; color: var(--ink);
    margin-top: 8px; margin-bottom: 0;
    padding-left: 14px; border-left: 3px solid var(--neutral);
  }

  /* equity stat callouts with separated percent sign */
  .story-step :global(.equity-stats) { display: flex; gap: 20px; margin: 12px 0 20px; }
  .story-step :global(.equity-stat) { flex: 1; text-align: center; }
  .story-step :global(.eq-num) {
    font-family: "DM Serif Display", Georgia, serif;
    font-size: 56px; font-weight: 400; line-height: 1;
  }
  .story-step :global(.eq-pct) {
    font-family: "DM Serif Display", Georgia, serif;
    font-size: 28px; font-weight: 400; opacity: 0.5;
    vertical-align: super;
  }
  .story-step :global(.equity-label) { display: block; font-size: 12px; color: var(--sub); margin-top: 6px; }

  /* policy callout boxes embedded in narrative */
  .story-step :global(.policy-callout) {
    padding: 14px 16px; border-radius: 6px;
    margin: 12px 0; border-left: 3px solid;
  }
  .story-step :global(.policy-callout strong) { display: block; font-size: 14px; margin-bottom: 4px; }
  .story-step :global(.policy-callout span) { font-size: 13px; color: var(--sub); line-height: 1.55; }
  .story-step :global(.policy-callout-hold) { border-color: var(--navy); background: rgba(27, 58, 92, 0.04); }
  .story-step :global(.policy-callout-hold strong) { color: var(--navy); }
  .story-step :global(.policy-callout-flip) { border-color: var(--amber); background: rgba(198, 139, 60, 0.04); }
  .story-step :global(.policy-callout-flip strong) { color: var(--amber-dark); }

  /* sticky viz column */
  .story-viz-column {
    position: sticky; top: var(--story-top-rail);
    grid-area: viz; align-self: start;
    display: flex; height: calc(100vh - var(--story-top-rail));
    align-items: center;
  }

  .sticky-stage { display: flex; width: 100%; height: 100%; align-items: center; }

  /* ============================================================
     Transition strip
     ============================================================ */
  .story-transition-strip {
    background: #111110; color: rgba(242, 240, 234, 0.5);
    text-align: center; padding: 64px 24px;
    font-family: "DM Serif Display", Georgia, serif;
    font-size: clamp(20px, 3vw, 28px); line-height: 1.5;
  }
  .story-transition-strip p { margin: 0; }

  /* ============================================================
     Explorer: full-bleed, immersive
     ============================================================ */
  .story-explorer-section {
    width: 100%; margin: 0 auto 0;
  }

  /* ============================================================
     Footer
     ============================================================ */
  .story-footer {
    border-top: 1px solid var(--rule); padding: 34px 24px 42px;
    background: #fff; color: var(--sub); text-align: center;
  }
  .story-footer :global(.project-footer) { max-width: 760px; margin: 0 auto; }
  .story-footer :global(p), .story-footer :global(div) { font-size: 12px; line-height: 1.65; }
  .story-footer :global(a) { color: var(--navy); font-weight: 700; }
  .story-footer :global(.footer-mapc) { font-size: 13px; font-weight: 600; margin-bottom: 18px; }
  .story-footer :global(.footer-sources) { margin-bottom: 18px; }
  .story-footer :global(.footer-source-heading) { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--faint); margin-bottom: 4px; }
  .story-footer :global(.footer-note) { margin-top: 6px; font-style: italic; color: var(--faint); }
  .story-footer :global(.footer-access) { margin-bottom: 14px; font-size: 11px; color: var(--faint); font-family: "IBM Plex Mono", monospace; }
  .story-footer :global(.footer-team) { font-size: 12px; font-weight: 600; color: var(--text); }

  /* ============================================================
     Responsive
     ============================================================ */
  @media (max-width: 1040px) {
    .story-scroll-region { grid-template-columns: minmax(280px, 0.9fr) minmax(420px, 1.1fr); grid-template-areas: "text viz"; }
    .story-progress { display: none; }
  }

  @media (max-width: 760px) {
    .story-scroll-region { display: block; gap: 0; padding: 0 0 8vh; }
    .story-viz-column { position: sticky; top: 0; z-index: 4; height: 46vh; background: var(--bg); box-shadow: 0 8px 18px rgba(25, 24, 22, 0.08); }
    .story-text-column { padding: 0 22px; }
    .sticky-stage { min-height: auto; }
    .story-step { min-height: 74vh; padding: 18vh 0; }
    h2 { font-size: 32px; }
    .story-explorer-section { width: 100%; }
    .story-transition-strip { font-size: 18px; padding: 40px 20px; }
    .dark-to-warm { height: 80px; }
    .story-step :global(.eq-num) { font-size: 40px; }
    .story-step :global(.eq-pct) { font-size: 20px; }
    .story-opening :global(.hero-word) { font-size: 64px; }
    .story-opening :global(.stat-num) { font-size: 48px; }
    .story-opening :global(.stat-pct) { font-size: 24px; }
  }
</style>
