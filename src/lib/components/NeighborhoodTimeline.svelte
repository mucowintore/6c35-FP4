<script>
  /* Neighborhood trajectory chart, persistent across the story.
   *
   * Mounts once. Stays alive even when other sections are showing.
   * When the timeline section becomes active, the visible flag fades
   * the chart in and the line drawing animation runs once. After
   * that, any change to the metric or the selected neighborhoods
   * redraws with a quick instant transition. */

  import * as d3 from 'd3';
  import { onMount, tick } from 'svelte';

  export let active = false;
  export let visible = false;

  /* The nine neighborhoods classified as holding zones. Used to color
   * their lines navy. Everything else colors amber. */
  const HOLD_NH = [
    'Back Bay', 'Beacon Hill', 'Charlestown', 'Downtown',
    'Fenway', 'Longwood', 'South Boston Waterfront', 'South End', 'West End'
  ];

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
  $: activeMetric = metrics.find(function (m) { return m.key === selectedMetric; }) || metrics[0];
  $: filteredData = data.filter(function (d) { return selectedNeighborhoods.includes(d.neighborhood); });

  /* Combined key gives reliable reactivity when either the metric or
   * the selection changes. Without it Svelte sometimes skips a redraw
   * if it cannot tell that a referenced array has new contents. */
  $: selectionKey = selectedMetric + '|' + selectedNeighborhoods.join(',');
  $: if (initialDrawDone && data.length > 0 && selectionKey) {
    tick().then(function () { drawChart(true); });
  }

  /* First entrance: when the section becomes active and data is
   * loaded, draw with the long ease-in animation. */
  $: if (active && visible && data.length > 0 && svgEl && !initialDrawDone) {
    tick().then(function () { drawChart(false); initialDrawDone = true; });
  }

  function isHold(name) { return HOLD_NH.includes(name); }

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
      if (selectedNeighborhoods.length > 1)
        selectedNeighborhoods = selectedNeighborhoods.filter(function (n) { return n !== name; });
    } else {
      selectedNeighborhoods = [...selectedNeighborhoods, name];
    }
  }

  function drawChart(instant) {
    if (!svgEl || !wrapperEl || filteredData.length === 0) return;

    var cw = wrapperEl.clientWidth;
    var ch = 320;
    var margin = { top: 20, right: 110, bottom: 36, left: 52 };
    var font = 'Plus Jakarta Sans, sans-serif';
    var mono = 'IBM Plex Mono, monospace';
    var DRAW_MS = instant ? 400 : 2200;
    var EASE = instant ? d3.easeCubicOut : d3.easeCubicInOut;

    var svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    svg.attr('viewBox', '0 0 ' + cw + ' ' + ch)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('role', 'img')
      .attr('aria-label', 'Neighborhood trajectory chart comparing ' + selectedNeighborhoods.join(' and '));

    var x = d3.scaleLinear()
      .domain(d3.extent(data, function (d) { return d.year; }))
      .range([margin.left, cw - margin.right]);

    var yExt = d3.extent(filteredData, function (d) { return d[selectedMetric]; });
    var yPad = (yExt[1] - yExt[0]) * 0.14 || 0.02;
    var y = d3.scaleLinear()
      .domain([yExt[0] - yPad, yExt[1] + yPad])
      .range([ch - margin.bottom, margin.top]);

    svg.append('g').attr('transform', 'translate(0,' + (ch - margin.bottom) + ')')
      .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format('d')).tickSize(0))
      .call(function (a) { a.select('.domain').attr('stroke', '#D6D2C8'); })
      .call(function (a) {
        a.selectAll('text').attr('fill', '#9C9890')
          .style('font-size', '11px').style('font-family', font);
      });

    svg.append('g').attr('transform', 'translate(' + margin.left + ',0)')
      .call(d3.axisLeft(y).ticks(5).tickFormat(activeMetric.format).tickSize(0))
      .call(function (a) { a.select('.domain').remove(); })
      .call(function (a) {
        a.selectAll('.tick line').clone()
          .attr('x2', cw - margin.left - margin.right)
          .attr('stroke', '#D6D2C8').attr('stroke-opacity', 0.18);
      })
      .call(function (a) {
        a.selectAll('text').attr('fill', '#9C9890')
          .style('font-size', '11px').style('font-family', font);
      });

    /* 2008 vertical reference. Soft, secondary. */
    svg.append('line').attr('x1', x(2008)).attr('x2', x(2008))
      .attr('y1', margin.top).attr('y2', ch - margin.bottom)
      .attr('stroke', '#B0A898').attr('stroke-dasharray', '4 3').attr('stroke-opacity', 0.5);
    svg.append('text').attr('x', x(2008)).attr('y', margin.top - 8)
      .attr('text-anchor', 'middle').attr('fill', '#9C9890')
      .style('font-size', '10px').style('font-family', font).text('2008');

    var line = d3.line()
      .x(function (d) { return x(d.year); })
      .y(function (d) { return y(d[selectedMetric]); })
      .defined(function (d) { return d[selectedMetric] != null; })
      .curve(d3.curveMonotoneX);

    var grouped = d3.group(filteredData, function (d) { return d.neighborhood; });
    var idx = 0;

    for (var entry of grouped) {
      var nh = entry[0];
      var vals = entry[1].slice().sort(function (a, b) { return a.year - b.year; });
      var color = isHold(nh) ? '#1B3A5C' : '#C68B3C';

      var p = svg.append('path').datum(vals).attr('fill', 'none')
        .attr('stroke', color).attr('stroke-width', 2.5)
        .attr('stroke-linecap', 'round').attr('d', line);
      var len = p.node().getTotalLength();
      p.attr('stroke-dasharray', len + ' ' + len).attr('stroke-dashoffset', len)
        .transition().delay(idx * 120).duration(DRAW_MS).ease(EASE)
        .attr('stroke-dashoffset', 0)
        .on('end', function () { d3.select(this).attr('stroke-dasharray', null); });

      var last = vals[vals.length - 1];
      if (last && last[selectedMetric] != null) {
        var eg = svg.append('g').attr('opacity', 0);
        eg.append('text').attr('x', x(last.year) + 8).attr('y', y(last[selectedMetric]) + 4)
          .attr('fill', color).style('font-size', '11px').style('font-weight', '600').style('font-family', font).text(nh);
        eg.append('text').attr('x', x(last.year) + 8).attr('y', y(last[selectedMetric]) + 17)
          .attr('fill', color).attr('opacity', 0.7).style('font-size', '10px').style('font-family', mono)
          .text(activeMetric.format(last[selectedMetric]));
        eg.transition().delay(idx * 120 + DRAW_MS + 200).duration(400).ease(d3.easeCubicOut).attr('opacity', 1);
      }
      idx++;
    }

    /* Hover: vertical rule with floating tooltip card. */
    var hLine = svg.append('line').attr('y1', margin.top).attr('y2', ch - margin.bottom)
      .attr('stroke', '#46433C').attr('stroke-width', 1).attr('stroke-opacity', 0).style('pointer-events', 'none');
    var hG = svg.append('g').attr('opacity', 0).style('pointer-events', 'none');
    var years = Array.from(new Set(data.map(function (d) { return d.year; }))).sort();

    svg.append('rect').attr('x', margin.left).attr('y', margin.top)
      .attr('width', cw - margin.left - margin.right).attr('height', ch - margin.top - margin.bottom)
      .attr('fill', 'transparent').style('cursor', 'crosshair')
      .on('mousemove', function (event) {
        var mx = d3.pointer(event, svgEl)[0];
        var yr = Math.round(x.invert(mx));
        yr = Math.max(years[0], Math.min(years[years.length - 1], yr));
        hLine.attr('x1', x(yr)).attr('x2', x(yr)).attr('stroke-opacity', 0.3);
        hG.selectAll('*').remove(); hG.attr('opacity', 1);
        var tx = x(yr) + 10; if (tx > cw - 140) tx = x(yr) - 120;
        hG.append('rect').attr('x', tx - 6).attr('y', margin.top)
          .attr('width', 130).attr('height', 16 + selectedNeighborhoods.length * 16)
          .attr('fill', 'rgba(255,255,255,0.96)').attr('rx', 4)
          .attr('stroke', '#D6D2C8').attr('stroke-width', 0.5);
        hG.append('text').attr('x', tx).attr('y', margin.top + 12).attr('fill', '#46433C')
          .style('font-size', '11px').style('font-weight', '700').style('font-family', font).text(yr);
        selectedNeighborhoods.forEach(function (n, i) {
          var match = data.find(function (d) { return d.neighborhood === n && d.year === yr; });
          var v = match ? match[selectedMetric] : null;
          var c = isHold(n) ? '#1B3A5C' : '#C68B3C';
          hG.append('text').attr('x', tx).attr('y', margin.top + 28 + i * 16).attr('fill', c)
            .style('font-size', '10px').style('font-family', font).text(n + ': ' + (v != null ? activeMetric.format(v) : 'n/a'));
          if (match && v != null) {
            hG.append('circle').attr('cx', x(yr)).attr('cy', y(v))
              .attr('r', 3.5).attr('fill', c)
              .attr('stroke', '#fff').attr('stroke-width', 1.5);
          }
        });
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
  <div class="tl-controls">
    <div class="tl-metrics">
      {#each metrics as m}
        <button class:active={selectedMetric === m.key} on:click={() => selectedMetric = m.key}>{m.label}</button>
      {/each}
    </div>
    <div class="tl-nh-scroll">
      {#each neighborhoods as nh}
        <button class="tl-nh"
          class:active={selectedNeighborhoods.includes(nh)}
          class:hold={isHold(nh)} class:flip={!isHold(nh)}
          on:click={() => toggleNeighborhood(nh)}>{nh}</button>
      {/each}
    </div>
  </div>
  {#if data.length === 0}
    <div class="tl-empty">Loading…</div>
  {:else}
    <svg bind:this={svgEl} class="tl-chart"></svg>
  {/if}
</div>

<style>
  .tl-wrap { width: 100%; height: 100%; display: flex; flex-direction: column; }
  .tl-controls { flex-shrink: 0; padding: 0 0 8px; }
  .tl-metrics { display: flex; gap: 4px; margin-bottom: 6px; }
  .tl-metrics button {
    padding: 4px 10px; border: 1px solid var(--rule); border-radius: 4px;
    background: transparent; color: var(--sub);
    font-family: "Plus Jakarta Sans", sans-serif; font-size: 10px; font-weight: 600;
    cursor: pointer; transition: all 0.15s;
  }
  .tl-metrics button:hover { border-color: var(--neutral); }
  .tl-metrics button.active { background: var(--ink); border-color: var(--ink); color: #fff; }
  .tl-nh-scroll {
    display: flex; gap: 3px; overflow-x: auto; padding-bottom: 2px;
    scrollbar-width: none;
  }
  .tl-nh-scroll::-webkit-scrollbar { display: none; }
  .tl-nh {
    padding: 3px 7px; border: 1px solid var(--rule); border-radius: 3px;
    background: transparent; color: var(--faint); white-space: nowrap;
    font-family: "Plus Jakarta Sans", sans-serif; font-size: 9px; font-weight: 500;
    cursor: pointer; transition: all 0.15s; flex-shrink: 0;
  }
  .tl-nh:hover { border-color: var(--neutral); color: var(--text); }
  .tl-nh.active.hold { background: var(--navy); border-color: var(--navy); color: #fff; font-weight: 700; }
  .tl-nh.active.flip { background: var(--amber); border-color: var(--amber); color: #fff; font-weight: 700; }
  .tl-chart { flex: 1; width: 100%; min-height: 240px; }
  .tl-empty { flex: 1; display: grid; place-items: center; color: var(--faint); font-size: 13px; }
</style>
