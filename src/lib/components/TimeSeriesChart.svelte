<script>
  /* Time-series chart of investor share, scroll-linked.
   *
   * The line's stroke-dashoffset is bound directly to a 0..1 progress
   * value computed from the reader's scroll position through Section 01.
   * Scroll halfway through, the line is half drawn. Scroll back, it
   * retreats. The reader unspools time with the wheel.
   *
   * The component is mounted once at the start of the story and stays
   * mounted. Data loads asynchronously; once the SVG paths exist, the
   * reactive block sets dashoffset on every progress change. No timed
   * animation, no race, no setTimeout fallback. */

  import * as d3 from 'd3';
  import { onMount } from 'svelte';

  export let width = 680;
  export let height = 400;
  export let progress = 0;
  export let visible = false;

  let el;
  let data = [];

  let pathAll = null;
  let pathTop = null;
  let lenAll = 0;
  let lenTop = 0;
  let annotations = null;
  let marker2008 = null;
  let marker2008Pulsed = false;
  let built = false;

  /* Lighter palette tuned for the dark Section 01 background. */
  const COLOR_NAVY = '#8AAEC8';
  const AXIS_TEXT = 'rgba(242, 240, 234, 0.55)';
  const AXIS_LINE = 'rgba(242, 240, 234, 0.18)';
  const GRID_LINE = 'rgba(242, 240, 234, 0.08)';
  const MARKER_LINE = 'rgba(242, 240, 234, 0.32)';
  const LEGEND_TEXT = 'rgba(242, 240, 234, 0.7)';

  onMount(async () => {
    try {
      data = await d3.json('data/investor_share_yearly.json');
      if (el && data.length) buildChart();
    } catch (e) {
      console.error('TimeSeriesChart: could not load data', e);
    }
  });

  /* Scroll-linked line drawing. As progress goes 0..1, dashoffset goes
   * from full length to zero, revealing the line tip first. */
  $: if (built && pathAll && pathTop) {
    let p = clamp01(progress);
    pathAll.attr('stroke-dashoffset', (1 - p) * lenAll);
    pathTop.attr('stroke-dashoffset', (1 - p) * lenTop);

    if (annotations) {
      let aOpacity = clamp01((p - 0.78) / 0.18);
      annotations.attr('opacity', aOpacity);
    }

    /* One-shot pulse when the line crosses the 2008 marker. The crisis
     * year sits roughly 36% along the time axis 2000 to 2022. */
    if (marker2008 && !marker2008Pulsed && p >= 0.36) {
      marker2008Pulsed = true;
      marker2008
        .transition().duration(360).ease(d3.easeCubicOut)
        .attr('stroke-opacity', 0.85)
        .transition().duration(420).ease(d3.easeCubicIn)
        .attr('stroke-opacity', 0.32);
    }
    /* Allow the pulse to play again if the reader scrolls well back. */
    if (p < 0.18) marker2008Pulsed = false;
  }

  function clamp01(v) {
    if (v == null || isNaN(v)) return 0;
    return Math.max(0, Math.min(1, v));
  }

  function buildChart() {
    el.innerHTML = '';

    var m = { top: 32, right: 64, bottom: 38, left: 54 };
    var w = width - m.left - m.right;
    var h = height - m.top - m.bottom;
    var font = 'Plus Jakarta Sans, sans-serif';
    var mono = 'IBM Plex Mono, monospace';

    var svg = d3.select(el).append('svg')
      .attr('width', '100%').attr('height', '100%')
      .attr('viewBox', '0 0 ' + width + ' ' + height)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('role', 'img')
      .attr('aria-label', 'Investor share of Boston home purchases rose from 16% to 27% after 2008 and never returned to pre-crisis levels')
      .style('overflow', 'visible');

    var g = svg.append('g').attr('transform', 'translate(' + m.left + ',' + m.top + ')');

    var x = d3.scaleLinear([2000, 2022], [0, w]);
    var yMax = Math.ceil(d3.max(data, function (d) { return d.top_decile_share; }) * 10) / 10;
    var y = d3.scaleLinear([0, yMax], [h, 0]);

    g.append('g').attr('transform', 'translate(0,' + h + ')')
      .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format('d')).tickSize(0))
      .call(function (a) { a.select('.domain').attr('stroke', AXIS_LINE); })
      .call(function (a) {
        a.selectAll('text').attr('fill', AXIS_TEXT)
          .style('font-size', '11px').style('font-family', font);
      });

    g.append('g')
      .call(d3.axisLeft(y).ticks(5)
        .tickFormat(function (d) { return Math.round(d * 100) + '%'; }).tickSize(0))
      .call(function (a) { a.select('.domain').remove(); })
      .call(function (a) {
        a.selectAll('.tick line').clone()
          .attr('x2', w).attr('stroke', GRID_LINE);
      })
      .call(function (a) {
        a.selectAll('text').attr('fill', AXIS_TEXT)
          .style('font-size', '11px').style('font-family', font);
      });

    marker2008 = g.append('line')
      .attr('x1', x(2008)).attr('x2', x(2008)).attr('y1', 0).attr('y2', h)
      .attr('stroke', MARKER_LINE).attr('stroke-dasharray', '4 3')
      .attr('stroke-opacity', 0.32);

    var lineAll = d3.line()
      .x(function (d) { return x(d.year); })
      .y(function (d) { return y(d.investor_share); })
      .curve(d3.curveMonotoneX);

    var lineTop = d3.line()
      .x(function (d) { return x(d.year); })
      .y(function (d) { return y(d.top_decile_share); })
      .curve(d3.curveMonotoneX);

    pathTop = g.append('path').datum(data).attr('fill', 'none')
      .attr('stroke', COLOR_NAVY).attr('stroke-width', 1.8)
      .attr('stroke-linecap', 'round')
      .attr('stroke-opacity', 0.85)
      .attr('d', lineTop);
    lenTop = pathTop.node().getTotalLength();
    pathTop.attr('stroke-dasharray', lenTop).attr('stroke-dashoffset', lenTop);

    pathAll = g.append('path').datum(data).attr('fill', 'none')
      .attr('stroke', COLOR_NAVY).attr('stroke-width', 3)
      .attr('stroke-linecap', 'round')
      .attr('d', lineAll);
    lenAll = pathAll.node().getTotalLength();
    pathAll.attr('stroke-dasharray', lenAll).attr('stroke-dashoffset', lenAll);

    var last = data[data.length - 1];
    var first = data[0];

    annotations = g.append('g').attr('opacity', 0);

    annotations.append('text').attr('x', x(2008)).attr('y', -10)
      .attr('text-anchor', 'middle').attr('fill', AXIS_TEXT)
      .style('font-size', '10px').style('font-family', font)
      .style('letter-spacing', '0.04em').text('2008');

    annotations.append('text').attr('x', x(2022) + 8)
      .attr('y', y(last.investor_share) + 4)
      .attr('fill', '#F2F0EA').style('font-size', '12px').style('font-weight', '700')
      .style('font-family', mono)
      .text(Math.round(last.investor_share * 100) + '%');

    annotations.append('text').attr('x', x(2022) + 8)
      .attr('y', y(last.top_decile_share) + 4)
      .attr('fill', COLOR_NAVY).style('font-size', '12px').style('font-weight', '700')
      .style('font-family', mono)
      .text(Math.round(last.top_decile_share * 100) + '%');

    annotations.append('text').attr('x', x(2000) - 6)
      .attr('y', y(first.investor_share) - 10)
      .attr('text-anchor', 'end').attr('fill', AXIS_TEXT)
      .style('font-size', '10px').style('font-family', mono)
      .text(Math.round(first.investor_share * 100) + '%');

    /* Inline legend, top-left of chart. */
    var lg = svg.append('g').attr('transform', 'translate(' + (m.left + 4) + ', 14)');
    lg.append('line').attr('x1', 0).attr('x2', 18).attr('y1', 0).attr('y2', 0)
      .attr('stroke', COLOR_NAVY).attr('stroke-width', 3);
    lg.append('text').attr('x', 24).attr('y', 4).attr('fill', LEGEND_TEXT)
      .style('font-size', '11px').style('font-family', font).text('All sales');
    lg.append('line').attr('x1', 95).attr('x2', 113).attr('y1', 0).attr('y2', 0)
      .attr('stroke', COLOR_NAVY).attr('stroke-width', 1.8).attr('stroke-opacity', 0.85);
    lg.append('text').attr('x', 119).attr('y', 4).attr('fill', LEGEND_TEXT)
      .style('font-size', '11px').style('font-family', font).text('Top price decile');

    built = true;
  }
</script>

<div class="ts-chart" bind:this={el} class:visible></div>

<style>
  .ts-chart {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
