<script>
  /* Section 05. Neighborhood trajectories.
   *
   * The chart compares up to five neighborhoods over time across one
   * of three metrics. The control surface is the part the reader
   * actually touches, so it has to feel intentional, not like a
   * settings panel.
   *
   * The layout puts an editorial header above the chart that updates
   * with the selection, a single segmented control for the metric,
   * and two zone-grouped chip clusters (holding in navy, flipping in
   * amber). Cap of five selections; past that, an italic prompt
   * tells the reader to drop one to add another. */

  import * as d3 from 'd3';
  import { onMount, tick } from 'svelte';

  export let active = false;
  export let inViewport = false;
  export let visible = false;

  /* Nine neighborhoods classified as holding zones; the rest are
   * flipping zones. The split is the editorial spine of the project,
   * so making the reader see it in the picker is part of the
   * argument. */
  const HOLD_NH = [
    'Back Bay', 'Beacon Hill', 'Charlestown', 'Downtown',
    'Fenway', 'Longwood', 'South Boston Waterfront', 'South End', 'West End'
  ];

  /* Approximate tract counts per neighborhood, used in the tooltip
   * footer to anchor the reader in sample size. */
  const TRACT_COUNTS = {
    'Back Bay': 6, 'Beacon Hill': 4, 'Charlestown': 5, 'Downtown': 5,
    'Fenway': 7, 'Longwood': 2, 'South Boston Waterfront': 5,
    'South End': 9, 'West End': 2,
    'Allston': 7, 'Brighton': 11, 'Dorchester': 24, 'East Boston': 11,
    'Hyde Park': 8, 'Jamaica Plain': 11, 'Mattapan': 8, 'North End': 3,
    'Roslindale': 8, 'Roxbury': 14, 'South Boston': 9, 'West Roxbury': 7
  };

  const MAX_SELECTED = 5;

  let data = [];
  let svgEl;
  let wrapperEl;
  let initialDrawDone = false;
  let resizeHandler = null;

  let selectedNeighborhoods = ['Back Bay', 'Dorchester'];
  let selectedMetric = 'investor_share';

  const metrics = [
    { key: 'investor_share', label: 'Investor share', format: d3.format('.0%') },
    { key: 'flip_rate', label: 'Flip rate', format: d3.format('.1%') },
    { key: 'price_premium', label: 'Price premium', format: d3.format('+.0%') }
  ];

  $: neighborhoods = Array.from(new Set(data.map(function (d) { return d.neighborhood; }))).sort();
  $: holdNeighborhoods = neighborhoods.filter(function (n) { return HOLD_NH.includes(n); });
  $: flipNeighborhoods = neighborhoods.filter(function (n) { return !HOLD_NH.includes(n); });
  $: activeMetric = metrics.find(function (m) { return m.key === selectedMetric; }) || metrics[0];
  $: filteredData = data.filter(function (d) { return selectedNeighborhoods.includes(d.neighborhood); });
  $: capReached = selectedNeighborhoods.length >= MAX_SELECTED;

  /* Header sentence. Comma + and for three or more, no Oxford on two. */
  $: headerSentence = (function () {
    var n = selectedNeighborhoods;
    if (n.length === 0) return 'Pick a neighborhood';
    if (n.length === 1) return 'Showing ' + n[0];
    if (n.length === 2) return 'Comparing ' + n[0] + ' and ' + n[1];
    return 'Comparing ' + n.slice(0, -1).join(', ') + ', and ' + n[n.length - 1];
  })();

  $: selectionKey = selectedMetric + '|' + selectedNeighborhoods.join(',');
  $: if (initialDrawDone && data.length > 0 && selectionKey) {
    tick().then(function () { drawChart(true); });
  }

  /* Animate only when the layer is conceptually active AND its DOM
   * is on screen. Same viewport gate as Sections 01 and 03. */
  $: if (active && inViewport && visible && data.length > 0 && svgEl && !initialDrawDone) {
    tick().then(function () { drawChart(false); initialDrawDone = true; });
  }

  function isHold(name) { return HOLD_NH.includes(name); }

  function tractCountFor(name) {
    var n = TRACT_COUNTS[name];
    return typeof n === 'number' ? n : null;
  }

  async function loadData() {
    try {
      data = await d3.json('data/neighborhood_temporal_metrics.json');
    } catch (err) {
      console.warn('Timeline data not available:', err);
      data = [];
    }
  }

  function toggleNeighborhood(name) {
    if (selectedNeighborhoods.includes(name)) {
      if (selectedNeighborhoods.length > 1) {
        selectedNeighborhoods = selectedNeighborhoods.filter(function (n) { return n !== name; });
      }
      return;
    }
    if (selectedNeighborhoods.length >= MAX_SELECTED) return;
    selectedNeighborhoods = [...selectedNeighborhoods, name];
  }

  function drawChart(instant) {
    if (!svgEl || !wrapperEl || filteredData.length === 0) return;

    var cw = wrapperEl.clientWidth;
    if (cw < 200) cw = 720;
    var ch = 380;
    var margin = { top: 22, right: 132, bottom: 38, left: 56 };
    var font = 'Plus Jakarta Sans, sans-serif';
    var mono = 'IBM Plex Mono, monospace';
    var serif = '"DM Serif Display", Georgia, serif';
    var DRAW_MS = instant ? 380 : 2200;
    var EASE = instant ? d3.easeCubicOut : d3.easeCubicInOut;

    var svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    svg.attr('viewBox', '0 0 ' + cw + ' ' + ch)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('role', 'img')
      .attr('aria-labelledby', 'tl-title tl-desc');

    svg.append('title').attr('id', 'tl-title').text(headerSentence);
    svg.append('desc').attr('id', 'tl-desc')
      .text('Time series chart from 2000 to 2022 showing ' + activeMetric.label.toLowerCase()
            + ' for the selected Boston neighborhoods.');

    var x = d3.scaleLinear()
      .domain(d3.extent(data, function (d) { return d.year; }))
      .range([margin.left, cw - margin.right]);

    var yExt = d3.extent(filteredData, function (d) { return d[selectedMetric]; });
    var yPad = (yExt[1] - yExt[0]) * 0.14 || 0.02;
    var y = d3.scaleLinear()
      .domain([yExt[0] - yPad, yExt[1] + yPad])
      .range([ch - margin.bottom, margin.top]);

    /* x axis */
    svg.append('g').attr('transform', 'translate(0,' + (ch - margin.bottom) + ')')
      .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format('d')).tickSize(0))
      .call(function (a) { a.select('.domain').attr('stroke', '#D6D2C8'); })
      .call(function (a) {
        a.selectAll('text').attr('fill', '#9C9890').attr('dy', '1em')
          .style('font-size', '11px').style('font-family', font);
      });

    /* y axis with gridlines */
    svg.append('g').attr('transform', 'translate(' + margin.left + ',0)')
      .call(d3.axisLeft(y).ticks(5).tickFormat(activeMetric.format).tickSize(0))
      .call(function (a) { a.select('.domain').remove(); })
      .call(function (a) {
        a.selectAll('.tick line').clone()
          .attr('x2', cw - margin.left - margin.right)
          .attr('stroke', '#D6D2C8').attr('stroke-opacity', 0.22);
      })
      .call(function (a) {
        a.selectAll('text').attr('fill', '#9C9890').attr('dx', '-0.4em')
          .style('font-size', '11px').style('font-family', font);
      });

    /* 2008 vertical reference. Same convention as the dark sections,
     * adapted for the cream background. */
    svg.append('line').attr('x1', x(2008)).attr('x2', x(2008))
      .attr('y1', margin.top).attr('y2', ch - margin.bottom)
      .attr('stroke', '#B0A898').attr('stroke-dasharray', '4 3').attr('stroke-opacity', 0.55);
    svg.append('text')
      .attr('transform', 'translate(' + (x(2008) - 7) + ',' + (margin.top + 16) + ') rotate(-90)')
      .attr('text-anchor', 'end').attr('fill', '#9C9890')
      .style('font-size', '9.5px').style('font-family', font)
      .style('letter-spacing', '0.16em').style('text-transform', 'uppercase')
      .text('2008');

    var line = d3.line()
      .x(function (d) { return x(d.year); })
      .y(function (d) { return y(d[selectedMetric]); })
      .defined(function (d) { return d[selectedMetric] != null; })
      .curve(d3.curveMonotoneX);

    var area = d3.area()
      .x(function (d) { return x(d.year); })
      .y0(ch - margin.bottom)
      .y1(function (d) { return y(d[selectedMetric]); })
      .defined(function (d) { return d[selectedMetric] != null; })
      .curve(d3.curveMonotoneX);

    var grouped = d3.group(filteredData, function (d) { return d.neighborhood; });
    var idx = 0;

    for (var entry of grouped) {
      var nh = entry[0];
      var vals = entry[1].slice().sort(function (a, b) { return a.year - b.year; });
      var color = isHold(nh) ? '#1B3A5C' : '#C68B3C';

      /* Faint area fill under the line. Adds weight without shouting. */
      svg.append('path').datum(vals)
        .attr('fill', color).attr('opacity', 0.06)
        .attr('d', area);

      var p = svg.append('path').datum(vals).attr('fill', 'none')
        .attr('stroke', color).attr('stroke-width', 2.5)
        .attr('stroke-linecap', 'round').attr('d', line);
      var len = p.node().getTotalLength();
      p.attr('stroke-dasharray', len + ' ' + len).attr('stroke-dashoffset', len)
        .transition().delay(idx * 120).duration(DRAW_MS).ease(EASE)
        .attr('stroke-dashoffset', 0)
        .on('end', function () { d3.select(this).attr('stroke-dasharray', null); });

      /* End-of-line label with neighborhood name and current value. */
      var last = vals[vals.length - 1];
      if (last && last[selectedMetric] != null) {
        var eg = svg.append('g').attr('opacity', 0);
        eg.append('text').attr('x', x(last.year) + 8).attr('y', y(last[selectedMetric]) + 4)
          .attr('fill', color).style('font-size', '11.5px').style('font-weight', '700')
          .style('font-family', font).text(nh);
        eg.append('text').attr('x', x(last.year) + 8).attr('y', y(last[selectedMetric]) + 18)
          .attr('fill', color).attr('opacity', 0.78).style('font-size', '10px')
          .style('font-family', mono).text(activeMetric.format(last[selectedMetric]));
        eg.transition().delay(idx * 120 + DRAW_MS + 200).duration(400).ease(d3.easeCubicOut).attr('opacity', 1);
      }
      idx++;
    }

    /* Hover layer: vertical guide and a frosted glass tooltip card.
     * The card now carries a tract-count footer line so the reader
     * can always see how many tracts compose each aggregate. */
    var hLine = svg.append('line').attr('y1', margin.top).attr('y2', ch - margin.bottom)
      .attr('stroke', '#46433C').attr('stroke-width', 1)
      .attr('stroke-opacity', 0).attr('stroke-dasharray', '2 3')
      .style('pointer-events', 'none');
    var hG = svg.append('g').attr('opacity', 0).style('pointer-events', 'none');
    var years = Array.from(new Set(data.map(function (d) { return d.year; }))).sort();

    svg.append('rect').attr('x', margin.left).attr('y', margin.top)
      .attr('width', cw - margin.left - margin.right).attr('height', ch - margin.top - margin.bottom)
      .attr('fill', 'transparent').style('cursor', 'crosshair')
      .on('mousemove', function (event) {
        var mx = d3.pointer(event, svgEl)[0];
        var yr = Math.round(x.invert(mx));
        if (yr < years[0]) yr = years[0];
        if (yr > years[years.length - 1]) yr = years[years.length - 1];
        hLine.attr('x1', x(yr)).attr('x2', x(yr)).attr('stroke-opacity', 0.4);
        hG.selectAll('*').remove(); hG.attr('opacity', 1);

        var rowH = 18;
        var footerH = 18;
        var cardH = 22 + selectedNeighborhoods.length * rowH + footerH;
        var cardW = 180;
        var tx = x(yr) + 12;
        if (tx + cardW > cw - 6) tx = x(yr) - cardW - 12;
        var ty = margin.top + 6;

        /* Glass card. The fill is rgba white at 0.94, with a subtle
         * border. The CSS class adds backdrop-filter blur because
         * SVG fill alone cannot blur. */
        hG.append('rect').attr('x', tx).attr('y', ty)
          .attr('width', cardW).attr('height', cardH)
          .attr('rx', 8)
          .attr('class', 'tl-tooltip-card')
          .attr('fill', 'rgba(255, 255, 255, 0.94)')
          .attr('stroke', '#D6D2C8').attr('stroke-width', 0.5);

        hG.append('text').attr('x', tx + 12).attr('y', ty + 16).attr('fill', '#191816')
          .style('font-size', '12px').style('font-weight', '700')
          .style('font-family', mono).style('letter-spacing', '0.06em')
          .text(yr);

        var totalTracts = 0;
        selectedNeighborhoods.forEach(function (n, i) {
          var match = data.find(function (d) { return d.neighborhood === n && d.year === yr; });
          var v = match ? match[selectedMetric] : null;
          var c = isHold(n) ? '#1B3A5C' : '#C68B3C';
          hG.append('circle').attr('cx', tx + 18).attr('cy', ty + 30 + i * rowH)
            .attr('r', 3.5).attr('fill', c);
          hG.append('text').attr('x', tx + 28).attr('y', ty + 34 + i * rowH).attr('fill', '#46433C')
            .style('font-size', '11px').style('font-family', font)
            .text(n);
          hG.append('text').attr('x', tx + cardW - 12).attr('y', ty + 34 + i * rowH)
            .attr('text-anchor', 'end').attr('fill', c)
            .style('font-size', '11px').style('font-weight', '700').style('font-family', mono)
            .text(v != null ? activeMetric.format(v) : 'n/a');
          if (match && v != null) {
            hG.append('circle').attr('cx', x(yr)).attr('cy', y(v))
              .attr('r', 4).attr('fill', '#fff')
              .attr('stroke', c).attr('stroke-width', 2);
          }
          var tc = tractCountFor(n);
          if (typeof tc === 'number') totalTracts += tc;
        });

        /* Footer line: the tract count behind these aggregates. */
        var footerY = ty + 22 + selectedNeighborhoods.length * rowH + 10;
        hG.append('line')
          .attr('x1', tx + 12).attr('x2', tx + cardW - 12)
          .attr('y1', footerY - 8).attr('y2', footerY - 8)
          .attr('stroke', '#E5E1D6').attr('stroke-width', 0.5);
        var footerLabel = totalTracts > 0
          ? 'Aggregating across ' + totalTracts + ' tracts'
          : 'Tract counts unavailable for this selection';
        hG.append('text').attr('x', tx + 12).attr('y', footerY + 4)
          .attr('fill', '#9C9890')
          .style('font-size', '9.5px').style('font-family', mono)
          .style('letter-spacing', '0.06em')
          .text(footerLabel);
      })
      .on('mouseleave', function () { hLine.attr('stroke-opacity', 0); hG.attr('opacity', 0); });
  }

  onMount(function () {
    loadData();
    resizeHandler = function () { if (initialDrawDone) drawChart(true); };
    window.addEventListener('resize', resizeHandler);
    return function () { window.removeEventListener('resize', resizeHandler); };
  });
</script>

<div class="tl-wrap" bind:this={wrapperEl} class:visible>
  <h3 class="tl-header">{headerSentence}</h3>
  <p class="tl-sub">on {activeMetric.label.toLowerCase()}, 2000 to 2022</p>

  <div class="tl-segmented" role="tablist" aria-label="Choose metric">
    {#each metrics as m}
      <button
        class="tl-seg"
        class:active={selectedMetric === m.key}
        role="tab"
        aria-selected={selectedMetric === m.key}
        on:click={() => selectedMetric = m.key}>{m.label}</button>
    {/each}
  </div>

  <div class="tl-groups">
    <div class="tl-group">
      <div class="tl-group-head">
        <span class="tl-dot tl-dot-hold" aria-hidden="true"></span>
        <span class="tl-group-label">Holding zones</span>
        <span class="tl-group-count">{holdNeighborhoods.length}</span>
      </div>
      <div class="tl-chips">
        {#each holdNeighborhoods as nh}
          <button class="tl-chip tl-chip-hold"
            class:active={selectedNeighborhoods.includes(nh)}
            class:capped={!selectedNeighborhoods.includes(nh) && capReached}
            aria-pressed={selectedNeighborhoods.includes(nh)}
            on:click={() => toggleNeighborhood(nh)}>{nh}</button>
        {/each}
      </div>
    </div>
    <div class="tl-group">
      <div class="tl-group-head">
        <span class="tl-dot tl-dot-flip" aria-hidden="true"></span>
        <span class="tl-group-label">Flipping zones</span>
        <span class="tl-group-count">{flipNeighborhoods.length}</span>
      </div>
      <div class="tl-chips">
        {#each flipNeighborhoods as nh}
          <button class="tl-chip tl-chip-flip"
            class:active={selectedNeighborhoods.includes(nh)}
            class:capped={!selectedNeighborhoods.includes(nh) && capReached}
            aria-pressed={selectedNeighborhoods.includes(nh)}
            on:click={() => toggleNeighborhood(nh)}>{nh}</button>
        {/each}
      </div>
    </div>
  </div>

  {#if capReached}
    <p class="tl-helper tl-helper-cap">Drop a neighborhood to add another.</p>
  {:else}
    <p class="tl-helper">Compare up to {MAX_SELECTED} at a time.
      {selectedNeighborhoods.length} selected.</p>
  {/if}

  {#if data.length === 0}
    <div class="tl-empty">Loading…</div>
  {:else}
    <svg bind:this={svgEl} class="tl-chart" aria-live="polite"></svg>
    <p class="tl-prompt">Try Roxbury vs. Beacon Hill.</p>
  {/if}
</div>

<style>
  .tl-wrap {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .tl-header {
    margin: 0;
    font-family: "DM Serif Display", Georgia, serif;
    font-size: 19px;
    font-weight: 400;
    line-height: 1.2;
    letter-spacing: -0.01em;
    color: var(--ink);
  }
  .tl-sub {
    margin: 0;
    font-family: "IBM Plex Mono", monospace;
    font-size: 10px;
    color: var(--faint);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  /* Segmented control: a single rounded pill containing three
   * mutually exclusive segments. Active fill is the ink color. */
  .tl-segmented {
    display: inline-flex;
    margin: 6px 0 4px;
    padding: 3px;
    border-radius: 10px;
    background: var(--surface);
    border: 1px solid var(--rule);
    align-self: flex-start;
  }
  .tl-seg {
    appearance: none;
    border: none;
    background: transparent;
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--sub);
    padding: 6px 14px;
    border-radius: 7px;
    cursor: pointer;
    transition: background 0.18s, color 0.18s;
    letter-spacing: 0.01em;
  }
  .tl-seg:hover { color: var(--ink); }
  .tl-seg.active {
    background: var(--ink);
    color: #fff;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
  }

  /* Two zone groups, stacked. */
  .tl-groups {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 4px;
  }
  .tl-group { display: flex; flex-direction: column; gap: 4px; }
  .tl-group-head {
    display: flex; align-items: center; gap: 7px;
    padding-left: 2px;
  }
  .tl-dot {
    display: inline-block; width: 7px; height: 7px;
    border-radius: 50%;
  }
  .tl-dot-hold { background: var(--navy); }
  .tl-dot-flip { background: var(--amber); }
  .tl-group-label {
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: 9.5px;
    font-weight: 700;
    color: var(--sub);
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }
  .tl-group-count {
    font-family: "IBM Plex Mono", monospace;
    font-size: 9.5px;
    color: var(--faint);
  }

  .tl-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .tl-chip {
    appearance: none;
    padding: 4px 9px;
    border-radius: 14px;
    border: 1px solid var(--rule);
    background: #fff;
    color: var(--sub);
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: 10.5px;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s;
  }
  .tl-chip:hover:not(.capped) {
    border-color: var(--neutral);
    color: var(--ink);
  }
  /* When the cap is reached, unselected chips quiet themselves but
   * remain clickable so the reader can still tap them and learn
   * what they do. The italic helper line above tells them how. */
  .tl-chip.capped {
    opacity: 0.45;
    cursor: pointer;
  }
  .tl-chip-hold.active {
    background: var(--navy);
    border-color: var(--navy);
    color: #fff;
    font-weight: 700;
  }
  .tl-chip-flip.active {
    background: var(--amber);
    border-color: var(--amber);
    color: #fff;
    font-weight: 700;
  }

  .tl-helper {
    margin: 6px 0 4px;
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: 10.5px;
    color: var(--faint);
  }
  .tl-helper-cap {
    font-style: italic;
    color: var(--ink);
    font-family: "DM Serif Display", Georgia, serif;
    font-size: 13px;
  }

  .tl-chart {
    flex: 1;
    width: 100%;
    min-height: 320px;
    margin-top: 2px;
  }

  /* Below-chart prompt that suggests a comparison the reader might
   * not have thought to make. Italic serif, low contrast. */
  .tl-prompt {
    margin: 8px 0 0;
    font-family: "DM Serif Display", Georgia, serif;
    font-style: italic;
    font-size: 13px;
    color: var(--faint);
    letter-spacing: 0.005em;
  }

  .tl-empty {
    flex: 1; display: grid; place-items: center;
    color: var(--faint); font-size: 13px;
    font-family: "Plus Jakarta Sans", sans-serif;
  }

  /* Frosted glass on the SVG hover card. backdrop-filter applies
   * through the SVG when the rect carries this class. */
  :global(.tl-tooltip-card) {
    backdrop-filter: blur(12px) saturate(140%);
    -webkit-backdrop-filter: blur(12px) saturate(140%);
    filter: drop-shadow(0 8px 24px rgba(25, 24, 22, 0.12));
  }
</style>
