<script>
  import * as d3 from 'd3';
  import { onMount, tick } from 'svelte';

  /* neighborhoods classified as holding for button coloring */
  const HOLD_NEIGHBORHOODS = [
    'Back Bay', 'Beacon Hill', 'Charlestown', 'Downtown',
    'Fenway', 'Longwood', 'South Boston Waterfront', 'South End', 'West End'
  ];

  let data = [];
  let svgEl;
  let wrapperEl;

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

  function isHoldNeighborhood(name) {
    return HOLD_NEIGHBORHOODS.includes(name);
  }

  async function loadTimelineData() {
    try {
      data = await d3.json('data/neighborhood_temporal_metrics.json');
      await tick();
      drawChart();
    } catch (err) {
      console.warn('Timeline data not yet available:', err);
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

  function drawChart() {
    if (!svgEl || !wrapperEl || filteredData.length === 0) return;

    var chartWidth = wrapperEl.clientWidth;
    var chartHeight = 380;
    var margin = { top: 24, right: 110, bottom: 44, left: 58 };

    var font = 'Plus Jakarta Sans, sans-serif';
    var mono = 'IBM Plex Mono, monospace';

    var DRAW_MS = 2200;
    var EASE = d3.easeCubicInOut;

    var svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    svg.attr('viewBox', '0 0 ' + chartWidth + ' ' + chartHeight)
      .attr('role', 'img')
      .attr('aria-label', 'Neighborhood comparison chart showing investor metrics over time');

    var x = d3.scaleLinear()
      .domain(d3.extent(data, function(d) { return d.year; }))
      .range([margin.left, chartWidth - margin.right]);

    var yExtent = d3.extent(filteredData, function(d) { return d[selectedMetric]; });
    var yPad = (yExtent[1] - yExtent[0]) * 0.14 || 0.02;
    var y = d3.scaleLinear()
      .domain([yExtent[0] - yPad, yExtent[1] + yPad])
      .range([chartHeight - margin.bottom, margin.top]);

    /* x axis */
    svg.append('g')
      .attr('transform', 'translate(0,' + (chartHeight - margin.bottom) + ')')
      .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format('d')).tickSize(0))
      .call(function(a) { a.select('.domain').attr('stroke', '#D6D2C8'); })
      .call(function(a) {
        a.selectAll('text').attr('fill', '#9C9890')
          .style('font-size', '11px').style('font-family', font);
      });

    /* y axis with faint gridlines */
    svg.append('g')
      .attr('transform', 'translate(' + margin.left + ',0)')
      .call(d3.axisLeft(y).ticks(5).tickFormat(activeMetric.format).tickSize(0))
      .call(function(a) { a.select('.domain').remove(); })
      .call(function(a) {
        a.selectAll('.tick line').clone()
          .attr('x2', chartWidth - margin.left - margin.right)
          .attr('stroke', '#D6D2C8').attr('stroke-opacity', 0.3);
      })
      .call(function(a) {
        a.selectAll('text').attr('fill', '#9C9890')
          .style('font-size', '11px').style('font-family', font);
      });

    /* 2008 marker */
    svg.append('line')
      .attr('x1', x(2008)).attr('x2', x(2008))
      .attr('y1', margin.top).attr('y2', chartHeight - margin.bottom)
      .attr('stroke', '#B0A898').attr('stroke-dasharray', '4 3');
    svg.append('text')
      .attr('x', x(2008)).attr('y', margin.top - 8)
      .attr('text-anchor', 'middle').attr('fill', '#9C9890')
      .style('font-size', '10px').style('font-family', font).text('2008');

    var line = d3.line()
      .x(function(d) { return x(d.year); })
      .y(function(d) { return y(d[selectedMetric]); })
      .defined(function(d) { return d[selectedMetric] != null; })
      .curve(d3.curveMonotoneX);

    var grouped = d3.group(filteredData, function(d) { return d.neighborhood; });

    /* draw each neighborhood line with animated entrance */
    var lineIndex = 0;
    for (var entry of grouped) {
      var nh = entry[0];
      var values = entry[1].slice().sort(function(a, b) { return a.year - b.year; });
      var isHold = isHoldNeighborhood(nh);
      var color = isHold ? '#1B3A5C' : '#C68B3C';

      var path = svg.append('path')
        .datum(values).attr('fill', 'none')
        .attr('stroke', color).attr('stroke-width', 2.5)
        .attr('stroke-linecap', 'round').attr('d', line);

      var length = path.node().getTotalLength();
      path.attr('stroke-dasharray', length + ' ' + length)
        .attr('stroke-dashoffset', length)
        .transition().delay(lineIndex * 150).duration(DRAW_MS).ease(EASE)
        .attr('stroke-dashoffset', 0)
        .on('end', function() { d3.select(this).attr('stroke-dasharray', null); });

      /* endpoint annotation: name and value */
      var last = values[values.length - 1];
      if (last && last[selectedMetric] != null) {
        var endAnnot = svg.append('g').attr('opacity', 0);

        endAnnot.append('text')
          .attr('x', x(last.year) + 8).attr('y', y(last[selectedMetric]) + 4)
          .attr('fill', color).style('font-size', '12px')
          .style('font-weight', '600').style('font-family', font)
          .text(nh);

        endAnnot.append('text')
          .attr('x', x(last.year) + 8).attr('y', y(last[selectedMetric]) + 18)
          .attr('fill', color).attr('opacity', 0.7)
          .style('font-size', '11px').style('font-family', mono)
          .text(activeMetric.format(last[selectedMetric]));

        endAnnot.transition()
          .delay(lineIndex * 150 + DRAW_MS + 300)
          .duration(500).ease(d3.easeCubicOut)
          .attr('opacity', 1);
      }

      lineIndex++;
    }

    /* hover interaction: vertical rule with tooltip values */
    var hoverLine = svg.append('line')
      .attr('y1', margin.top).attr('y2', chartHeight - margin.bottom)
      .attr('stroke', '#46433C').attr('stroke-width', 1).attr('stroke-opacity', 0)
      .style('pointer-events', 'none');

    var hoverGroup = svg.append('g').attr('opacity', 0).style('pointer-events', 'none');

    var years = Array.from(new Set(data.map(function(d) { return d.year; }))).sort();

    var hoverRect = svg.append('rect')
      .attr('x', margin.left).attr('y', margin.top)
      .attr('width', chartWidth - margin.left - margin.right)
      .attr('height', chartHeight - margin.top - margin.bottom)
      .attr('fill', 'transparent').style('cursor', 'crosshair');

    hoverRect.on('mousemove', function(event) {
      var mouseX = d3.pointer(event, svgEl)[0];
      var hoveredYear = Math.round(x.invert(mouseX));
      hoveredYear = Math.max(years[0], Math.min(years[years.length - 1], hoveredYear));

      hoverLine.attr('x1', x(hoveredYear)).attr('x2', x(hoveredYear)).attr('stroke-opacity', 0.4);
      hoverGroup.selectAll('*').remove();
      hoverGroup.attr('opacity', 1);

      var tooltipX = x(hoveredYear) + 10;
      var tooltipY = margin.top + 8;
      if (tooltipX > chartWidth - 140) tooltipX = x(hoveredYear) - 110;

      hoverGroup.append('rect')
        .attr('x', tooltipX - 6).attr('y', tooltipY - 4)
        .attr('width', 120).attr('height', 16 + selectedNeighborhoods.length * 18)
        .attr('fill', 'rgba(255,255,255,0.94)')
        .attr('stroke', '#D6D2C8').attr('stroke-width', 0.5)
        .attr('rx', 4);

      hoverGroup.append('text')
        .attr('x', tooltipX).attr('y', tooltipY + 10)
        .attr('fill', '#46433C').style('font-size', '11px')
        .style('font-weight', '700').style('font-family', font)
        .text(hoveredYear);

      selectedNeighborhoods.forEach(function(nh, i) {
        var match = data.find(function(d) { return d.neighborhood === nh && d.year === hoveredYear; });
        var val = match ? match[selectedMetric] : null;
        var color = isHoldNeighborhood(nh) ? '#1B3A5C' : '#C68B3C';

        hoverGroup.append('text')
          .attr('x', tooltipX).attr('y', tooltipY + 28 + i * 18)
          .attr('fill', color).style('font-size', '11px')
          .style('font-family', font)
          .text(nh + ': ' + (val != null ? activeMetric.format(val) : 'n/a'));

        /* dot on the line at this year */
        if (match && val != null) {
          hoverGroup.append('circle')
            .attr('cx', x(hoveredYear)).attr('cy', y(val))
            .attr('r', 4).attr('fill', color)
            .attr('stroke', '#fff').attr('stroke-width', 1.5);
        }
      });
    });

    hoverRect.on('mouseleave', function() {
      hoverLine.attr('stroke-opacity', 0);
      hoverGroup.attr('opacity', 0);
    });
  }

  onMount(function() {
    loadTimelineData();
    window.addEventListener('resize', drawChart);
    return function() { window.removeEventListener('resize', drawChart); };
  });

  $: if (data.length > 0) {
    tick().then(drawChart);
  }
</script>

<section class="timeline-panel" bind:this={wrapperEl}>
  <div class="timeline-controls">
    <div class="metric-buttons">
      {#each metrics as metric}
        <button
          class:active={selectedMetric === metric.key}
          on:click={() => selectedMetric = metric.key}
        >{metric.label}</button>
      {/each}
    </div>
    <div class="neighborhood-buttons">
      {#each neighborhoods as neighborhood}
        <button
          class="nh-btn"
          class:active={selectedNeighborhoods.includes(neighborhood)}
          class:nh-hold={isHoldNeighborhood(neighborhood)}
          class:nh-flip={!isHoldNeighborhood(neighborhood)}
          on:click={() => toggleNeighborhood(neighborhood)}
        >{neighborhood}</button>
      {/each}
    </div>
  </div>

  {#if data.length === 0}
    <div class="timeline-empty">Loading neighborhood data\u2026</div>
  {:else}
    <svg bind:this={svgEl} class="timeline-chart"></svg>
  {/if}
</section>

<style>
  .timeline-panel {
    width: 100%;
  }

  .timeline-controls {
    margin-bottom: 18px;
  }

  .metric-buttons {
    display: flex;
    gap: 6px;
    margin-bottom: 12px;
  }

  .metric-buttons button {
    padding: 6px 14px;
    border: 1px solid var(--rule);
    border-radius: 6px;
    background: transparent;
    color: var(--sub);
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }

  .metric-buttons button:hover {
    border-color: var(--neutral);
    color: var(--text);
  }

  .metric-buttons button.active {
    background: var(--ink);
    border-color: var(--ink);
    color: #fff;
  }

  .metric-buttons button:focus-visible {
    outline: 2px solid var(--navy);
    outline-offset: 2px;
  }

  .neighborhood-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  .nh-btn {
    padding: 4px 10px;
    border: 1px solid var(--rule);
    border-radius: 5px;
    background: transparent;
    color: var(--faint);
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .nh-btn:hover {
    border-color: var(--neutral);
    color: var(--text);
  }

  .nh-btn.active.nh-hold {
    background: var(--navy);
    border-color: var(--navy);
    color: #fff;
    font-weight: 700;
  }

  .nh-btn.active.nh-flip {
    background: var(--amber);
    border-color: var(--amber);
    color: #fff;
    font-weight: 700;
  }

  .nh-btn:focus-visible {
    outline: 2px solid var(--navy);
    outline-offset: 2px;
  }

  .timeline-chart {
    width: 100%;
    height: 380px;
  }

  .timeline-empty {
    display: grid;
    height: 200px;
    place-items: center;
    color: var(--faint);
    font-size: 13px;
  }
</style>
