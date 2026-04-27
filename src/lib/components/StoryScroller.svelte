<script>
  /* StoryScroller orchestrates the entire narrative.
   *
   * Three new mechanisms layered on top of the existing wheel-snap
   * machinery:
   *
   *   1. Per-section scroll progress, computed on every passive scroll
   *      from getBoundingClientRect. Routed to charts so the line
   *      drawing follows the wheel.
   *
   *   2. A counter system. Any [data-count-target] element tweens
   *      from zero on first scroll into view, optionally with prefix
   *      suffix and delay attributes.
   *
   *   3. Page background switching. The active section's id matches
   *      one of three sets (dark, amber, white) and a class flips on
   *      .story-page; a 600ms transition crossfades both background
   *      and inherited text colors.
   *
   * The wheel-snap, IntersectionObserver, and scroll-restoration logic
   * is preserved verbatim from the baseline. Adding to it, never
   * touching it. */

  import { onMount } from 'svelte';
  import { NARRATIVE_SECTIONS, FOOTER_CONTENT } from '$lib/narrativeSections';
  import { loadTractProfileData } from '$lib/mapData';
  import StoryStage from '$lib/components/StoryStage.svelte';
  import StoryExplorer from '$lib/components/StoryExplorer.svelte';
  import StoryStepBody from '$lib/components/StoryStepBody.svelte';

  const openingSection = NARRATIVE_SECTIONS.find((s) => s.layout === 'fullscreen');
  const storySteps = NARRATIVE_SECTIONS.filter((s) => s.layout === 'split');
  /* map-classified shares its narrative slot with map-intro, so the
   * rendered list of step cards skips it. The wheel handler still
   * tracks it as a logical step. */
  const renderedStorySteps = storySteps.filter((s) => s.id !== 'map-classified');
  const explorerSection = NARRATIVE_SECTIONS.find((s) => s.layout === 'explorer');
  const mapIntroStep = storySteps.find((s) => s.id === 'map-intro');
  const progressSections = NARRATIVE_SECTIONS.filter(
    (s) => s.layout !== 'fullscreen' && s.id !== 'map-classified'
  );

  /* Sections that change the page background. */
  const DARK_SECTIONS = new Set(['regime-shift', 'price-wedge']);
  const AMBER_SECTIONS = new Set(['equity']);
  const WHITE_SECTIONS = new Set(['policy']);

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

  /* Per-section scroll progress, computed on every scroll. */
  let sectionProgress = {};

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

  $: isDarkSection = DARK_SECTIONS.has(activeId);
  $: isAmberSection = AMBER_SECTIONS.has(activeId);
  $: isWhiteSection = WHITE_SECTIONS.has(activeId);

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
          var next = { ...storyStepNodes };
          delete next[sid];
          storyStepNodes = next;
        }
      }
    };
  }

  function isWide() { return typeof window !== 'undefined' && window.innerWidth > 760; }
  function inView(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  }
  function storyStepMode() {
    return storyRegionEl && storyRegionEl.getBoundingClientRect().top <= STORY_TOP_RAIL_PX;
  }
  function explorerAtTop() {
    return explorerSectionEl && explorerSectionEl.getBoundingClientRect().top >= -12;
  }

  /* Compute scroll progress per section.
   * progress = 0 when section top sits at 60% of viewport height.
   * progress = 1 when section top reaches the sticky rail.
   * Beyond the rail, progress stays at 1 so charts stay drawn as the
   * reader scrolls into the next section. */
  function recomputeProgress() {
    if (typeof window === 'undefined') return;
    const vh = window.innerHeight;
    const triggerStart = vh * 0.6;
    const triggerEnd = STORY_TOP_RAIL_PX;
    const range = triggerStart - triggerEnd;
    if (range <= 0) return;

    const next = {};
    for (const id in storyStepNodes) {
      const node = storyStepNodes[id];
      if (!node) continue;
      const top = node.getBoundingClientRect().top;
      let p = (triggerStart - top) / range;
      if (p < 0) p = 0;
      else if (p > 1) p = 1;
      next[id] = p;
    }
    sectionProgress = next;
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

  function scrollToStep(tEl, tId) {
    tId = tId || '';
    if (!tEl) return;
    var isStep = tId && storySteps.some((s) => s.id === tId);
    if (isStep) activateStep(tId);
    else {
      isStepTransitioning = true;
      window.clearTimeout(stepTransitionTimer);
      stepTransitionTimer = window.setTimeout(() => { isStepTransitioning = false; }, STEP_SCROLL_COOLDOWN_MS);
    }
    if (isWide() && isStep) {
      var top = window.scrollY + tEl.getBoundingClientRect().top - STORY_TOP_RAIL_PX;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      return;
    }
    tEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function queueWheelReset() {
    window.clearTimeout(wheelGestureResetTimer);
    wheelGestureResetTimer = window.setTimeout(() => { wheelGestureConsumed = false; }, WHEEL_GESTURE_IDLE_MS);
  }

  function handleWheel(event) {
    if (!isWide() || event.ctrlKey) return;
    if (Date.now() < wheelGuardUntil) return;
    var ov = inView(openingSectionEl), sv = inView(storyRegionEl), sm = storyStepMode(), ev = inView(explorerSectionEl);
    if (!ov && !sv && !ev) return;
    if (isStepTransitioning || wheelGestureConsumed) {
      event.preventDefault();
      queueWheelReset();
      return;
    }
    if (event.deltaY === 0) return;
    var dir = event.deltaY > 0 ? 1 : -1;
    var ref = stepCursorId || activeId;
    var idx = storySteps.findIndex((s) => s.id === ref);
    var tEl = null, tId = '';
    if (dir > 0) {
      if (ov && !sm) {
        tEl = storyStepNodes[storySteps[0]?.id];
        tId = storySteps[0]?.id ?? '';
      } else {
        if (!sv || !sm) return;
        if (ref === 'map-intro') {
          event.preventDefault();
          wheelGestureConsumed = true;
          queueWheelReset();
          activateStep('map-classified');
          return;
        }
        if (idx >= 0 && idx < storySteps.length - 1) {
          tId = storySteps[idx + 1]?.id ?? '';
          tEl = storyStepNodes[tId];
        } else if (idx === storySteps.length - 1) {
          if (ev) return;
          tEl = explorerSectionEl;
        }
      }
    } else {
      if (ev) {
        if (!explorerAtTop()) return;
        tId = storySteps[storySteps.length - 1]?.id ?? '';
        tEl = storyStepNodes[tId];
      } else if (ref === 'map-classified') {
        event.preventDefault();
        wheelGestureConsumed = true;
        queueWheelReset();
        activateStep('map-intro');
        return;
      } else if (idx > 0) {
        tId = storySteps[idx - 1]?.id ?? '';
        tEl = storyStepNodes[tId];
        if (!tEl && tId === 'map-classified') tEl = storyStepNodes['map-intro'];
      } else if (idx === 0) {
        tEl = openingSectionEl;
      }
    }
    if (!tEl) return;
    event.preventDefault();
    wheelGestureConsumed = true;
    queueWheelReset();
    scrollToStep(tEl, tId);
  }

  /* Counter system. Any element with data-count-target tweens from
   * zero up to the target the first time it scrolls into view. The
   * opening's +49 and 25 fire after a 1400ms delay to align with the
   * entrance choreography. Section 04's 87 and 34 fire on intersection. */
  let counterObserver = null;

  function animateCount(el, target, opts) {
    opts = opts || {};
    var duration = opts.duration || 1200;
    var prefix = opts.prefix || '';
    var suffix = opts.suffix || '';
    var delay = opts.delay || 0;
    var startAt = performance.now() + delay;

    function frame(now) {
      if (now < startAt) {
        requestAnimationFrame(frame);
        return;
      }
      var t = (now - startAt) / duration;
      if (t > 1) t = 1;
      var eased = 1 - Math.pow(1 - t, 3);
      var v = Math.round(target * eased);
      el.textContent = prefix + v + suffix;
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function setupCounters() {
    if (typeof window === 'undefined') return;
    var els = document.querySelectorAll('[data-count-target]');
    if (els.length === 0) return;

    counterObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        if (el.dataset.counted === 'true') return;
        el.dataset.counted = 'true';
        var target = parseFloat(el.dataset.countTarget);
        var prefix = el.dataset.countPrefix || '';
        var suffix = el.dataset.countSuffix || '';
        var duration = parseInt(el.dataset.countDuration, 10) || 1200;
        var delay = parseInt(el.dataset.countDelay, 10) || 0;
        animateCount(el, target, { prefix: prefix, suffix: suffix, duration: duration, delay: delay });
      });
    }, { threshold: 0.45 });

    els.forEach(function (el) { counterObserver.observe(el); });
  }

  /* Pre-load chart JSON files in parallel with the GeoJSON. By the
   * time the reader scrolls past the opening, every dataset is already
   * cached. The persistent chart components read the same URLs and
   * find them instantly. */
  function preloadChartData() {
    if (typeof fetch === 'undefined') return;
    fetch('data/investor_share_yearly.json').catch(function () {});
    fetch('data/price_wedge_yearly.json').catch(function () {});
    fetch('data/neighborhood_temporal_metrics.json').catch(function () {});
  }

  async function loadData() {
    try {
      var ld = await loadTractProfileData();
      counts = ld.counts;
      ranges = ld.ranges;
      cityAverages = ld.cityAverages;
      holdingAverages = ld.holdingAverages;
      flippingAverages = ld.flippingAverages;
      geoData = ld.geoData;
    } catch (e) {
      console.error('Could not load story data:', e);
      loadError = 'Could not load data.';
    }
  }

  onMount(() => {
    preloadChartData();
    loadData();

    if (typeof history !== 'undefined' && 'scrollRestoration' in history) {
      previousScrollRestoration = history.scrollRestoration;
      history.scrollRestoration = 'manual';
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    requestAnimationFrame(() => { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }); });

    wheelGuardUntil = Date.now() + INITIAL_WHEEL_GUARD_MS;

    observer = new IntersectionObserver((entries) => {
      var vis = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (vis?.target?.dataset?.sectionId) {
        var oid = vis.target.dataset.sectionId;
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
    window.addEventListener('scroll', recomputeProgress, { passive: true });
    window.addEventListener('resize', recomputeProgress, { passive: true });

    /* Initial measurement after the next paint, when story step cards
     * have their final layout dimensions. */
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        recomputeProgress();
        setupCounters();
      });
    });

    return () => {
      observer?.disconnect();
      counterObserver?.disconnect();
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('scroll', recomputeProgress);
      window.removeEventListener('resize', recomputeProgress);
      window.clearTimeout(stepTransitionTimer);
      window.clearTimeout(wheelGestureResetTimer);
      if (typeof history !== 'undefined' && 'scrollRestoration' in history && previousScrollRestoration) {
        history.scrollRestoration = previousScrollRestoration;
      }
    };
  });
</script>

<svelte:head><title>Speculation Has a Geography</title></svelte:head>

<article class="story-page"
  class:bg-dark={isDarkSection}
  class:bg-amber={isAmberSection}
  class:bg-white={isWhiteSection}>

  <section class="story-opening" id={openingSection.id} bind:this={openingSectionEl}>
    <div class="opening-inner">{@html openingSection.content}</div>
  </section>

  <div class="dark-to-warm"></div>

  <section class="story-scroll-region" bind:this={storyRegionEl} aria-label="Scrollytelling narrative">
    <!-- Vertical timeline progress sidebar.
         Thin rail with dots per section. The active dot grows and
         takes the section theme color. Text appears on hover for
         accessibility. -->
    <nav class="story-progress" aria-label="Story sections">
      <span class="progress-rail" aria-hidden="true"></span>
      {#each progressSections as section}
        <a href={'#' + section.id}
          class="progress-dot-link"
          class:active={activeChapter === section.chapter}
          class:t-hold={section.theme === 'hold'}
          class:t-flip={section.theme === 'flip'}
          class:t-policy={section.theme === 'policy'}
          aria-label="{section.chapter} {section.label}"
          title="{section.chapter} · {section.label}">
          <span class="prog-dot"></span>
          <span class="prog-text">{section.chapter} · {section.label}</span>
        </a>
      {/each}
    </nav>

    <div class="story-viz-column" aria-live="polite">
      <div class="sticky-stage">
        <StoryStage
          {activeSection}
          {geoData}
          {ranges}
          {counts}
          {loadError}
          {sectionProgress} />
      </div>
    </div>

    <div class="story-text-column">
      {#each renderedStorySteps as section}
        <section class="story-step"
          class:chapter-two-step={section.id === 'map-intro'}
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
    <div class="transition-inner">
      <p>The story above is the city's story.</p>
      <p>Now explore every tract.</p>
    </div>
  </div>

  <section class="story-explorer-section" id={explorerSection.id}
    data-section-id={explorerSection.id} use:trackStep bind:this={explorerSectionEl}>
    <StoryExplorer {geoData} {ranges} {counts} {cityAverages} {holdingAverages} {flippingAverages} />
  </section>

  <footer class="story-footer">{@html FOOTER_CONTENT}</footer>
</article>

<style>
  :global(*:focus-visible) { outline: 2px solid var(--navy); outline-offset: 2px; }
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

  /* The page background shifts between cream, dark, amber tinted, and
   * white based on the active section. Smooth, slow transition makes
   * each section feel like a new room. */
  .story-page {
    min-height: 100vh;
    background: var(--bg);
    color: var(--ink);
    transition: background-color 600ms cubic-bezier(0.4, 0, 0.2, 1),
                color 600ms cubic-bezier(0.4, 0, 0.2, 1);
  }
  .story-page.bg-dark { background: #0F0F0E; }
  .story-page.bg-amber { background: #F5EDDC; }
  .story-page.bg-white { background: #FFFFFF; }

  /* On dark sections, body text shifts to cream. */
  .story-page.bg-dark :global(.story-step h2),
  .story-page.bg-dark :global(.story-copy) :global(h2) {
    color: #F2F0EA;
    transition: color 600ms cubic-bezier(0.4, 0, 0.2, 1);
  }
  .story-page.bg-dark :global(.story-copy) :global(p),
  .story-page.bg-dark :global(.story-copy) :global(li) {
    color: rgba(242, 240, 234, 0.78);
  }
  .story-page.bg-dark :global(.story-copy) :global(strong) { color: #F2F0EA; }
  .story-page.bg-dark :global(.section-takeaway) {
    color: rgba(242, 240, 234, 0.92) !important;
    border-left-color: var(--amber) !important;
  }
  .story-page.bg-dark :global(.human-sentence) { color: rgba(242, 240, 234, 0.85) !important; }
  .story-page.bg-dark .chapter-label { color: rgba(242, 240, 234, 0.45); }
  .story-page.bg-dark .chapter-label.theme-hold { color: #8AAEC8; }
  .story-page.bg-dark .chapter-label.theme-flip { color: var(--amber-mid); }

  /* On the white policy section, ink-dark accent. */
  .story-page.bg-white :global(.section-takeaway) {
    color: var(--ink) !important;
    border-left-color: var(--ink) !important;
  }

  /* ============================================================
     Dark cinematic opening with ambient gradient drift
     ============================================================ */
  .story-opening {
    position: relative;
    display: grid;
    min-height: 100vh;
    place-items: center;
    padding: 48px 24px;
    text-align: center;
    background: #0F0F0E;
    color: #F2F0EA;
    overflow: hidden;
  }

  /* Pseudo-element holds a fixed radial gradient. We animate its
   * transform (translate) instead of trying to interpolate gradient
   * stops, which CSS does not do smoothly. The gradient drifts in a
   * slow elliptical cycle, never quite repeating. */
  .story-opening::before {
    content: '';
    position: absolute;
    inset: -22%;
    background:
      radial-gradient(ellipse at 50% 50%,
        rgba(78, 60, 38, 0.22) 0%,
        rgba(78, 60, 38, 0.08) 30%,
        transparent 65%);
    pointer-events: none;
    will-change: transform;
    animation: ambient-drift 28s ease-in-out infinite alternate;
  }
  @keyframes ambient-drift {
    0%   { transform: translate(-9%, -4%); }
    100% { transform: translate(9%, 4%); }
  }

  .opening-inner { width: min(820px, 100%); position: relative; z-index: 1; }

  .story-opening :global(.hero-stack) {
    display: flex; flex-direction: column; align-items: center;
  }

  .story-opening :global(.hero-above) {
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: clamp(13px, 1.6vw, 18px);
    font-weight: 500;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(242, 240, 234, 0.45);
    margin-bottom: 14px;
    opacity: 0;
    animation: open-fade 700ms cubic-bezier(0.16, 1, 0.3, 1) 0ms forwards;
    will-change: opacity;
  }

  /* Hero row: left quote, the word, right quote on one line. The
   * quotes are tinted way down so the word dominates. */
  .story-opening :global(.hero-row) {
    display: flex; align-items: baseline; justify-content: center;
    gap: 0;
    margin-bottom: 16px;
  }

  .story-opening :global(.hero-quote) {
    font-family: "DM Serif Display", Georgia, serif;
    font-size: clamp(64px, 13vw, 120px);
    line-height: 0.9;
    color: rgba(242, 240, 234, 0.32);
    opacity: 0;
    animation: open-fade 800ms cubic-bezier(0.16, 1, 0.3, 1) 400ms forwards;
    will-change: opacity;
  }
  .story-opening :global(.hero-quote-l) { margin-right: 4px; }
  .story-opening :global(.hero-quote-r) { margin-left: 4px; }

  .story-opening :global(.hero-word) {
    font-family: "DM Serif Display", Georgia, serif;
    font-size: clamp(58px, 12vw, 112px);
    line-height: 0.9;
    color: var(--amber);
    opacity: 0;
    transform: scale(1.05);
    animation: open-word-in 900ms cubic-bezier(0.16, 1, 0.3, 1) 600ms forwards;
    will-change: opacity, transform;
  }
  @keyframes open-word-in {
    to { opacity: 1; transform: scale(1); }
  }

  .story-opening :global(.hero-below) {
    font-family: "DM Serif Display", Georgia, serif;
    font-size: clamp(22px, 4vw, 42px);
    line-height: 1.18;
    color: rgba(242, 240, 234, 0.82);
    margin-bottom: 40px;
    opacity: 0;
    animation: open-fade 800ms cubic-bezier(0.16, 1, 0.3, 1) 1000ms forwards;
    will-change: opacity;
  }

  .story-opening :global(.opening-stats) {
    display: flex; justify-content: center;
    gap: clamp(24px, 6vw, 64px);
    margin: 0 auto 32px; max-width: 580px;
    opacity: 0;
    animation: open-fade 700ms cubic-bezier(0.16, 1, 0.3, 1) 1400ms forwards;
    will-change: opacity;
  }
  .story-opening :global(.opening-stat) {
    flex: 1; text-align: center;
  }
  .story-opening :global(.stat-figure) {
    display: inline-flex; align-items: baseline; justify-content: center;
  }
  .story-opening :global(.stat-num) {
    font-family: "DM Serif Display", Georgia, serif;
    font-size: clamp(48px, 9vw, 76px);
    font-weight: 400; line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .story-opening :global(.stat-pct) {
    font-family: "DM Serif Display", Georgia, serif;
    font-size: clamp(24px, 4.5vw, 38px);
    font-weight: 400; opacity: 0.55;
    margin-left: 2px;
    align-self: flex-start;
  }
  .story-opening :global(.opening-stat-label) {
    display: block;
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: 13px; line-height: 1.55;
    color: rgba(242, 240, 234, 0.45);
    margin-top: 10px;
    max-width: 220px;
    margin-inline: auto;
  }

  .story-opening :global(.opening-rule) {
    width: 56px; height: 1px;
    margin: 0 auto 22px;
    background: rgba(242, 240, 234, 0.18);
    transform-origin: center;
    transform: scaleX(0);
    animation: open-rule 700ms cubic-bezier(0.16, 1, 0.3, 1) 2200ms forwards;
    will-change: transform;
  }
  @keyframes open-rule {
    to { transform: scaleX(1); }
  }

  .story-opening :global(.scroll-subline) {
    max-width: 520px; margin: 0 auto 22px;
    color: rgba(242, 240, 234, 0.62);
    font-size: clamp(15px, 2vw, 20px); line-height: 1.55;
    opacity: 0;
    animation: open-fade 800ms cubic-bezier(0.16, 1, 0.3, 1) 2600ms forwards;
    will-change: opacity;
  }
  .story-opening :global(.scroll-byline) {
    color: rgba(242, 240, 234, 0.32);
    font-size: 11px; letter-spacing: 0.06em;
    opacity: 0;
    animation: open-fade 700ms cubic-bezier(0.16, 1, 0.3, 1) 2800ms forwards;
    will-change: opacity;
  }
  .story-opening :global(.scroll-cue-wrap) {
    margin-top: 50px;
    display: flex; flex-direction: column;
    align-items: center; gap: 8px;
    opacity: 0;
    animation: open-fade 700ms cubic-bezier(0.16, 1, 0.3, 1) 3000ms forwards;
    will-change: opacity;
  }
  .story-opening :global(.scroll-cue-text) {
    font-family: "IBM Plex Mono", monospace;
    font-size: 10px; color: rgba(242, 240, 234, 0.28);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .story-opening :global(.scroll-cue-chevron) {
    color: rgba(242, 240, 234, 0.32);
    animation: cue-pulse 2.4s ease-in-out infinite;
  }
  @keyframes open-fade { to { opacity: 1; } }
  @keyframes cue-pulse {
    0%, 100% { opacity: 0.28; transform: translateY(0); }
    50%      { opacity: 0.85; transform: translateY(5px); }
  }

  /* Soft transition strip from the dark opening into the cream
   * scroll region. */
  .dark-to-warm {
    height: 140px;
    background: linear-gradient(to bottom, #0F0F0E, var(--bg));
  }
  .story-page.bg-dark .dark-to-warm {
    background: linear-gradient(to bottom, #0F0F0E, #0F0F0E);
  }

  /* ============================================================
     Scrollytelling three-column grid
     ============================================================ */
  .story-scroll-region {
    --story-top-rail: 28px;
    display: grid;
    grid-template-columns: minmax(80px, 0.16fr) minmax(300px, 0.84fr) minmax(540px, 1.6fr);
    grid-template-areas: "progress text viz";
    align-items: start;
    gap: clamp(22px, 3vw, 60px);
    width: min(1500px, 100%);
    margin: 0 auto;
    padding: var(--story-top-rail) clamp(18px, 4vw, 64px) 14vh;
  }

  /* Vertical timeline: thin rail, dots, no text labels by default.
   * The active dot grows. Text fades in on hover for accessibility. */
  .story-progress {
    position: sticky;
    top: var(--story-top-rail);
    height: calc(100vh - var(--story-top-rail));
    grid-area: progress;
    display: flex; flex-direction: column;
    justify-content: center;
    gap: 22px;
    padding-left: 8px;
  }

  .story-progress .progress-rail {
    position: absolute;
    left: 13px; top: 18%; bottom: 18%;
    width: 1px;
    background: rgba(120, 115, 105, 0.22);
  }
  .story-page.bg-dark .story-progress .progress-rail {
    background: rgba(242, 240, 234, 0.16);
  }

  .progress-dot-link {
    position: relative;
    display: flex; align-items: center; gap: 10px;
    color: rgba(120, 115, 105, 0.75);
    font-size: 10px;
    text-decoration: none;
    transition: color 0.25s;
  }

  .prog-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: rgba(120, 115, 105, 0.32);
    flex-shrink: 0;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    margin-left: 3px;
    will-change: transform, background-color;
  }

  .prog-text {
    font-family: "IBM Plex Mono", monospace;
    font-size: 10px;
    white-space: nowrap;
    opacity: 0;
    transform: translateX(-4px);
    transition: opacity 0.2s, transform 0.2s;
  }
  .progress-dot-link:hover .prog-text,
  .progress-dot-link.active .prog-text {
    opacity: 1; transform: translateX(0);
  }

  .progress-dot-link.active .prog-dot {
    transform: scale(1.45);
    background: var(--ink);
  }
  .progress-dot-link.active.t-hold .prog-dot { background: var(--navy); }
  .progress-dot-link.active.t-flip .prog-dot { background: var(--amber); }
  .progress-dot-link.active.t-policy .prog-dot { background: var(--ink); }
  .progress-dot-link.active { color: var(--ink); }

  .story-page.bg-dark .progress-dot-link { color: rgba(242, 240, 234, 0.45); }
  .story-page.bg-dark .prog-dot { background: rgba(242, 240, 234, 0.32); }
  .story-page.bg-dark .progress-dot-link.active { color: rgba(242, 240, 234, 0.95); }
  .story-page.bg-dark .progress-dot-link.active .prog-dot { background: #F2F0EA; }
  .story-page.bg-dark .progress-dot-link.active.t-hold .prog-dot { background: #8AAEC8; }
  .story-page.bg-dark .progress-dot-link.active.t-flip .prog-dot { background: var(--amber-mid); }

  /* Text column */
  .story-text-column { grid-area: text; display: flex; flex-direction: column; }

  .story-step {
    display: flex; box-sizing: border-box;
    min-height: calc(100vh - var(--story-top-rail));
    flex-direction: column; justify-content: center;
    padding: clamp(18px, 4vh, 42px) 0;
  }
  .story-step.chapter-two-step :global(.story-copy) {
    min-height: clamp(280px, 34vh, 420px);
  }

  .chapter-label {
    margin-bottom: 16px;
    font-family: "IBM Plex Mono", monospace;
    font-size: 11px; font-weight: 500;
    letter-spacing: 0.04em;
    color: var(--faint);
    transition: color 600ms cubic-bezier(0.4, 0, 0.2, 1);
  }
  .chapter-label.theme-hold { color: var(--navy); }
  .chapter-label.theme-flip { color: var(--amber-dark); }
  .chapter-label.theme-policy { color: var(--ink); }

  /* Section takeaway: serif pullquote with extra breathing room. The
   * sentence deserves silence around it. */
  .story-step :global(.section-takeaway) {
    font-family: "DM Serif Display", Georgia, serif;
    font-size: 19px; line-height: 1.5; color: var(--ink);
    margin: 22px 0 0;
    padding: 4px 0 4px 16px;
    border-left: 3px solid var(--neutral);
    transition: color 600ms cubic-bezier(0.4, 0, 0.2, 1),
                border-left-color 600ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Human sentence (Section 04). Slightly larger serif, generous
   * whitespace, no border. Grounds the statistics in lived experience. */
  .story-step :global(.human-sentence) {
    font-family: "DM Serif Display", Georgia, serif;
    font-size: 17px;
    line-height: 1.6;
    color: var(--text);
    margin: 22px 0 6px;
    padding: 0;
    max-width: 540px;
  }

  /* Equity stat callouts with separated percent sign. */
  .story-step :global(.equity-stats) {
    display: flex; gap: 20px; margin: 12px 0 20px;
  }
  .story-step :global(.equity-stat) { flex: 1; text-align: center; }
  .story-step :global(.eq-num) {
    font-family: "DM Serif Display", Georgia, serif;
    font-size: 56px; font-weight: 400; line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .story-step :global(.eq-pct) {
    font-family: "DM Serif Display", Georgia, serif;
    font-size: 28px; font-weight: 400; opacity: 0.5;
    vertical-align: super;
  }
  .story-step :global(.equity-label) {
    display: block; font-size: 12px; color: var(--sub); margin-top: 6px;
  }

  /* Policy callout boxes embedded in narrative. */
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

  /* Sticky viz column */
  .story-viz-column {
    position: sticky; top: var(--story-top-rail);
    grid-area: viz; align-self: start;
    display: flex; height: calc(100vh - var(--story-top-rail));
    align-items: center;
  }
  .sticky-stage { display: flex; width: 100%; height: 100%; align-items: center; }

  /* ============================================================
     Transition strip: full viewport height, dark, contemplative
     ============================================================ */
  .story-transition-strip {
    background: #0F0F0E;
    color: rgba(242, 240, 234, 0.7);
    text-align: center;
    min-height: 60vh;
    display: grid; place-items: center;
    padding: clamp(60px, 12vh, 140px) 24px;
    font-family: "DM Serif Display", Georgia, serif;
    font-size: clamp(22px, 3.2vw, 32px);
    line-height: 1.45;
  }
  .transition-inner { max-width: 720px; }
  .story-transition-strip p { margin: 0; }
  .story-transition-strip p + p { margin-top: 14px; color: rgba(242, 240, 234, 0.45); }

  /* ============================================================
     Explorer: full bleed
     ============================================================ */
  .story-explorer-section {
    width: 100%; margin: 0 auto;
  }

  /* ============================================================
     Footer
     ============================================================ */
  .story-footer {
    border-top: 1px solid var(--rule); padding: 36px 24px 44px;
    background: #fff; color: var(--sub); text-align: center;
  }
  .story-footer :global(.project-footer) { max-width: 760px; margin: 0 auto; }
  .story-footer :global(p), .story-footer :global(div) { font-size: 12px; line-height: 1.65; }
  .story-footer :global(a) { color: var(--navy); font-weight: 700; }
  .story-footer :global(.footer-mapc) { font-size: 13px; font-weight: 600; margin-bottom: 18px; }
  .story-footer :global(.footer-sources) { margin-bottom: 18px; }
  .story-footer :global(.footer-source-heading) {
    font-size: 10px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.08em;
    color: var(--faint); margin-bottom: 4px;
  }
  .story-footer :global(.footer-note) { margin-top: 6px; font-style: italic; color: var(--faint); }
  .story-footer :global(.footer-access) {
    margin-bottom: 14px; font-size: 11px; color: var(--faint);
    font-family: "IBM Plex Mono", monospace;
  }
  .story-footer :global(.footer-team) { font-size: 12px; font-weight: 600; color: var(--text); }

  /* ============================================================
     Responsive
     ============================================================ */
  @media (max-width: 1040px) {
    .story-scroll-region {
      grid-template-columns: minmax(280px, 0.9fr) minmax(420px, 1.1fr);
      grid-template-areas: "text viz";
    }
    .story-progress { display: none; }
  }

  @media (max-width: 760px) {
    .story-scroll-region {
      display: block; gap: 0; padding: 0 0 8vh;
    }
    .story-viz-column {
      position: sticky; top: 0; z-index: 4;
      height: 46vh; background: var(--bg);
      box-shadow: 0 8px 18px rgba(25, 24, 22, 0.08);
    }
    .story-page.bg-dark .story-viz-column { background: #0F0F0E; }
    .story-text-column { padding: 0 22px; }
    .sticky-stage { min-height: auto; }
    .story-step { min-height: 74vh; padding: 18vh 0; }
    .story-explorer-section { width: 100%; }
    .story-transition-strip { font-size: 19px; padding: 60px 22px; min-height: 50vh; }
    .dark-to-warm { height: 80px; }
    .story-step :global(.eq-num) { font-size: 40px; }
    .story-step :global(.eq-pct) { font-size: 20px; }
  }
</style>
