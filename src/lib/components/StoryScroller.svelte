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
  const renderedStorySteps = storySteps;
  const progressSections = NARRATIVE_SECTIONS.filter((s) => s.layout !== 'fullscreen');

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
  let isStepTransitioning = false;
  let stepTransitionTimer;
  let wheelGestureConsumed = false;
  let wheelGestureResetTimer;
  let previousScrollRestoration = null;
  let wheelGuardUntil = 0;
  let stepCursorId = null;
  let activeLockUntil = 0;
  let mapIntroVizVisible = false;
  let mapIntroRevealRaf = 0;
  let prevStepId = '';
  let methodDialogEls = [];
  let methodDialogClickHandler = null;

  const STEP_SCROLL_COOLDOWN_MS = 640;
  const WHEEL_GESTURE_IDLE_MS = 320;
  /* Cinematic pause after the opening choreography settles before
   * scroll is allowed to move the reader off the title screen. */
  const INITIAL_WHEEL_GUARD_MS = 1300;
  const ACTIVE_LOCK_MS = 950;
  const STORY_TOP_RAIL_PX = 28;

  /* Opening counters, when present, are deferred until after the
   * opening choreography so any tween runs while content is visible. */
  const OPENING_COUNTERS_FIRE_MS = 1350;

  let geoData = null;
  let ranges = {};
  let cityAverages = {};
  let counts = { holdCount: 0, flipCount: 0, mixedCount: 0, lowDataCount: 0 };
  let loadError = '';

  $: activeSection = activeId
    ? storySteps.find((s) => s.id === activeId)
    : null;
  $: activeChapter = activeId
    ? NARRATIVE_SECTIONS.find((s) => s.id === activeId)?.chapter
    : null;
  $: currentStoryStepId = stepCursorId || activeId || '';
  $: currentStoryStep = storySteps.find((s) => s.id === currentStoryStepId) ?? activeSection;
  $: activeStepLayout = activeSection?.stepLayout ?? currentStoryStep?.stepLayout ?? 'split';
  $: showVizLane = activeStepLayout === 'split';
  $: mapDelayedHidden = activeSection?.id === 'map-intro' && !mapIntroVizVisible;
  $: explorerWideMode = activeSection?.id === 'explorer';
  $: activeObservedStepId = activeSection?.id ?? '';

  function queueMapIntroReveal() {
    if (mapIntroRevealRaf) cancelAnimationFrame(mapIntroRevealRaf);
    mapIntroVizVisible = false;
    mapIntroRevealRaf = requestAnimationFrame(function () {
      mapIntroRevealRaf = 0;
      mapIntroVizVisible = true;
    });
  }

  $: if (activeObservedStepId !== prevStepId) {
    prevStepId = activeObservedStepId;
    if (activeObservedStepId === 'map-intro') queueMapIntroReveal();
    else {
      if (mapIntroRevealRaf) {
        cancelAnimationFrame(mapIntroRevealRaf);
        mapIntroRevealRaf = 0;
      }
      mapIntroVizVisible = false;
    }
  }

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

  function setupMethodologyDialogs() {
    if (!storyRegionEl) return;

    methodDialogClickHandler = function (event) {
      var openBtn = event.target.closest('[data-method-dialog-open]');
      if (openBtn) {
        event.preventDefault();
        var root = openBtn.closest('.s2-methodology-block');
        var dialog = root?.querySelector('dialog[data-method-dialog]');
        if (!dialog) return;
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
        return;
      }

      var closeBtn = event.target.closest('[data-method-dialog-close]');
      if (closeBtn) {
        event.preventDefault();
        var host = closeBtn.closest('dialog');
        if (!host) return;
        if (typeof host.close === 'function') host.close();
        else host.removeAttribute('open');
      }
    };

    storyRegionEl.addEventListener('click', methodDialogClickHandler);
    methodDialogEls = Array.from(storyRegionEl.querySelectorAll('dialog[data-method-dialog]'));
    methodDialogEls.forEach(function (dialog) {
      dialog.addEventListener('click', function (event) {
        if (event.target === dialog) {
          if (typeof dialog.close === 'function') dialog.close();
          else dialog.removeAttribute('open');
        }
      });
    });
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
  function activateStep(id) {
    if (!id) return;
    activeId = id;
    stepCursorId = id;
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
    var ov = inView(openingSectionEl), sv = inView(storyRegionEl), sm = storyStepMode();
    if (!ov && !sv) return;
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
        if (idx >= 0 && idx < storySteps.length - 1) {
          tId = storySteps[idx + 1]?.id ?? '';
          tEl = storyStepNodes[tId];
        }
      }
    } else {
      if (idx > 0) {
        tId = storySteps[idx - 1]?.id ?? '';
        tEl = storyStepNodes[tId];
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
        activeId = oid;
        if (storySteps.some((s) => s.id === oid)) {
          stepCursorId = oid;
        }
      }
    }, {
      root: null,
      rootMargin: '-34% 0px -42% 0px',
      threshold: [0.1, 0.35, 0.6, 0.85]
    });
    observedNodes.forEach((n) => observer.observe(n));

    window.addEventListener('wheel', handleWheel, { passive: false });
    setupMethodologyDialogs();

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
      if (storyRegionEl && methodDialogClickHandler) {
        storyRegionEl.removeEventListener('click', methodDialogClickHandler);
      }
      methodDialogEls.forEach(function (dialog) {
        if (typeof dialog.close === 'function') dialog.close();
      });
      methodDialogEls = [];
      methodDialogClickHandler = null;
      if (mapIntroRevealRaf) {
        cancelAnimationFrame(mapIntroRevealRaf);
        mapIntroRevealRaf = 0;
      }
      window.clearTimeout(stepTransitionTimer);
      window.clearTimeout(wheelGestureResetTimer);
      if (typeof history !== 'undefined' && 'scrollRestoration' in history && previousScrollRestoration) {
        history.scrollRestoration = previousScrollRestoration;
      }
    };
  });
</script>

<svelte:head><title>Speculation Has a Geography</title></svelte:head>

<a class="skip-link" href="#market-shift">Skip to the story</a>

<article class="story-page">

  <section class="story-opening" id={openingSection.id} bind:this={openingSectionEl}
    aria-label="Introduction">
    <div class="opening-inner">{@html openingSection.content}</div>
  </section>

  <div class="dark-to-warm" aria-hidden="true"></div>

  <section class="story-scroll-region"
    class:explorer-wide-mode={explorerWideMode}
    bind:this={storyRegionEl}
    aria-label="Scrollytelling narrative">
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

    <div class="story-content-plane">
      <div class="story-viz-column"
        class:viz-hidden={!showVizLane}
        class:viz-delayed-hidden={mapDelayedHidden}
        aria-live="polite">
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
            class:chapter-one-step={section.id === 'regime-shift'}
            class:chapter-two-step={section.id === 'map-intro'}
            class:explorer-inline-step={section.id === 'explorer'}
            id={section.id} data-section-id={section.id} use:trackStep>
            <div class="story-step-layout"
              class:is-text={section.stepLayout === 'text'}
              class:is-split={section.stepLayout !== 'text'}>
              <StoryStepBody html={section.content} />
              {#if section.id === 'explorer'}
                <div class="inline-explorer-shell">
                  <StoryExplorer
                    {geoData}
                    {ranges}
                    {counts}
                    {cityAverages} />
                </div>
              {/if}
            </div>
          </section>
        {/each}
      </div>
    </div>
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

  /* One constant light background for the full story. */
  .story-page {
    min-height: 100vh;
    background: #FAFAF6;
    color: var(--ink);
    transition: background-color 600ms cubic-bezier(0.4, 0, 0.2, 1),
                color 600ms cubic-bezier(0.4, 0, 0.2, 1);
  }
  /* Opening uses the same flat background as the rest of the page. */
  .story-opening {
    position: relative;
    display: grid;
    min-height: 100vh;
    place-items: center;
    padding: 48px 24px;
    text-align: center;
    background: #FAFAF6;
    color: var(--ink);
    overflow: hidden;
  }

  .opening-inner {
    width: min(1020px, 100%);
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .story-opening :global(.hero-title) {
    max-width: 800px;
    margin: 0 0 clamp(20px, 4vh, 34px);
    font-family: "DM Serif Display", Georgia, serif;
    font-weight: 400;
    font-size: clamp(44px, 7vw, 84px);
    line-height: 1.02;
    letter-spacing: -0.01em;
    color: var(--ink);
    opacity: 0;
    animation: open-fade 680ms cubic-bezier(0.16, 1, 0.3, 1) 80ms forwards;
    will-change: opacity;
  }

  .story-opening :global(.hero-card-grid) {
    width: min(920px, 100%);
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: clamp(14px, 2vw, 20px);
    margin: 0 0 clamp(26px, 4.5vh, 44px);
    opacity: 0;
    animation: open-fade 680ms cubic-bezier(0.16, 1, 0.3, 1) 420ms forwards;
    will-change: opacity;
  }

  .story-opening :global(.hero-card) {
    border-radius: 12px;
    padding: clamp(18px, 2.2vw, 26px);
    text-align: left;
    min-height: 232px;
    box-shadow: 0 8px 24px rgba(25, 24, 22, 0.08);
  }
  .story-opening :global(.hero-card-flip) {
    background: var(--amber-mid-dark);
    color: #fff;
  }
  .story-opening :global(.hero-card-hold) {
    background: var(--navy-mid-dark);
    color: #fff;
  }
  .story-opening :global(.hero-card-title) {
    margin: 0 0 10px;
    font-family: "DM Serif Display", Georgia, serif;
    font-size: clamp(28px, 3vw, 38px);
    line-height: 1.04;
    font-weight: 400;
    letter-spacing: -0.01em;
  }
  .story-opening :global(.hero-card-body) {
    margin: 0;
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: clamp(15px, 1.4vw, 18px);
    line-height: 1.58;
    letter-spacing: 0.001em;
    color: inherit;
  }

  .story-opening :global(.hero-text-block) {
    max-width: 760px;
    margin: 0 auto;
    display: grid;
    gap: 8px;
    opacity: 0;
    animation: open-fade 680ms cubic-bezier(0.16, 1, 0.3, 1) 760ms forwards;
    will-change: opacity;
  }
  .story-opening :global(.hero-summary),
  .story-opening :global(.hero-question-lead),
  .story-opening :global(.hero-question) {
    margin: 0;
    color: rgba(25, 24, 22, 0.82);
  }
  .story-opening :global(.hero-summary) {
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: clamp(16px, 1.65vw, 21px);
    line-height: 1.62;
  }
  .story-opening :global(.hero-question-lead) {
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(25, 24, 22, 0.68);
    margin-top: 32px;
  }
  .story-opening :global(.hero-question) {
    font-family: "DM Serif Display", Georgia, serif;
    font-weight: 400;
    font-size: clamp(24px, 3vw, 36px);
    line-height: 1.24;
    color: var(--ink);
  }

  .story-opening :global(.scroll-cue-wrap) {
    margin-top: clamp(34px, 5.2vh, 56px);
    display: flex; flex-direction: column;
    align-items: center; gap: 8px;
    opacity: 0;
    animation: open-fade 700ms cubic-bezier(0.16, 1, 0.3, 1) 1280ms forwards;
    will-change: opacity;
  }
  .story-opening :global(.scroll-cue-chevron) {
    color: rgba(25, 24, 22, 0.34);
    animation: cue-pulse 2.4s ease-in-out infinite;
  }
  @keyframes open-fade { to { opacity: 1; } }
  @keyframes cue-pulse {
    0%, 100% { opacity: 0.28; transform: translateY(0); }
    50%      { opacity: 0.85; transform: translateY(5px); }
  }

  .dark-to-warm {
    height: 140px;
    background: #FAFAF6;
  }

  /* Progress rail + per-step layout plane. */
  .story-scroll-region {
    --story-top-rail: 28px;
    --story-left-shift: clamp(18px, 2vw, 34px);
    --story-viz-base-width: clamp(500px, 39vw, 680px);
    --story-viz-width: calc(var(--story-viz-base-width) + var(--story-left-shift));
    --story-viz-gap: clamp(16px, 2.2vw, 36px);
    --story-progress-reclaim: clamp(84px, 10vw, 156px);
    display: grid;
    grid-template-columns: minmax(72px, 0.12fr) minmax(0, 1fr);
    grid-template-areas: "progress content";
    align-items: start;
    gap: var(--story-viz-gap);
    width: min(1600px, 100%);
    margin: 0 auto;
    padding: var(--story-top-rail) clamp(18px, 4vw, 64px) 14vh;
  }
  .story-scroll-region.explorer-wide-mode {
    grid-template-columns: minmax(72px, 0.12fr) minmax(0, 1fr);
  }
  .story-scroll-region.explorer-wide-mode .story-progress {
    opacity: 1;
    pointer-events: auto;
  }
  .story-scroll-region.explorer-wide-mode .prog-text {
    opacity: 0 !important;
    visibility: hidden !important;
    pointer-events: none !important;
    transform: none !important;
  }
  .story-content-plane {
    grid-area: content;
    display: grid;
    position: relative;
    width: calc(100% + var(--story-left-shift));
    margin-left: calc(-1 * var(--story-left-shift));
  }
  .story-content-plane > * {
    grid-area: 1 / 1;
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
    margin-left: calc(-1 * var(--story-left-shift));
  }

  .story-progress .progress-rail {
    position: absolute;
    left: 28px; top: 18%; bottom: 18%;
    width: 1px;
    background: rgba(120, 115, 105, 0.22);
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
    font-family: "Plus Jakarta Sans", sans-serif;
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
    font-family: "Plus Jakarta Sans", sans-serif;
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

  .story-text-column {
    display: flex;
    flex-direction: column;
    position: relative;
    z-index: 2;
    pointer-events: none;
  }

  .story-step {
    display: flex; box-sizing: border-box;
    min-height: calc(100vh - var(--story-top-rail));
    flex-direction: column; justify-content: center;
    padding: clamp(18px, 4vh, 42px) 0;
  }
  .story-step-layout {
    width: 100%;
    pointer-events: none;
  }
  .story-step-layout > * {
    pointer-events: auto;
  }
  .story-step-layout.is-text {
    max-width: min(940px, 100%);
  }
  .story-step-layout.is-split {
    max-width: min(1220px, 100%);
    padding-right: calc(var(--story-viz-width) + var(--story-viz-gap));
  }
  .story-step.chapter-two-step :global(.story-copy) {
    min-height: clamp(280px, 34vh, 420px);
  }
  .story-step.chapter-one-step :global(.story-copy) {
    max-width: 100%;
  }
  .story-step.explorer-inline-step {
    justify-content: flex-start;
    padding: clamp(8px, 1.2vh, 16px) 0 clamp(10px, 2vh, 22px);
    --explorer-inline-shift: 30px;
  }
  .story-step.explorer-inline-step .story-step-layout.is-text {
    max-width: min(1360px, 100%);
  }
  .story-step :global(.s5-title),
  .story-step :global(.s6-title),
  .story-step :global(.s7-title) {
    margin: 0 0 14px;
    font-family: "DM Serif Display", Georgia, serif;
    font-weight: 400;
    font-size: clamp(33px, 4.2vw, 50px);
    line-height: 1.05;
    letter-spacing: -0.01em;
    color: var(--ink);
    max-width: 760px;
  }
  .story-step :global(.s6-intro),
  .story-step :global(.s7-intro) {
    margin: 0 0 16px;
    max-width: 760px;
    color: var(--text);
    font-size: 15.5px;
    line-height: 1.66;
  }
  .story-step.explorer-inline-step :global(.s5-title) {
    margin: 0 0 8px;
    margin-left: calc((-1 * var(--story-progress-reclaim)) + var(--explorer-inline-shift));
  }
  .inline-explorer-shell {
    margin-top: 8px;
    width: min(1260px, 100%);
    max-width: 100%;
    border: 1px solid var(--rule);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 10px 30px rgba(25, 24, 22, 0.08);
    background: #fff;
  }
  .story-step.explorer-inline-step .inline-explorer-shell {
    width: calc(100% + var(--story-progress-reclaim) - var(--explorer-inline-shift));
    max-width: none;
    margin-left: calc((-1 * var(--story-progress-reclaim)) + var(--explorer-inline-shift));
  }
  .inline-explorer-shell :global(.story-explorer-app) {
    height: clamp(620px, 78vh, 920px);
    min-height: 620px;
    border-radius: 0;
  }

  .story-step :global(.section-takeaway) {
    font-family: "DM Serif Display", Georgia, serif;
    font-size: 19px; line-height: 1.5; color: var(--ink);
    margin: 22px 0 0;
    padding: 4px 0 4px 16px;
    border-left: 3px solid var(--neutral);
    transition: color 600ms cubic-bezier(0.4, 0, 0.2, 1),
                border-left-color 600ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Section 01 context: market shift before strategy split. */
  .story-step :global(.s0-title) {
    margin: 0 0 14px;
    font-family: "DM Serif Display", Georgia, serif;
    font-weight: 400;
    font-size: clamp(33px, 4.2vw, 50px);
    line-height: 1.05;
    letter-spacing: -0.01em;
    color: var(--ink);
    max-width: 760px;
  }
  .story-step :global(.s0-intro),
  .story-step :global(.s0-bridge) {
    margin: 0 0 14px;
    max-width: 760px;
    color: var(--text);
    font-size: 15.5px;
    line-height: 1.66;
  }
  .story-step :global(.s0-bridge) {
    margin-bottom: 0;
    color: var(--ink);
    font-weight: 600;
  }

  /* Section 01 redesign: title, framing paragraph, then two strategy cards. */
  .story-step :global(.s1-title) {
    margin: 0 0 16px;
    font-family: "DM Serif Display", Georgia, serif;
    font-weight: 400;
    font-size: clamp(34px, 4.4vw, 52px);
    line-height: 1.04;
    letter-spacing: -0.01em;
    color: var(--ink);
    max-width: 760px;
  }
  .story-step :global(.s1-intro) {
    margin: 0 0 22px;
    max-width: 720px;
    color: var(--text);
    font-size: 16px;
    line-height: 1.68;
  }
  .story-step :global(.s1-pattern-grid) {
    margin-top: 6px;
    max-width: 840px;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }
  .story-step :global(.s1-pattern-card) {
    border-radius: 12px;
    border: 1px solid var(--rule);
    background: #fff;
    overflow: hidden;
    box-shadow: 0 6px 18px rgba(25, 24, 22, 0.06);
  }
  .story-step :global(.s1-pattern-header) {
    padding: 14px 16px;
  }
  .story-step :global(.s1-pattern-flip .s1-pattern-header) {
    background: var(--amber-mid-dark);
    color: #fff;
  }
  .story-step :global(.s1-pattern-hold .s1-pattern-header) {
    background: var(--navy-mid-dark);
    color: #fff;
  }
  .story-step :global(.s1-pattern-name) {
    font-family: "DM Serif Display", Georgia, serif;
    font-size: 30px;
    line-height: 1;
    margin-bottom: 6px;
  }
  .story-step :global(.s1-pattern-thesis) {
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: 12px;
    line-height: 1.4;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    font-weight: 600;
    opacity: 0.95;
  }
  .story-step :global(.s1-pattern-body) {
    padding: 14px 16px 16px;
    background: #fff;
  }
  .story-step :global(.s1-pattern-body p) {
    margin: 0;
    color: var(--text);
    font-size: 14.5px;
    line-height: 1.62;
  }
  .story-step :global(.s1-pattern-body p + p) {
    margin-top: 10px;
  }

  /* Section 02 redesign: concentration first, then classification method. */
  .story-step :global(.s2-title) {
    margin: 0 0 14px;
    font-family: "DM Serif Display", Georgia, serif;
    font-weight: 400;
    font-size: clamp(33px, 4.2vw, 50px);
    line-height: 1.05;
    letter-spacing: -0.01em;
    color: var(--ink);
    max-width: 760px;
  }
  .story-step :global(.s2-intro) {
    margin: 0 0 18px;
    max-width: 760px;
    color: var(--text);
    font-size: 15.5px;
    line-height: 1.68;
  }
  .story-step :global(.s2-concentration-grid) {
    margin-top: 8px;
    max-width: 860px;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .story-step :global(.s2-concentration-card) {
    border-radius: 12px;
    border: 1px solid var(--rule);
    background: #fff;
    padding: 14px 16px 16px;
    box-shadow: 0 6px 18px rgba(25, 24, 22, 0.06);
  }
  .story-step :global(.s2-concentration-tag) {
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 8px;
  }
  .story-step :global(.s2-concentration-place) {
    font-family: "DM Serif Display", Georgia, serif;
    font-size: 28px;
    line-height: 1.1;
    margin-bottom: 8px;
    letter-spacing: -0.01em;
  }
  .story-step :global(.s2-concentration-card p) {
    margin: 0;
    color: var(--text);
    font-size: 14.5px;
    line-height: 1.6;
  }
  .story-step :global(.s2-concentration-hold .s2-concentration-tag),
  .story-step :global(.s2-concentration-hold .s2-concentration-place) {
    color: var(--navy-mid-dark);
  }
  .story-step :global(.s2-concentration-flip .s2-concentration-tag),
  .story-step :global(.s2-concentration-flip .s2-concentration-place) {
    color: var(--amber-mid-dark);
  }

  .story-step :global(.s2-method-intro) {
    margin: 0 0 14px;
    max-width: 760px;
    color: var(--text);
    font-size: 15.5px;
    line-height: 1.66;
  }
  .story-step :global(.s2-method-grid) {
    max-width: 860px;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 12px;
  }
  .story-step :global(.s2-method-card) {
    border-radius: 12px;
    border: 1px solid var(--rule);
    background: #fff;
    overflow: hidden;
  }
  .story-step :global(.s2-method-title) {
    padding: 12px 14px;
    font-family: "DM Serif Display", Georgia, serif;
    font-size: 24px;
    line-height: 1.08;
    color: #fff;
  }
  .story-step :global(.s2-method-hold .s2-method-title) {
    background: var(--navy-mid-dark);
  }
  .story-step :global(.s2-method-flip .s2-method-title) {
    background: var(--amber-mid-dark);
  }
  .story-step :global(.s2-method-card p) {
    margin: 0;
    padding: 12px 14px 14px;
    color: var(--text);
    font-size: 14.5px;
    line-height: 1.6;
  }
  .story-step :global(.s2-method-close) {
    margin: 0;
    max-width: 860px;
    color: var(--text);
    font-size: 15px;
    line-height: 1.66;
  }
  .story-step :global(.s2-methodology-block) {
    margin-top: 12px;
    max-width: 860px;
  }
  .story-step :global(.s2-method-link) {
    appearance: none;
    border: 0;
    background: transparent;
    padding: 0;
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: var(--navy-mid-dark);
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
  }
  .story-step :global(.s2-method-link:hover),
  .story-step :global(.s2-method-link:focus-visible) {
    color: var(--navy);
  }
  .story-step :global(.s2-methodology-block),
  .story-step :global(.s2-method-link) {
    pointer-events: auto;
  }
  .story-step :global(.s2-method-dialog) {
    position: fixed;
    inset: 0;
    margin: auto;
    z-index: 1400;
    border: 1px solid var(--rule);
    border-radius: 12px;
    padding: 0;
    width: min(980px, calc(100vw - 32px));
    max-height: calc(100vh - 40px);
    overflow: auto;
    background: #fff;
    box-shadow: 0 24px 56px rgba(25, 24, 22, 0.22);
  }
  .story-step :global(.s2-method-dialog::backdrop) {
    background: rgba(25, 24, 22, 0.3);
  }
  .story-step :global(.s2-method-dialog-shell) {
    padding: 28px 30px 30px;
  }
  .story-step :global(.s2-method-dialog-head) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 8px;
  }
  .story-step :global(.s2-method-dialog-kicker) {
    margin: 0;
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--faint);
  }
  .story-step :global(.s2-method-dialog-close) {
    appearance: none;
    border: 0;
    background: transparent;
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: 12px;
    font-weight: 600;
    color: var(--sub);
    cursor: pointer;
  }
  .story-step :global(.s2-method-dialog-title) {
    margin: 0 0 14px;
    font-family: "DM Serif Display", Georgia, serif;
    font-size: 28px;
    line-height: 1.08;
    color: var(--ink);
  }
  .story-step :global(.s2-method-dialog p) {
    margin: 0;
    color: var(--text);
    font-size: 14.5px;
    line-height: 1.62;
  }
  .story-step :global(.s2-method-dialog p + p) {
    margin-top: 16px;
  }
  .story-step :global(.s2-method-dialog-lead) {
    margin-bottom: 0;
    color: var(--text);
  }
  .story-step :global(.s2-method-dialog-score-lines) {
    margin-top: 14px;
    margin-bottom: 22px;
    display: grid;
    gap: 4px;
  }
  .story-step :global(.s2-method-dialog-score-lines p + p) {
    margin-top: 0;
  }
  .story-step :global(.s2-method-dialog-score-line) {
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: 14px;
    line-height: 1.62;
    color: var(--text);
    white-space: nowrap;
    padding: 0;
  }
  .story-step :global(.s2-method-dialog-score-line-hold .s2-method-dialog-score-name) {
    color: var(--navy-mid-dark);
  }
  .story-step :global(.s2-method-dialog-score-line-flip .s2-method-dialog-score-name) {
    color: var(--amber-mid-dark);
  }
  .story-step :global(.s2-method-dialog-score-name) {
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: inherit;
    font-weight: 700;
    letter-spacing: 0;
  }
  .story-step :global(.s2-method-dialog-ruleline) {
    margin: 0 0 20px;
    color: var(--text);
  }
  .story-step :global(.s2-method-dialog-validation-title) {
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--sub);
    margin-top: 34px;
    margin-bottom: 0;
  }
  .story-step :global(.s2-method-dialog-validation-line) {
    color: var(--text);
    line-height: 1.68;
    margin-top: 6px !important;
  }
  .story-step :global(.s2-method-dialog-validation-list) {
    margin: 8px 0 0 18px;
    padding: 0;
    list-style: disc;
    color: var(--text);
  }
  .story-step :global(.s2-method-dialog-validation-list li) {
    margin: 0;
    padding: 0;
    position: static;
    font-size: 14.5px;
    line-height: 1.62;
  }
  .story-step :global(.s2-method-dialog-validation-list li)::before {
    content: none;
  }
  .story-step :global(.s2-method-dialog-validation-list li + li) {
    margin-top: 6px;
  }

  /* Section 03 redesign: title, short framing paragraph, two strategy cards. */
  .story-step :global(.s3-title) {
    margin: 0 0 14px;
    font-family: "DM Serif Display", Georgia, serif;
    font-weight: 400;
    font-size: clamp(33px, 4.2vw, 50px);
    line-height: 1.05;
    letter-spacing: -0.01em;
    color: var(--ink);
    max-width: 760px;
  }
  .story-step :global(.s3-intro) {
    margin: 0 0 18px;
    max-width: 760px;
    color: var(--text);
    font-size: 15.5px;
    line-height: 1.66;
  }
  .story-step :global(.s3-strategy-grid) {
    max-width: 860px;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 14px;
  }
  .story-step :global(.s3-strategy-card) {
    border-radius: 12px;
    border: 1px solid var(--rule);
    background: #fff;
    overflow: hidden;
    box-shadow: 0 6px 18px rgba(25, 24, 22, 0.06);
  }
  .story-step :global(.s3-strategy-head) {
    padding: 12px 14px;
  }
  .story-step :global(.s3-strategy-hold .s3-strategy-head) {
    background: var(--navy-mid-dark);
  }
  .story-step :global(.s3-strategy-flip .s3-strategy-head) {
    background: var(--amber-mid-dark);
  }
  .story-step :global(.s3-strategy-name) {
    margin: 0;
    font-family: "DM Serif Display", Georgia, serif;
    font-size: 26px;
    line-height: 1.06;
    color: #fff;
  }
  .story-step :global(.s3-strategy-body) {
    margin: 0;
    padding: 12px 14px 14px;
    color: var(--text);
    font-size: 14.5px;
    line-height: 1.6;
  }

  /* Section 04 policy redesign: blended framing + explicit tools. */
  .story-step :global(.s4-title) {
    margin: 0 0 14px;
    font-family: "DM Serif Display", Georgia, serif;
    font-weight: 400;
    font-size: clamp(33px, 4.2vw, 50px);
    line-height: 1.05;
    letter-spacing: -0.01em;
    color: var(--ink);
    max-width: 760px;
  }
  .story-step :global(.s4-intro) {
    margin: 0 0 18px;
    max-width: 760px;
    color: var(--text);
    font-size: 15.5px;
    line-height: 1.66;
  }
  .story-step :global(.s4-policy-grid) {
    max-width: 860px;
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
    margin-bottom: 14px;
  }
  .story-step :global(.s4-policy-card) {
    border-radius: 12px;
    border: 1px solid var(--rule);
    background: #fff;
    overflow: hidden;
    box-shadow: 0 6px 18px rgba(25, 24, 22, 0.06);
  }
  .story-step :global(.s4-policy-head) {
    padding: 12px 14px;
  }
  .story-step :global(.s4-policy-hold .s4-policy-head) {
    background: var(--navy-mid-dark);
  }
  .story-step :global(.s4-policy-flip .s4-policy-head) {
    background: var(--amber-mid-dark);
  }
  .story-step :global(.s4-policy-tag) {
    margin: 0 0 5px;
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(255, 255, 255, 0.92);
  }
  .story-step :global(.s4-policy-name) {
    margin: 0;
    font-family: "DM Serif Display", Georgia, serif;
    font-size: 24px;
    line-height: 1.08;
    color: #fff;
  }
  .story-step :global(.s4-policy-body) {
    margin: 0;
    padding: 12px 14px 14px;
    color: var(--text);
    font-size: 14.5px;
    line-height: 1.6;
  }
  .story-step :global(.s4-close) {
    margin: 0;
    max-width: 860px;
    color: var(--text);
    font-size: 15px;
    line-height: 1.66;
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
  /* Section 02 cue. One word, mono caps, low opacity. */
  .story-step :global(.story-cue) {
    font-family: "Plus Jakarta Sans", sans-serif;
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
    font-family: "Plus Jakarta Sans", sans-serif;
    font-style: italic;
    font-size: 10.5px;
    color: var(--faint);
    letter-spacing: 0.08em;
    margin: 4px 0 0;
    max-width: 560px;
  }

  .story-viz-column {
    position: sticky; top: var(--story-top-rail);
    align-self: start;
    justify-self: end;
    width: var(--story-viz-width);
    display: flex;
    height: calc(100vh - var(--story-top-rail));
    align-items: center;
    opacity: 1;
    transform: translateY(0);
    transition: opacity 420ms cubic-bezier(0.4, 0, 0.2, 1),
                transform 420ms cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 1;
  }
  .story-viz-column.viz-hidden {
    opacity: 0;
    transform: translateY(0);
    pointer-events: none;
  }
  .story-viz-column.viz-delayed-hidden {
    opacity: 0;
    transform: translateY(8px);
    pointer-events: none;
  }
  .sticky-stage { display: flex; width: 100%; height: 100%; align-items: center; }

  /* Quiet outro band between the explorer and the footer. */
  .story-outro {
    background: #F2EFE6;
    color: rgba(25, 24, 22, 0.62);
    text-align: center;
    padding: clamp(40px, 8vh, 84px) 24px;
    border-bottom: 1px solid #E4DFD2;
  }
  .story-outro :global(.story-outro-line) {
    font-family: "DM Serif Display", Georgia, serif;
    font-style: italic;
    font-size: clamp(17px, 2.2vw, 22px);
    line-height: 1.5;
    max-width: 640px;
    margin: 0 auto;
    color: rgba(25, 24, 22, 0.72);
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
    font-family: "Plus Jakarta Sans", sans-serif;
  }
  .story-footer :global(.footer-team) { font-size: 12px; font-weight: 600; color: var(--text); }

  @media (max-width: 1040px) {
    .story-scroll-region {
      grid-template-columns: minmax(0, 1fr);
      grid-template-areas: "content";
      --story-left-shift: 0px;
      --story-viz-base-width: clamp(360px, 42vw, 500px);
    }
    .story-progress { display: none; }
    .story-step.explorer-inline-step .inline-explorer-shell {
      width: 100%;
      margin-left: 0;
    }
    .story-step.explorer-inline-step :global(.s5-title) {
      margin-left: 0;
    }
  }

  @media (max-width: 760px) {
    .opening-inner { width: min(560px, 100%); }
    .story-opening { padding: 34px 20px; }
    .story-opening :global(.hero-title) {
      margin-bottom: 18px;
      font-size: clamp(34px, 11.5vw, 52px);
    }
    .story-opening :global(.hero-card-grid) {
      grid-template-columns: 1fr;
      gap: 12px;
      margin-bottom: 20px;
    }
    .story-opening :global(.hero-card) {
      min-height: 0;
      padding: 16px 16px 18px;
    }
    .story-opening :global(.hero-card-title) { font-size: clamp(24px, 8vw, 34px); }
    .story-opening :global(.hero-card-body) { font-size: 15px; line-height: 1.55; }
    .story-opening :global(.hero-summary) { font-size: 16px; }
    .story-opening :global(.hero-question) { font-size: clamp(22px, 7vw, 30px); }

    .story-scroll-region {
      display: block; gap: 0; padding: 0 0 8vh;
    }
    .story-content-plane { display: block; }
    .story-viz-column {
      position: sticky; top: 0; z-index: 4;
      width: 100%;
      height: 46vh; background: var(--bg);
      box-shadow: 0 8px 18px rgba(25, 24, 22, 0.08);
    }
    .story-text-column { padding: 0 22px; }
    .sticky-stage { min-height: auto; }
    .story-step { min-height: 74vh; padding: 18vh 0; }
    .story-step-layout.is-text,
    .story-step-layout.is-split {
      max-width: 100%;
      padding-right: 0;
    }
    .story-step :global(.s0-title) { font-size: clamp(30px, 9vw, 40px); }
    .story-step :global(.s0-intro),
    .story-step :global(.s0-bridge) {
      font-size: 15px;
      line-height: 1.64;
    }
    .story-step :global(.s1-title) { font-size: clamp(30px, 9vw, 40px); }
    .story-step :global(.s1-intro) { font-size: 15px; margin-bottom: 18px; }
    .story-step :global(.s1-pattern-grid) {
      grid-template-columns: 1fr;
      gap: 12px;
    }
    .story-step :global(.s1-pattern-name) { font-size: 26px; }
    .story-step :global(.s1-pattern-thesis) { font-size: 11.5px; }
    .story-step :global(.s1-pattern-body p) { font-size: 14px; line-height: 1.6; }
    .story-step :global(.s2-title) { font-size: clamp(30px, 9vw, 40px); }
    .story-step :global(.s2-intro),
    .story-step :global(.s2-method-intro),
    .story-step :global(.s2-method-close) { font-size: 14.5px; }
    .story-step :global(.s2-concentration-grid),
    .story-step :global(.s2-method-grid) {
      grid-template-columns: 1fr;
      gap: 10px;
    }
    .story-step :global(.s2-concentration-place) { font-size: 24px; }
    .story-step :global(.s2-concentration-card p),
    .story-step :global(.s2-method-card p) {
      font-size: 14px;
      line-height: 1.58;
    }
    .story-step :global(.s2-method-title) { font-size: 22px; }
    .story-step :global(.s2-method-dialog-title) { font-size: 24px; }
    .story-step :global(.s2-method-dialog-shell) { padding: 22px 20px 22px; }
    .story-step :global(.s2-method-dialog-score-line) {
      font-size: 13px;
      white-space: normal;
    }
    .story-step :global(.s3-title) { font-size: clamp(30px, 9vw, 40px); }
    .story-step :global(.s3-intro) { font-size: 14.5px; }
    .story-step :global(.s3-strategy-grid) {
      grid-template-columns: 1fr;
      gap: 10px;
    }
    .story-step :global(.s3-strategy-name) { font-size: 22px; }
    .story-step :global(.s3-strategy-body) {
      font-size: 14px;
      line-height: 1.58;
    }
    .story-step :global(.s4-title) { font-size: clamp(30px, 9vw, 40px); }
    .story-step :global(.s4-intro),
    .story-step :global(.s4-close) { font-size: 14.5px; }
    .story-step :global(.s4-policy-name) { font-size: 22px; }
    .story-step :global(.s4-policy-body) {
      font-size: 14px;
      line-height: 1.58;
    }
    .story-step :global(.s5-title),
    .story-step :global(.s6-title),
    .story-step :global(.s7-title) { font-size: clamp(30px, 9vw, 40px); }
    .story-step :global(.s6-intro),
    .story-step :global(.s7-intro) { font-size: 14.5px; }
    .story-step.explorer-inline-step {
      padding-top: 8px;
    }
    .story-step.explorer-inline-step :global(.s5-title) {
      margin-bottom: 6px;
    }
    .story-step.explorer-inline-step .story-step-layout.is-text {
      max-width: 100%;
    }
    .inline-explorer-shell {
      margin-top: 14px;
      width: 100%;
      border-radius: 10px;
    }
    .inline-explorer-shell :global(.story-explorer-app) {
      height: auto;
      min-height: 0;
    }
    .dark-to-warm { height: 80px; }
    .story-step :global(.eq-inline-num) { font-size: 24px; }
    .story-step :global(.closing-takeaway) { font-size: 22px; }
    .story-step :global(.human-sentence) { font-size: 17px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .story-opening :global(.scroll-cue-chevron) { animation: none; }
  }
</style>
