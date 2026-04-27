<script>
  import * as d3 from 'd3';
  import { onMount, tick } from 'svelte';

  export let active = false;

  const HOLD_NEIGHBORHOODS = [
    'Back Bay', 'Beacon Hill', 'Charlestown', 'Downtown',
    'Fenway', 'Longwood', 'South Boston Waterfront', 'South End', 'West End'
  ];

  let data = [];
  let svgEl;
  let wrapperEl;
  let initialDrawDone = false;

  let selectedNeighborhoods = ['Back Bay', 'Dorchester'];
  let selectedMetric = 'investor_share';

  const metrics = [
    { key: 'investor_share', label: 'Investor share', format: d3.format('.0%') },
    { key: 'flip_rate', label: 'Flip rate', format: d3.format('.1%') },
    { key: 'price_premium', label: 'Price premium', format: d3.format('+.0%') }
  ];

  $: neighborhoods = Array.from(new Set(data.map(function(d) { return d.neighborhood; }))).sort();
  $: activeMetric = metrics.find(function(m) { return m.key === selectedMetric; }) || metrics[0];
  $: filteredData = data.filter(function(d) { return selectedNeighborhoods.includes(d.neighborhood); });

  function isHold(name) { return HOLD_NEIGHBORHOODS.includes(name); }

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
        selectedNeighborhoods = selectedNeighborhoods.filter(function(n) { return n !== name; });
      }
    } else {
      selectedNeighborhoods = [...selectedNeighborhoods, name];
    }
  }

  /* triggers redraw when selections change after initial animation */
  $: if (initialDrawDone && data.length > 0 && (selectedNeighborhoods, selectedMetric)) {
    tick().then(function() { drawChart(true); });
  }

  /* scroll-triggered entrance animation */
  $: if (active && data.length > 0 && svgEl && !initialDrawDone) {
    tick().then(function() {
      drawChart(false);
      initialDrawDone = true;
    });
  }

  function drawChart(instant) {
    if (!svgEl || !wrapperEl || filteredData.length === 0) return;

    var cw = wrapperEl.clientWidth;
    var ch = 340;
    var margin = { top: 20, right: 110, bottom: 40, left: 54 };
    var font = 'Plus Jakarta Sans, sans-serif';
    var mono = 'IBM Plex Mono, monospace';
    var DRAW_MS = instant ? 400 : 2200;
    var EASE = instant ? d3.easeCubicOut : d3.easeCubicInOut;

    var svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    svg.attr('viewBox', '0 0 ' + cw + ' ' + ch)
      .attr('role', 'img')
      .attr('aria-label', 'Neighborhood trajectory chart comparing ' + selectedNeighborhoods.join(' and '));

    var x = d3.scaleLinear()
      .domain(d3.extent(data, function(d) { return d.year; }))
      .range([margin.left, cw - margin.right]);

    var yExt = d3.extent(filteredData, function(d) { return d[selectedMetric]; });
    var yPad = (yExt[1] - yExt[0]) * 0.14 || 0.02;
    var y = d3.scaleLinear()
      .domain([yExt[0] - yPad, yExt[1] + yPad])
      .range([ch - margin.bottom, margin.top]);

    svg.append('g').attr('transform', 'translate(0,' + (ch - margin.bottom) + ')')
      .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format('d')).tickSize(0))
      .call(function(a) { a.select('.domain').attr('stroke', '#D6D2C8'); })
      .call(function(a) {
        a.selectAll('text').attr('fill', '#9C9890')
          .style('font-size', '11px').style('font-family', font);
      });

    svg.append('g').attr('transform', 'translate(' + margin.left + ',0)')
      .call(d3.axisLeft(y).ticks(5).tickFormat(activeMetric.format).tickSize(0))
      .call(function(a) { a.select('.domain').remove(); })
      .call(function(a) {
        a.selectAll('.tick line').clone()
          .attr('x2', cw - margin.left - margin.right)
          .attr('stroke', '#D6D2C8').attr('stroke-opacity', 0.25);
      })
      .call(function(a) {
        a.selectAll('text').attr('fill', '#9C9890')
          .style('font-size', '11px').style('font-family', font);
      });

    svg.append('line')
      .attr('x1', x(2008)).attr('x2', x(2008))
      .attr('y1', margin.top).attr('y2', ch - margin.bottom)
      .attr('stroke', '#B0A898').attr('stroke-dasharray', '4 3');
    svg.append('text').attr('x', x(2008)).attr('y', margin.top - 8)
      .attr('text-anchor', 'middle').attr('fill', '#9C9890')
      .style('font-size', '10px').style('font-family', font).text('2008');

    var line = d3.line()
      .x(function(d) { return x(d.year); })
      .y(function(d) { return y(d[selectedMetric]); })
      .defined(function(d) { return d[selectedMetric] != null; })
      .curve(d3.curveMonotoneX);

    var grouped = d3.group(filteredData, function(d) { return d.neighborhood; });
    var idx = 0;

    for (var entry of grouped) {
      var nh = entry[0];
      var vals = entry[1].slice().sort(function(a, b) { return a.year - b.year; });
      var color = isHold(nh) ? '#1B3A5C' : '#C68B3C';

      var p = svg.append('path').datum(vals).attr('fill', 'none')
        .attr('stroke', color).attr('stroke-width', 2.5)
        .attr('stroke-linecap', 'round').attr('d', line);

      var len = p.node().getTotalLength();
      p.attr('stroke-dasharray', len + ' ' + len)
        .attr('stroke-dashoffset', len)
        .transition().delay(idx * 120).duration(DRAW_MS).ease(EASE)
        .attr('stroke-dashoffset', 0)
        .on('end', function() { d3.select(this).attr('stroke-dasharray', null); });

      var last = vals[vals.length - 1];
      if (last && last[selectedMetric] != null) {
        var endG = svg.append('g').attr('opacity', 0);
        endG.append('text')
          .attr('x', x(last.year) + 8).attr('y', y(last[selectedMetric]) + 4)
          .attr('fill', color).style('font-size', '12px')
          .style('font-weight', '600').style('font-family', font).text(nh);
        endG.append('text')
          .attr('x', x(last.year) + 8).attr('y', y(last[selectedMetric]) + 18)
          .attr('fill', color).attr('opacity', 0.7)
          .style('font-size', '11px').style('font-family', mono)
          .text(activeMetric.format(last[selectedMetric]));
        endG.transition().delay(idx * 120 + DRAW_MS + 200)
          .duration(400).ease(d3.easeCubicOut).attr('opacity', 1);
      }
      idx++;
    }

    /* hover: vertical rule with tooltip values */
    var hoverLine = svg.append('line')
      .attr('y1', margin.top).attr('y2', ch - margin.bottom)
      .attr('stroke', '#46433C').attr('stroke-width', 1)
      .attr('stroke-opacity', 0).style('pointer-events', 'none');

    var hoverG = svg.append('g').attr('opacity', 0).style('pointer-events', 'none');
    var years = Array.from(new Set(data.map(function(d) { return d.year; }))).sort();

    svg.append('rect')
      .attr('x', margin.left).attr('y', margin.top)
      .attr('width', cw - margin.left - margin.right)
      .attr('height', ch - margin.top - margin.bottom)
      .attr('fill', 'transparent').style('cursor', 'crosshair')
      .on('mousemove', function(event) {
        var mx = d3.pointer(event, svgEl)[0];
        var yr = Math.round(x.invert(mx));
        yr = Math.max(years[0], Math.min(years[years.length - 1], yr));

        hoverLine.attr('x1', x(yr)).attr('x2', x(yr)).attr('stroke-opacity', 0.35);
        hoverG.selectAll('*').remove();
        hoverG.attr('opacity', 1);

        var tx = x(yr) + 10;
        if (tx > cw - 140) tx = x(yr) - 120;

        hoverG.append('rect')
          .attr('x', tx - 6).attr('y', margin.top)
          .attr('width', 130).attr('height', 16 + selectedNeighborhoods.length * 18)
          .attr('fill', 'rgba(255,255,255,0.92)').attr('rx', 4)
          .attr('stroke', '#D6D2C8').attr('stroke-width', 0.5);

        hoverG.append('text').attr('x', tx).attr('y', margin.top + 12)
          .attr('fill', '#46433C').style('font-size', '11px')
          .style('font-weight', '700').style('font-family', font).text(yr);

        selectedNeighborhoods.forEach(function(nh, i) {
          var match = data.find(function(d) { return d.neighborhood === nh && d.year === yr; });
          var v = match ? match[selectedMetric] : null;
          var c = isHold(nh) ? '#1B3A5C' : '#C68B3C';

          hoverG.append('text').attr('x', tx).attr('y', margin.top + 30 + i * 18)
            .attr('fill', c).style('font-size', '11px').style('font-family', font)
            .text(nh + ': ' + (v != null ? activeMetric.format(v) : 'n/a'));

          if (match && v != null) {
            hoverG.append('circle').attr('cx', x(yr)).attr('cy', y(v))
              .attr('r', 4).attr('fill', c).attr('stroke', '#fff').attr('stroke-width', 1.5);
          }
        });
      })
      .on('mouseleave', function() {
        hoverLine.attr('stroke-opacity', 0);
        hoverG.attr('opacity', 0);
      });
  }

  onMount(function() {
    loadData();
    window.addEventListener('resize', function() { if (initialDrawDone) drawChart(true); });
    return function() { window.removeEventListener('resize', function() {}); };
  });
</script>

<div class="tl-wrap" bind:this={wrapperEl}>
  <div class="tl-controls">
    <div class="tl-metrics">
      {#each metrics as metric}
        <button class:active={selectedMetric === metric.key}
          on:click={() => selectedMetric = metric.key}
        >{metric.label}</button>
      {/each}
    </div>
    <div class="tl-neighborhoods">
      {#each neighborhoods as nh}
        <button class="tl-nh"
          class:active={selectedNeighborhoods.includes(nh)}
          class:hold={isHold(nh)}
          class:flip={!isHold(nh)}
          on:click={() => toggleNeighborhood(nh)}
        >{nh}</button>
      {/each}
    </div>
  </div>
  {#if data.length === 0}
    <div class="tl-empty">Loading neighborhood data\u2026</div>
  {:else}
    <svg bind:this={svgEl} class="tl-chart"></svg>
  {/if}
</div>

<style>
  .tl-wrap { width: 100%; height: 100%; display: flex; flex-direction: column; }
  .tl-controls { flex-shrink: 0; padding: 0 0 12px; }

  .tl-metrics { display: flex; gap: 5px; margin-bottom: 8px; }
  .tl-metrics button {
    padding: 5px 12px; border: 1px solid var(--rule); border-radius: 5px;
    background: transparent; color: var(--sub);
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.15s;
  }
  .tl-metrics button:hover { border-color: var(--neutral); color: var(--text); }
  .tl-metrics button.active { background: var(--ink); border-color: var(--ink); color: #fff; }
  .tl-metrics button:focus-visible { outline: 2px solid var(--navy); outline-offset: 2px; }

  .tl-neighborhoods { display: flex; flex-wrap: wrap; gap: 4px; }
  .tl-nh {
    padding: 3px 8px; border: 1px solid var(--rule); border-radius: 4px;
    background: transparent; color: var(--faint);
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: 10px; font-weight: 500; cursor: pointer; transition: all 0.15s;
  }
  .tl-nh:hover { border-color: var(--neutral); color: var(--text); }
  .tl-nh.active.hold { background: var(--navy); border-color: var(--navy); color: #fff; font-weight: 700; }
  .tl-nh.active.flip { background: var(--amber); border-color: var(--amber); color: #fff; font-weight: 700; }
  .tl-nh:focus-visible { outline: 2px solid var(--navy); outline-offset: 2px; }

  .tl-chart { flex: 1; width: 100%; min-height: 260px; }
  .tl-empty { flex: 1; display: grid; place-items: center; color: var(--faint); font-size: 13px; }
</style>
