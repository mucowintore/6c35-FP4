<script>
  import { createEventDispatcher } from 'svelte';

  export let holdCount = 0;
  export let flipCount = 0;
  export let totalCount = 180000;
  export let hidden = false;
  export let errorMessage = '';

  const dispatch = createEventDispatcher();

  let animatedHold = 0;
  let animatedFlip = 0;
  let animatedTotal = 0;
  let started = false;

  function animateCounter(setter, target, duration) {
    let startTime = null;

    function tick(timestamp) {
      if (!startTime) startTime = timestamp;

      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setter(Math.round(target * eased));

      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  function runCounters() {
    if (started || errorMessage) return;
    started = true;

    setTimeout(() => {
      animateCounter((v) => (animatedHold = v), holdCount, 1200);
      animateCounter((v) => (animatedFlip = v), flipCount, 1200);
      animateCounter((v) => (animatedTotal = v), totalCount, 1800);
    }, 800);
  }

  $: if (!started && holdCount + flipCount > 0 && totalCount > 0) {
    runCounters();
  }
</script>

<div class="intro-overlay" class:hidden={hidden} id="intro-overlay">
  {#if errorMessage}
    <p style="color: #9C9890; font-size: 14px; padding: 20px;">
      {errorMessage}
    </p>
  {:else}
    <h1>When Boston says &ldquo;speculation,&rdquo; whose <em>neighborhood</em> does it mean?</h1>
    <p class="intro-subtitle">
      Two opposite investor strategies. Two opposite communities.
      180,000 transactions reveal a divide that one word obscures.
    </p>

    <div class="intro-counters">
      <div class="counter-block">
        <span class="counter-value" style="color: var(--navy)">{animatedHold.toLocaleString()}</span>
        <span class="counter-label">tracts where investors<br />buy and hold</span>
      </div>
      <div class="counter-block">
        <span class="counter-value" style="color: var(--amber)">{animatedFlip.toLocaleString()}</span>
        <span class="counter-label">tracts where investors<br />buy and flip</span>
      </div>
      <div class="counter-block">
        <span class="counter-value">{animatedTotal.toLocaleString()}</span>
        <span class="counter-label">residential sales<br />analyzed</span>
      </div>
    </div>

    <button class="intro-btn" on:click={() => dispatch('begin')}>Begin exploring</button>

    <p class="intro-credit">
      6.C85 Interactive Data Visualization &amp; Society, Spring 2026<br />
      Joseph Firmansyah, Jessica Shoemaker, Jean-Michel Mucowintore
    </p>
  {/if}
</div>
