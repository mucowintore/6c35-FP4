<script>
  /* StoryScroller orchestrates the entire narrative.
   *
   * Three things this component owns:
   *
   *   1. Wheel-snap scrolling between sections, with a brief cooldown
   *      after each transition so the browser does not chain a second
   *      step into the same gesture.
   *
   *   2. The counter system. Elements with data-count-target tween from
   *      zero, and reset when the section scrolls out of view so a
   *      re-entry plays the count again. Opening counters are fired on
   *      a deterministic timer keyed to the entrance choreography;
   *      everything else uses an IntersectionObserver.
   *
   *   3. Page background, progress sidebar, skip-to-content anchor,
   *      and aria-current wiring. */

  import { onMount } from 'svelte';
  import { NARRATIVE_SECTIONS, FOOTER_CONTENT, STORY_OUTRO } from '$lib/narrativeSections';
  import { loadTractProfileData } from '$lib/mapData';
  import StoryStage from '$lib/components/StoryStage.svelte';
  import StoryExplorer from '$lib/components/StoryExplorer.svelte';
  import StoryStepBody from '$lib/components/StoryStepBody.svelte';

  const openingSection = NARRATIVE_SECTIONS.find((s) => s.layout === 'fullscreen');
  const storySteps = NARRATIVE_SECTIONS.filter((s) => s.layout === 'split');
  /* map-classified shares its narrative slot with map-intro. The
   * rendered card list skips it; the wheel handler still tracks it
   * as a logical step. */
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

  /* activeId starts null on cold load. The observer only flips it
   * once the reader has actually scrolled into a step. Until then,
   * StoryStage's per-layer viewport observer is the source of truth
   * for which chart, if any, is on screen. */
  let activeId = null;
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
  let stepCursorId = null;
  let activeLockUntil = 0;
  let chapter2NarrativeStepId = 'map-intro';

  const STEP_SCROLL_COOLDOWN_MS = 640;
  const WHEEL_GESTURE_IDLE_MS = 320;
  /* Cinematic pause after the opening choreography settles before
   * scroll is allowed to move the reader off the title screen. */
  const INITIAL_WHEEL_GUARD_MS = 1300;
  const ACTIVE_LOCK_MS = 950;
  const STORY_TOP_RAIL_PX = 28;

  /* The opening counters are gated on the parent fade-in completing.
   * The choreography fades .opening-thesis at 1400 ms; we start the
   * counters at 1700 ms so the tween runs while the element is fully
   * visible, never during a fade. */
  const OPENING_COUNTERS_FIRE_MS = 1700;

  let geoData = null;
  let ranges = {};
  let cityAverages = {};
  let holdingAverages = {};
  let flippingAverages = {};
  let counts = { holdCount: 0, flipCount: 0, mixedCount: 0, lowDataCount: 0 };
  let loadError = '';

  $: activeSection = activeId
    ? storySteps.find((s) => s.id === activeId)
    : null;
  $: activeChapter = activeId
    ? NARRATIVE_SECTIONS.find((s) => s.id === activeId)?.chapter
    : null;
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
    var idx = ref ? storySteps.findIndex((s) => s.id === ref) : -1;
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

  /* Counter system.
   *
   * Two paths share one tween. Opening counters fire on a single
   * deterministic timer because the parent fade-in is a known
   * duration; observing them with an IntersectionObserver fires too
   * early and the count would tween while the element is still
   * invisible. Non-opening counters use an observer with a higher
   * threshold and a getComputedStyle opacity gate inside the first
   * frame, so the tween cannot start while the element is faded out. */
  let counterObserver = null;

  function animateCount(el, target, opts) {
    opts = opts || {};
    var duration = opts.duration || 1200;
    var prefix = opts.prefix || '';
    var suffix = opts.suffix || '';
    var delay = opts.delay || 0;
    var startAt = performance.now() + delay;
    var token = (el._countToken || 0) + 1;
    el._countToken = token;
    var visibilityChecked = false;

    function frame(now) {
      if (el._countToken !== token) return;

      if (now < startAt) {
        requestAnimationFrame(frame);
        return;
      }

      /* On the first eligible frame, verify the element is actually
       * visible. If a parent is still fading, defer one frame. */
      if (!visibilityChecked) {
        try {
          var op = parseFloat(getComputedStyle(el).opacity || '1');
          if (op <= 0.05) {
            requestAnimationFrame(frame);
            return;
          }
        } catch (e) { /* getComputedStyle can throw on detached nodes */ }
        visibilityChecked = true;
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

  function resetCounter(el) {
    var prefix = el.dataset.countPrefix || '';
    var suffix = el.dataset.countSuffix || '';
    el.textContent = prefix + '0' + suffix;
    el._countToken = (el._countToken || 0) + 1;
    delete el.dataset.counted;
  }

  function fireCounter(el) {
    if (el.dataset.counted === 'true') return;
    el.dataset.counted = 'true';
    var target = parseFloat(el.dataset.countTarget);
    var prefix = el.dataset.countPrefix || '';
    var suffix = el.dataset.countSuffix || '';
    var duration = parseInt(el.dataset.countDuration, 10) || 1200;
    var delay = parseInt(el.dataset.countDelay, 10) || 0;
    animateCount(el, target, { prefix: prefix, suffix: suffix, duration: duration, delay: delay });
  }

  function setupCounters() {
    if (typeof window === 'undefined' || !openingSectionEl) return;

    /* Opening counters: timer-driven. The element's data-count-delay
     * is absolute, measured from now, so each opening counter fires
     * on its own schedule once the entrance choreography settles. */
    var openingCounters = openingSectionEl.querySelectorAll('[data-count-target]');
    window.setTimeout(function () {
      openingCounters.forEach(function (el) { fireCounter(el); });
    }, OPENING_COUNTERS_FIRE_MS);

    /* Non-opening counters: observer-driven. Threshold 0.6 and the
     * opacity gate inside animateCount handle the rest. */
    var allCounters = document.querySelectorAll('[data-count-target]');
    var observed = [];
    allCounters.forEach(function (el) {
      if (openingSectionEl && openingSectionEl.contains(el)) return;
      observed.push(el);
    });
    if (observed.length === 0) return;

    counterObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var el = entry.target;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          fireCounter(el);
        } else if (!entry.isIntersecting) {
          if (el.dataset.counted === 'true') resetCounter(el);
        }
      });
    }, { threshold: [0, 0.6] });

    observed.forEach(function (el) { counterObserver.observe(el); });
  }

  /* Pre-load chart JSON so the persistent chart components find the
   * data already cached when their layer enters the viewport. */
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

    /* Defer counter setup until after @html'd content has rendered. */
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        setupCounters();
      });
    });

    return () => {
      observer?.disconnect();
      counterObserver?.disconnect();
      window.removeEventListener('wheel', handleWheel);
      window.clearTimeout(stepTransitionTimer);
      window.clearTimeout(wheelGestureResetTimer);
      if (typeof history !== 'undefined' && 'scrollRestoration' in history && previousScrollRestoration) {
        history.scrollRestoration = previousScrollRestoration;
      }
    };
  });
</script>

<svelte:head><title>Speculation Has a Geography</title></svelte:head>

<a class="skip-link" href="#regime-shift">Skip to the story</a>

<article class="story-page"
  class:bg-dark={isDarkSection}
  class:bg-amber={isAmberSection}
  class:bg-white={isWhiteSection}>

  <section class="story-opening" id={openingSection.id} bind:this={openingSectionEl}
    aria-label="Introduction">
    <div class="opening-inner">{@html openingSection.content}</div>
  </section>

  <div class="dark-to-warm" aria-hidden="true"></div>

  <section class="story-scroll-region" bind:this={storyRegionEl} aria-label="Scrollytelling narrative">
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
          aria-current={activeChapter === section.chapter ? 'step' : undefined}
          title="{section.chapter} · {section.label}">
          <span class="prog-num" aria-hidden="true">{section.chapter}</span>
          <span class="prog-dot" aria-hidden="true"></span>
          <span class="prog-text">{section.label}</span>
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
          {loadError} />
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

  <div class="story-transition-strip" aria-hidden="true">
    <div class="transition-inner">
      <p>The story above is the city's story.</p>
      <p>Now explore every tract.</p>
    </div>
  </div>

  <section class="story-explorer-section" id={explorerSection.id}
    data-section-id={explorerSection.id} use:trackStep bind:this={explorerSectionEl}
    aria-label="Tract explorer">
    <StoryExplorer {geoData} {ranges} {counts} {cityAverages} {holdingAverages} {flippingAverages} />
  </section>

  <div class="story-outro" aria-hidden="true">
    {@html STORY_OUTRO}
  </div>

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

  /* Skip link, invisible until keyboard focus lands on it. */
  .skip-link {
    position: absolute;
    top: -100px;
    left: 12px;
    z-index: 1000;
    background: var(--ink);
    color: #fff;
    padding: 10px 16px;
    border-radius: 6px;
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: 13px;
    font-weight: 700;
    text-decoration: none;
    transition: top 0.18s;
  }
  .skip-link:focus {
    top: 12px;
    outline: 2px solid var(--amber);
    outline-offset: 2px;
  }

  /* Page background shifts between cream, dark, amber-tinted, and a
   * warm off-white based on the active section. The transition is
   * slow enough that each section feels like a new room. */
  .story-page {
    min-height: 100vh;
    background: var(--bg);
    color: var(--ink);
    transition: background-color 600ms cubic-bezier(0.4, 0, 0.2, 1),
                color 600ms cubic-bezier(0.4, 0, 0.2, 1);
  }
  .story-page.bg-dark { background: #0F0F0E; }
  .story-page.bg-amber { background: #F5EDDC; }
  .story-page.bg-white { background: #FAFAF6; }

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

  /* Policy section: ink-dark accent on takeaway. */
  .story-page.bg-white :global(.section-takeaway) {
    color: var(--ink) !important;
    border-left-color: var(--ink) !important;
  }

  /* Dark cinematic opening. Ambient gradient drifts behind everything. */
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

  /* Hero word: blur-in plus a 1.05 scale settle. The word lands the
   * way a held breath does. */
  .story-opening :global(.hero-word) {
    font-family: "DM Serif Display", Georgia, serif;
    font-size: clamp(58px, 12vw, 112px);
    line-height: 0.9;
    color: var(--amber);
    opacity: 0;
    transform: scale(1.05);
    filter: blur(8px);
    animation: open-word-in 1100ms cubic-bezier(0.16, 1, 0.3, 1) 600ms forwards;
    will-change: opacity, transform, filter;
  }
  @keyframes open-word-in {
    to { opacity: 1; transform: scale(1); filter: blur(0); }
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

  /* Opening thesis sentence with two embedded display numbers. The
   * sentence flows; the numbers are large and the bridge text is
   * smaller, italicized in places, so the sentence reads as one
   * thought rather than two specs. */
  .story-opening :global(.opening-thesis) {
    max-width: 820px;
    margin: 0 auto 22px;
    padding: 0 12px;
    color: rgba(242, 240, 234, 0.85);
    font-family: "DM Serif Display", Georgia, serif;
    font-size: clamp(18px, 2.4vw, 26px);
    line-height: 1.45;
    text-align: center;
    opacity: 0;
    animation: open-fade 700ms cubic-bezier(0.16, 1, 0.3, 1) 1400ms forwards;
    will-change: opacity;
  }
  .story-opening :global(.thesis-lead),
  .story-opening :global(.thesis-bridge),
  .story-opening :global(.thesis-tail) {
    font-style: italic;
    color: rgba(242, 240, 234, 0.65);
  }
  .story-opening :global(.thesis-bridge-tight) {
    margin-left: 4px;
  }
  .story-opening :global(.thesis-num) {
    display: inline-flex;
    align-items: baseline;
    margin: 0 6px;
    font-style: normal;
    font-family: "DM Serif Display", Georgia, serif;
    font-weight: 400;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .story-opening :global(.thesis-num-hold) {
    color: #6BA3D6;
  }
  .story-opening :global(.thesis-num-flip) {
    color: var(--amber);
  }
  .story-opening :global(.thesis-sign),
  .story-opening :global(.thesis-digits) {
    font-size: clamp(40px, 7vw, 64px);
  }
  .story-opening :global(.thesis-pct) {
    font-size: clamp(20px, 3.6vw, 32px);
    opacity: 0.65;
    margin-left: 1px;
    align-self: flex-start;
  }

  /* Mono-caps attribution under the thesis sentence. Anchors the
   * headline in the dataset. */
  .story-opening :global(.opening-attribution) {
    font-family: "IBM Plex Mono", monospace;
    font-size: 10px;
    color: rgba(242, 240, 234, 0.42);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    margin: 0 auto 22px;
    opacity: 0;
    animation: open-fade 700ms cubic-bezier(0.16, 1, 0.3, 1) 1900ms forwards;
    will-change: opacity;
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

  /* Film credits. Reads as opening titles, not as a sub-byline. */
  .story-opening :global(.film-credits) {
    margin: 0 auto 18px;
    max-width: 720px;
    opacity: 0;
    animation: open-fade 700ms cubic-bezier(0.16, 1, 0.3, 1) 2600ms forwards;
    will-change: opacity;
  }
  .story-opening :global(.film-credit-row) {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 14px 28px;
    font-family: "IBM Plex Mono", monospace;
    font-size: 10.5px;
    color: rgba(242, 240, 234, 0.46);
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  .story-opening :global(.film-credit-tag) {
    color: rgba(242, 240, 234, 0.32);
  }
  .story-opening :global(.film-credit-names) {
    color: rgba(242, 240, 234, 0.6);
    letter-spacing: 0.18em;
  }
  .story-opening :global(.film-credit-meta) {
    margin-top: 8px;
    font-size: 9.5px;
    color: rgba(242, 240, 234, 0.32);
    letter-spacing: 0.16em;
  }

  /* Scroll cue. Just the chevron now; words are gone. */
  .story-opening :global(.scroll-cue-wrap) {
    margin-top: 50px;
    display: flex; flex-direction: column;
    align-items: center; gap: 8px;
    opacity: 0;
    animation: open-fade 700ms cubic-bezier(0.16, 1, 0.3, 1) 3000ms forwards;
    will-change: opacity;
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

  .dark-to-warm {
    height: 140px;
    background: linear-gradient(to bottom, #0F0F0E, var(--bg));
  }
  .story-page.bg-dark .dark-to-warm {
    background: linear-gradient(to bottom, #0F0F0E, #0F0F0E);
  }

  /* Three-column scrollytelling grid. */
  .story-scroll-region {
    --story-top-rail: 28px;
    display: grid;
    grid-template-columns: minmax(96px, 0.18fr) minmax(300px, 0.84fr) minmax(540px, 1.6fr);
    grid-template-areas: "progress text viz";
    align-items: start;
    gap: clamp(22px, 3vw, 60px);
    width: min(1500px, 100%);
    margin: 0 auto;
    padding: var(--story-top-rail) clamp(18px, 4vw, 64px) 14vh;
  }

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
    left: 28px; top: 18%; bottom: 18%;
    width: 1px;
    background: rgba(120, 115, 105, 0.22);
  }
  .story-page.bg-dark .story-progress .progress-rail {
    background: rgba(242, 240, 234, 0.16);
  }

  /* Progress link layout: chapter number always visible in mono caps,
   * dot in the middle, full label revealed on hover or active. */
  .progress-dot-link {
    position: relative;
    display: grid;
    grid-template-columns: 18px 16px auto;
    align-items: center;
    gap: 6px;
    color: rgba(120, 115, 105, 0.75);
    font-size: 10px;
    text-decoration: none;
    transition: color 0.25s;
  }

  .prog-num {
    font-family: "IBM Plex Mono", monospace;
    font-size: 10px;
    font-weight: 700;
    color: rgba(120, 115, 105, 0.5);
    letter-spacing: 0.04em;
    text-align: right;
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
  .progress-dot-link.active .prog-text,
  .progress-dot-link:focus-visible .prog-text {
    opacity: 1; transform: translateX(0);
  }

  .progress-dot-link.active .prog-dot {
    transform: scale(1.45);
    background: var(--ink);
  }
  .progress-dot-link.active .prog-num {
    color: var(--ink);
  }
  .progress-dot-link.active.t-hold .prog-dot { background: var(--navy); }
  .progress-dot-link.active.t-flip .prog-dot { background: var(--amber); }
  .progress-dot-link.active.t-policy .prog-dot { background: var(--ink); }
  .progress-dot-link.active { color: var(--ink); }

  .story-page.bg-dark .progress-dot-link { color: rgba(242, 240, 234, 0.45); }
  .story-page.bg-dark .prog-num { color: rgba(242, 240, 234, 0.32); }
  .story-page.bg-dark .prog-dot { background: rgba(242, 240, 234, 0.32); }
  .story-page.bg-dark .progress-dot-link.active { color: rgba(242, 240, 234, 0.95); }
  .story-page.bg-dark .progress-dot-link.active .prog-num { color: rgba(242, 240, 234, 0.95); }
  .story-page.bg-dark .progress-dot-link.active .prog-dot { background: #F2F0EA; }
  .story-page.bg-dark .progress-dot-link.active.t-hold .prog-dot { background: #8AAEC8; }
  .story-page.bg-dark .progress-dot-link.active.t-flip .prog-dot { background: var(--amber-mid); }

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

  .story-step :global(.section-takeaway) {
    font-family: "DM Serif Display", Georgia, serif;
    font-size: 19px; line-height: 1.5; color: var(--ink);
    margin: 22px 0 0;
    padding: 4px 0 4px 16px;
    border-left: 3px solid var(--neutral);
    transition: color 600ms cubic-bezier(0.4, 0, 0.2, 1),
                border-left-color 600ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Hairline rule above the human sentence. Echoes the closing rule
   * in Section 06. The two emotionally heaviest beats rhyme. */
  .story-step :global(.human-rule) {
    width: 36px;
    height: 1px;
    background: var(--neutral);
    margin: 32px 0 16px;
    opacity: 0.55;
  }
  .story-step :global(.human-sentence) {
    font-family: "DM Serif Display", Georgia, serif;
    font-size: 20px;
    line-height: 1.55;
    color: var(--text);
    margin: 0 0 8px;
    padding: 0;
    max-width: 560px;
  }

  /* Section 04 inline equity sentence with two embedded numbers. */
  .story-step :global(.equity-sentence) {
    font-family: "DM Serif Display", Georgia, serif;
    font-size: 20px;
    line-height: 1.55;
    color: var(--text);
    margin: 14px 0 18px;
    max-width: 560px;
  }
  .story-step :global(.eq-inline-num) {
    font-family: "DM Serif Display", Georgia, serif;
    font-size: 30px;
    font-weight: 400;
    margin: 0 4px;
    font-variant-numeric: tabular-nums;
  }

  /* Section 02 zone chips. Color-dotted strong tags in body copy. */
  .story-step :global(.zone-chip) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 700;
  }
  .story-step :global(.zone-chip-dot) {
    width: 8px; height: 8px;
    border-radius: 50%;
    display: inline-block;
  }
  .story-step :global(.zone-chip-hold) { color: var(--navy); }
  .story-step :global(.zone-chip-hold) :global(.zone-chip-dot) { background: var(--navy); }
  .story-step :global(.zone-chip-flip) { color: var(--amber-dark); }
  .story-step :global(.zone-chip-flip) :global(.zone-chip-dot) { background: var(--amber-dark); }
  .story-page.bg-dark .story-step :global(.zone-chip-hold) { color: #8AAEC8; }
  .story-page.bg-dark .story-step :global(.zone-chip-hold) :global(.zone-chip-dot) { background: #8AAEC8; }
  .story-page.bg-dark .story-step :global(.zone-chip-flip) { color: var(--amber-mid); }
  .story-page.bg-dark .story-step :global(.zone-chip-flip) :global(.zone-chip-dot) { background: var(--amber-mid); }

  /* Section 02 cue. One word, mono caps, low opacity. */
  .story-step :global(.story-cue) {
    font-family: "IBM Plex Mono", monospace;
    font-size: 11px;
    color: var(--faint);
    letter-spacing: 0.18em;
    text-transform: uppercase;
    margin: 22px 0 0;
  }

  /* Section 06 closing. Larger serif, wider rule, italic mono caps
   * footnote. The reader should feel the page making room. */
  .story-step :global(.closing-rule) {
    width: 80px;
    height: 1px;
    background: var(--ink);
    margin: 56px 0 22px;
    opacity: 0.55;
  }
  .story-step :global(.closing-takeaway) {
    font-family: "DM Serif Display", Georgia, serif;
    font-size: 28px;
    line-height: 1.35;
    color: var(--ink);
    margin: 0 0 14px;
    max-width: 600px;
  }
  .story-step :global(.closing-footnote) {
    font-family: "IBM Plex Mono", monospace;
    font-style: italic;
    font-size: 10.5px;
    color: var(--faint);
    letter-spacing: 0.08em;
    margin: 4px 0 0;
    max-width: 560px;
  }

  .story-viz-column {
    position: sticky; top: var(--story-top-rail);
    grid-area: viz; align-self: start;
    display: flex; height: calc(100vh - var(--story-top-rail));
    align-items: center;
  }
  .sticky-stage { display: flex; width: 100%; height: 100%; align-items: center; }

  /* Transition strip between the story and the explorer. */
  .story-transition-strip {
    background: #0F0F0E;
    color: rgba(242, 240, 234, 0.7);
    text-align: center;
    min-height: 38vh;
    display: grid; place-items: center;
    padding: clamp(48px, 8vh, 96px) 24px;
    font-family: "DM Serif Display", Georgia, serif;
    font-size: clamp(22px, 3.2vw, 32px);
    line-height: 1.45;
  }
  .transition-inner { max-width: 720px; }
  .story-transition-strip p { margin: 0; }
  .story-transition-strip p + p { margin-top: 14px; color: rgba(242, 240, 234, 0.45); }

  .story-explorer-section {
    width: 100%; margin: 0 auto;
  }

  /* Quiet outro band between the explorer and the footer. */
  .story-outro {
    background: #0F0F0E;
    color: rgba(242, 240, 234, 0.62);
    text-align: center;
    padding: clamp(40px, 8vh, 84px) 24px;
  }
  .story-outro :global(.story-outro-line) {
    font-family: "DM Serif Display", Georgia, serif;
    font-style: italic;
    font-size: clamp(17px, 2.2vw, 22px);
    line-height: 1.5;
    max-width: 640px;
    margin: 0 auto;
    color: rgba(242, 240, 234, 0.7);
  }

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
    .story-transition-strip { font-size: 19px; padding: 60px 22px; min-height: 36vh; }
    .dark-to-warm { height: 80px; }
    .story-step :global(.eq-inline-num) { font-size: 24px; }
    .story-step :global(.closing-takeaway) { font-size: 22px; }
    .story-step :global(.human-sentence) { font-size: 17px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .story-opening :global(.hero-word) {
      filter: none;
    }
    .story-opening::before { animation: none; }
    .story-opening :global(.scroll-cue-chevron) { animation: none; }
  }
</style>
