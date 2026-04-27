<script>
  /* Price wedge, scroll-linked.
   *
   * Two lines diverge from a common floor at zero. Holding climbs past
   * +80%. Flipping plunges to -25% during the crisis. The gap between
   * them is the visual signature of two opposite strategies. We fill
   * that gap with a vertical gradient (navy at top, amber at bottom)
   * at low opacity, clipped by a rect whose width tracks scroll
   * progress. The wedge unzips left to right with the wheel.
   *
   * Both line stroke-dashoffsets are bound to the same progress, so
   * the lines and the gap reveal in lockstep. */

  import * as d3 from 'd3';
  import { onMount } from 'svelte';

  export let width = 680;
  export let height = 380;
  export let progress = 0;
  export let visible = false;

  let el;
  let rawData = [];

  let pathHold = null;
  let pathFlip = null;
  let lenHold = 0;
  let lenFlip = 0;
  let annotations = null;
  let gapClipRect = null;
  let chartW = 0;
  let marker2008 = null;
  let marker2008Pulsed = false;
  let built = false;

  /* Lighter palette tuned for the dark Section 03 background. */
  const COLOR_NAVY = '#8AAEC8';
  const COLOR_AMBER = '#D8A45A';
  const AXIS_TEXT = 'rgba(242, 240, 234, 0.55)';
  const AXIS_LINE = 'rgba(242, 240, 234, 0.18)';
  const GRID_LINE = 'rgba(242, 240, 234, 0.08)';
  const ZERO_LINE = 'rgba(242, 240, 234, 0.28)';
  const MARKER_LINE = 'rgba(242, 240, 234, 0.32)';
  const LEGEND_TEXT = 'rgba(242, 240, 234, 0.7)';

  onMount(async () => {
    try {
      rawData = await d3.json('data/price_wedge_yearly.json');
      if (el && rawData.length) buildChart();
    } catch (e) {
      console.error('PriceWedgeChart: could not load data', e);
    }
  });

  /* Scroll-linked reveal. Both lines and the gap fill advance together
   * with the reader's scroll. Final-value annotations fade in late. */
  $: if (built && pathHold && pathFlip) {
    let p = clamp01(progress);
    pathHold.attr('stroke-dashoffset', (1 - p) * lenHold);
    pathFlip.attr('stroke-dashoffset', (1 - p) * lenFlip);

    if (gapClipRect) gapClipRect.attr('width', p * chartW);

    if (annotations) {
      let aOpacity = clamp01((p - 0.78) / 0.18);
      annotations.attr('opacity', aOpacity);
    }

    if (marker2008 && !marker2008Pulsed && p >= 0.36) {
      marker2008Pulsed = true;
      marker2008
        .transition().duration(360).ease(d3.easeCubicOut)
        .attr('stroke-opacity', 0.85)
        .transition().duration(420).ease(d3.easeCubicIn)
        .attr('stroke-opacity', 0.32);
    }
    if (p < 0.18) marker2008Pulsed = false;
  }

  function clamp01(v) {
    if (v == null || isNaN(v)) return 0;
    return Math.max(0, Math.min(1, v));
  }

  function buildChart() {
    el.innerHTML = '';

    var holdData = rawData.filter(function (d) { return d.pattern === 'holding'; });
    var flipData = rawData.filter(function (d) { return d.pattern === 'flipping'; });

    /* Pivot rows so the gap area can interpolate between the two lines
     * year by year. Only years where both values exist are kept. */
    var byYear = {};
    rawData.forEach(function (d) {
      if (!byYear[d.year]) byYear[d.year] = { year: d.year };
      byYear[d.year][d.pattern] = d.premium;
    });
    var combined = Object.values(byYear)
      .filter(function (d) { return d.holding != null && d.flipping != null; })
      .sort(function (a, b) { return a.year - b.year; });

    var m = { top: 32, right: 64, bottom: 38, left: 56 };
    var w = width - m.left - m.right;
    var h = height - m.top - m.bottom;
    chartW = w;
    var yCap = 90;
    var font = 'Plus Jakarta Sans, sans-serif';
    var mono = 'IBM Plex Mono, monospace';

    var svg = d3.select(el).append('svg')
      .attr('width', '100%').attr('height', '100%')
      .attr('viewBox', '0 0 ' + width + ' ' + height)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('role', 'img')
      .attr('aria-label', 'Investor price premiums diverge: holding tracts reach plus 82% while flipping tracts saw crisis era discounts of 25%')
      .style('overflow', 'visible');

    var defs = svg.append('defs');
    defs.append('clipPath').attr('id', 'pw-line-clip')
      .append('rect').attr('width', w).attr('height', h);
    defs.append('clipPath').attr('id', 'pw-gap-clip')
      .append('rect').attr('width', 0).attr('height', h);

    /* Gap fill gradient: navy at top edge, amber at bottom edge,
     * low opacity throughout. The gap reads as a soft band, not a
     * heavy block. */
    var grad = defs.append('linearGradient').attr('id', 'pw-gap-grad')
      .attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 1);
    grad.append('stop').attr('offset', '0%')
      .attr('stop-color', COLOR_NAVY).attr('stop-opacity', 0.10);
    grad.append('stop').attr('offset', '50%')
      .attr('stop-color', COLOR_NAVY).attr('stop-opacity', 0.04);
    grad.append('stop').attr('offset', '100%')
      .attr('stop-color', COLOR_AMBER).attr('stop-opacity', 0.10);

    gapClipRect = defs.select('#pw-gap-clip rect');

    var g = svg.append('g').attr('transform', 'translate(' + m.left + ',' + m.top + ')');
    var x = d3.scaleLinear([2000, 2022], [0, w]);
    var y = d3.scaleLinear([-30, yCap], [h, 0]);

    g.append('g').attr('transform', 'translate(0,' + h + ')')
      .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format('d')).tickSize(0))
      .call(function (a) { a.select('.domain').attr('stroke', AXIS_LINE); })
      .call(function (a) {
        a.selectAll('text').attr('fill', AXIS_TEXT)
          .style('font-size', '11px').style('font-family', font);
      });

    g.append('g')
      .call(d3.axisLeft(y).ticks(7)
        .tickFormat(function (d) { return (d > 0 ? '+' : '') + d + '%'; }).tickSize(0))
      .call(function (a) { a.select('.domain').remove(); })
      .call(function (a) {
        a.selectAll('.tick line').clone()
          .attr('x2', w).attr('stroke', GRID_LINE);
      })
      .call(function (a) {
        a.selectAll('text').attr('fill', AXIS_TEXT)
          .style('font-size', '11px').style('font-family', font);
      });

    /* Zero line, slightly more visible than gridlines. Above it is
     * overpaying. Below it is buying the crisis. */
    g.append('line').attr('x1', 0).attr('x2', w)
      .attr('y1', y(0)).attr('y2', y(0))
      .attr('stroke', ZERO_LINE).attr('stroke-width', 1).attr('stroke-dasharray', '3 3');

    /* Gap fill, behind everything else, clipped by the rect that grows
     * with progress. */
    var gapArea = d3.area()
      .x(function (d) { return x(d.year); })
      .y0(function (d) { return y(Math.max(d.flipping, -30)); })
      .y1(function (d) { return y(Math.min(d.holding, yCap)); })
      .curve(d3.curveMonotoneX);

    g.append('path').datum(combined)
      .attr('fill', 'url(#pw-gap-grad)')
      .attr('d', gapArea)
      .attr('clip-path', 'url(#pw-gap-clip)');

    /* 2008 marker after the gap fill so it sits above the band. */
    marker2008 = g.append('line')
      .attr('x1', x(2008)).attr('x2', x(2008)).attr('y1', 0).attr('y2', h)
      .attr('stroke', MARKER_LINE).attr('stroke-dasharray', '4 3')
      .attr('stroke-opacity', 0.32);

    var lineHold = d3.line()
      .x(function (d) { return x(d.year); })
      .y(function (d) { return y(Math.min(d.premium, yCap)); })
      .curve(d3.curveMonotoneX);
    var lineFlip = d3.line()
      .x(function (d) { return x(d.year); })
      .y(function (d) { return y(Math.max(d.premium, -30)); })
      .curve(d3.curveMonotoneX);

    pathHold = g.append('path').datum(holdData).attr('fill', 'none')
      .attr('stroke', COLOR_NAVY).attr('stroke-width', 3)
      .attr('stroke-linecap', 'round').attr('d', lineHold);
    lenHold = pathHold.node().getTotalLength();
    pathHold.attr('stroke-dasharray', lenHold).attr('stroke-dashoffset', lenHold);

    pathFlip = g.append('path').datum(flipData).attr('fill', 'none')
      .attr('stroke', COLOR_AMBER).attr('stroke-width', 3)
      .attr('stroke-linecap', 'round').attr('d', lineFlip);
    lenFlip = pathFlip.node().getTotalLength();
    pathFlip.attr('stroke-dasharray', lenFlip).attr('stroke-dashoffset', lenFlip);

    annotations = g.append('g').attr('opacity', 0);

    var spike = holdData.find(function (d) { return d.year === 2019; });
    if (spike && spike.premium > yCap) {
      annotations.append('text').attr('x', x(2019)).attr('y', -8)
        .attr('text-anchor', 'middle').attr('fill', COLOR_NAVY)
        .style('font-size', '10px').style('font-weight', '700')
        .style('font-family', mono).text('↑ +' + Math.round(spike.premium) + '%');
    }

    var trough = flipData.find(function (d) { return d.year === 2009; });
    if (trough) {
      annotations.append('text').attr('x', x(2009)).attr('y', y(trough.premium) + 18)
        .attr('text-anchor', 'middle').attr('fill', COLOR_AMBER)
        .style('font-size', '10px').style('font-weight', '700')
        .style('font-family', mono).text(Math.round(trough.premium) + '%');
    }

    var lastH = holdData[holdData.length - 1];
    var lastF = flipData[flipData.length - 1];
    annotations.append('text').attr('x', x(2022) + 8)
      .attr('y', y(Math.min(lastH.premium, yCap)) + 4)
      .attr('fill', COLOR_NAVY).style('font-size', '12px').style('font-weight', '700')
      .style('font-family', mono).text('+' + Math.round(lastH.premium) + '%');
    annotations.append('text').attr('x', x(2022) + 8)
      .attr('y', y(lastF.premium) + 4)
      .attr('fill', COLOR_AMBER).style('font-size', '12px').style('font-weight', '700')
      .style('font-family', mono).text('+' + Math.round(lastF.premium) + '%');

    /* Inline legend, top-left. */
    var lg = svg.append('g').attr('transform', 'translate(' + (m.left + 4) + ', 14)');
    lg.append('line').attr('x1', 0).attr('x2', 18).attr('y1', 0).attr('y2', 0)
      .attr('stroke', COLOR_NAVY).attr('stroke-width', 3);
    lg.append('text').attr('x', 24).attr('y', 4).attr('fill', LEGEND_TEXT)
      .style('font-size', '11px').style('font-family', font).text('Holding tracts');
    lg.append('line').attr('x1', 135).attr('x2', 153).attr('y1', 0).attr('y2', 0)
      .attr('stroke', COLOR_AMBER).attr('stroke-width', 3);
    lg.append('text').attr('x', 159).attr('y', 4).attr('fill', LEGEND_TEXT)
      .style('font-size', '11px').style('font-family', font).text('Flipping tracts');

    built = true;
  }
</script>

<div class="pw-chart" bind:this={el} class:visible></div>

<style>
  .pw-chart {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
