<script>
  import * as d3 from 'd3';
  import { onMount } from 'svelte';

  export let width = 560;
  export let height = 380;
  export let active = false;

  let el;
  let data = [];
  let hasAnimated = false;
  let lineAll = null;
  let lineTop = null;
  let pathAll = null;
  let pathTop = null;
  let annotations = null;

  const DRAW_MS = 2800;
  const EASE = d3.easeCubicInOut;

  onMount(async () => {
    try {
      data = await d3.json('data/investor_share_yearly.json');
      if (el && data.length) buildChart();
    } catch (e) {
      console.error('TimeSeriesChart: could not load data', e);
    }
  });

  /* when the scroll step activates this section, trigger the draw */
  $: if (active && !hasAnimated && pathAll) {
    hasAnimated = true;
    triggerAnimation();
  }

  function buildChart() {
    el.innerHTML = '';

    var m = { top: 28, right: 58, bottom: 38, left: 50 };
    var w = width - m.left - m.right;
    var h = height - m.top - m.bottom;
    var font = 'Plus Jakarta Sans, sans-serif';
    var mono = 'IBM Plex Mono, monospace';

    var svg = d3.select(el).append('svg')
      .attr('width', width).attr('height', height)
      .attr('viewBox', '0 0 ' + width + ' ' + height)
      .attr('role', 'img')
      .attr('aria-label', 'Investor share of Boston home purchases rose from 16% to 27% after 2008 and never returned to pre-crisis levels')
      .style('max-width', '100%');

    var g = svg.append('g').attr('transform', 'translate(' + m.left + ',' + m.top + ')');

    var x = d3.scaleLinear([2000, 2022], [0, w]);
    var yMax = Math.ceil(d3.max(data, function(d) { return d.top_decile_share; }) * 10) / 10;
    var y = d3.scaleLinear([0, yMax], [h, 0]);

    /* x axis */
    g.append('g').attr('transform', 'translate(0,' + h + ')')
      .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format('d')).tickSize(0))
      .call(function(a) { a.select('.domain').attr('stroke', '#D6D2C8'); })
      .call(function(a) {
        a.selectAll('text').attr('fill', '#9C9890')
          .style('font-size', '11px').style('font-family', font);
      });

    /* y axis with faint gridlines */
    g.append('g')
      .call(d3.axisLeft(y).ticks(5)
        .tickFormat(function(d) { return Math.round(d * 100) + '%'; }).tickSize(0))
      .call(function(a) { a.select('.domain').remove(); })
      .call(function(a) {
        a.selectAll('.tick line').clone()
          .attr('x2', w).attr('stroke', '#D6D2C8').attr('stroke-opacity', 0.25);
      })
      .call(function(a) {
        a.selectAll('text').attr('fill', '#9C9890')
          .style('font-size', '11px').style('font-family', font);
      });

    /* 2008 marker is visible from the start, setting context */
    g.append('line')
      .attr('x1', x(2008)).attr('x2', x(2008)).attr('y1', 0).attr('y2', h)
      .attr('stroke', '#B0A898').attr('stroke-dasharray', '4 3');

    /* build line generators */
    lineAll = d3.line()
      .x(function(d) { return x(d.year); })
      .y(function(d) { return y(d.investor_share); })
      .curve(d3.curveMonotoneX);

    lineTop = d3.line()
      .x(function(d) { return x(d.year); })
      .y(function(d) { return y(d.top_decile_share); })
      .curve(d3.curveMonotoneX);

    /* draw lines but keep them hidden (full dashoffset) */
    pathTop = g.append('path').datum(data).attr('fill', 'none')
      .attr('stroke', '#8AAEC8').attr('stroke-width', 2)
      .attr('stroke-linecap', 'round').attr('d', lineTop);
    var lenTop = pathTop.node().getTotalLength();
    pathTop.attr('stroke-dasharray', lenTop).attr('stroke-dashoffset', lenTop);

    pathAll = g.append('path').datum(data).attr('fill', 'none')
      .attr('stroke', '#1B3A5C').attr('stroke-width', 3)
      .attr('stroke-linecap', 'round').attr('d', lineAll);
    var lenAll = pathAll.node().getTotalLength();
    pathAll.attr('stroke-dasharray', lenAll).attr('stroke-dashoffset', lenAll);

    /* annotation group starts invisible */
    var last = data[data.length - 1];
    var first = data[0];

    annotations = g.append('g').attr('opacity', 0);

    annotations.append('text').attr('x', x(2008)).attr('y', -8)
      .attr('text-anchor', 'middle').attr('fill', '#9C9890')
      .style('font-size', '10px').style('font-family', font).text('2008');

    annotations.append('text').attr('x', x(2022) + 6)
      .attr('y', y(last.investor_share) + 4)
      .attr('fill', '#1B3A5C').style('font-size', '12px').style('font-weight', '700')
      .style('font-family', mono)
      .text(Math.round(last.investor_share * 100) + '%');

    annotations.append('text').attr('x', x(2022) + 6)
      .attr('y', y(last.top_decile_share) + 4)
      .attr('fill', '#8AAEC8').style('font-size', '12px').style('font-weight', '700')
      .style('font-family', mono)
      .text(Math.round(last.top_decile_share * 100) + '%');

    annotations.append('text').attr('x', x(2000) - 4)
      .attr('y', y(first.investor_share) - 8)
      .attr('text-anchor', 'end').attr('fill', '#1B3A5C')
      .style('font-size', '10px').style('font-family', mono)
      .text(Math.round(first.investor_share * 100) + '%');

    /* legend (always visible) */
    var lg = svg.append('g').attr('transform', 'translate(' + (m.left + 8) + ', 14)');
    lg.append('line').attr('x1', 0).attr('x2', 18).attr('y1', 0).attr('y2', 0)
      .attr('stroke', '#1B3A5C').attr('stroke-width', 3);
    lg.append('text').attr('x', 24).attr('y', 4).attr('fill', '#46433C')
      .style('font-size', '11px').style('font-family', font).text('All sales');
    lg.append('line').attr('x1', 95).attr('x2', 113).attr('y1', 0).attr('y2', 0)
      .attr('stroke', '#8AAEC8').attr('stroke-width', 2);
    lg.append('text').attr('x', 119).attr('y', 4).attr('fill', '#46433C')
      .style('font-size', '11px').style('font-family', font).text('Top price decile');

    /* if already active when built (edge case), animate immediately */
    if (active && !hasAnimated) {
      hasAnimated = true;
      triggerAnimation();
    }
  }

  function triggerAnimation() {
    if (!pathAll || !pathTop) return;

    var lenTop = pathTop.node().getTotalLength();
    pathTop.transition().delay(200).duration(DRAW_MS).ease(EASE)
      .attr('stroke-dashoffset', 0)
      .on('end', function() { d3.select(this).attr('stroke-dasharray', null); });

    var lenAll = pathAll.node().getTotalLength();
    pathAll.transition().duration(DRAW_MS).ease(EASE)
      .attr('stroke-dashoffset', 0)
      .on('end', function() { d3.select(this).attr('stroke-dasharray', null); });

    annotations.transition().delay(DRAW_MS + 400).duration(600).ease(d3.easeCubicOut)
      .attr('opacity', 1);
  }
</script>

<div bind:this={el}></div>
