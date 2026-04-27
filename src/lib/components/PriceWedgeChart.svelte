<script>
  import * as d3 from 'd3';
  import { onMount } from 'svelte';

  export let width = 560;
  export let height = 360;
  export let active = false;

  let el;
  let rawData = [];
  let hasAnimated = false;
  let pathHold = null;
  let pathFlip = null;
  let annotations = null;

  const DRAW_MS = 2800;
  const FLIP_DELAY = 600;
  const EASE = d3.easeCubicInOut;

  onMount(async () => {
    try {
      rawData = await d3.json('data/price_wedge_yearly.json');
      if (el && rawData.length) buildChart();
    } catch (e) {
      console.error('PriceWedgeChart: could not load data', e);
    }
  });

  $: if (active && !hasAnimated && pathHold) {
    hasAnimated = true;
    triggerAnimation();
  }

  function buildChart() {
    el.innerHTML = '';

    var holdData = rawData.filter(function(d) { return d.pattern === 'holding'; });
    var flipData = rawData.filter(function(d) { return d.pattern === 'flipping'; });

    var m = { top: 28, right: 58, bottom: 38, left: 52 };
    var w = width - m.left - m.right;
    var h = height - m.top - m.bottom;
    var yCap = 90;
    var font = 'Plus Jakarta Sans, sans-serif';
    var mono = 'IBM Plex Mono, monospace';

    var svg = d3.select(el).append('svg')
      .attr('width', width).attr('height', height)
      .attr('viewBox', '0 0 ' + width + ' ' + height)
      .attr('role', 'img')
      .attr('aria-label', 'Investor price premiums diverge: holding tracts reach +82% while flipping tracts saw crisis-era discounts of 25%')
      .style('max-width', '100%');

    svg.append('defs').append('clipPath').attr('id', 'pw-clip')
      .append('rect').attr('width', w).attr('height', h);

    var g = svg.append('g').attr('transform', 'translate(' + m.left + ',' + m.top + ')');

    var x = d3.scaleLinear([2000, 2022], [0, w]);
    var y = d3.scaleLinear([-30, yCap], [h, 0]);

    g.append('g').attr('transform', 'translate(0,' + h + ')')
      .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format('d')).tickSize(0))
      .call(function(a) { a.select('.domain').attr('stroke', '#D6D2C8'); })
      .call(function(a) {
        a.selectAll('text').attr('fill', '#9C9890')
          .style('font-size', '11px').style('font-family', font);
      });

    g.append('g')
      .call(d3.axisLeft(y).ticks(7)
        .tickFormat(function(d) { return (d > 0 ? '+' : '') + d + '%'; }).tickSize(0))
      .call(function(a) { a.select('.domain').remove(); })
      .call(function(a) {
        a.selectAll('.tick line').clone()
          .attr('x2', w).attr('stroke', '#D6D2C8').attr('stroke-opacity', 0.25);
      })
      .call(function(a) {
        a.selectAll('text').attr('fill', '#9C9890')
          .style('font-size', '11px').style('font-family', font);
      });

    /* zero reference */
    g.append('line').attr('x1', 0).attr('x2', w)
      .attr('y1', y(0)).attr('y2', y(0))
      .attr('stroke', '#B0A898').attr('stroke-width', 1).attr('stroke-dasharray', '4 3');

    var clipped = g.append('g').attr('clip-path', 'url(#pw-clip)');

    /* subtle area fills */
    var areaHold = d3.area()
      .x(function(d) { return x(d.year); }).y0(y(0))
      .y1(function(d) { return y(Math.min(d.premium, yCap)); })
      .curve(d3.curveMonotoneX);

    var areaFlip = d3.area()
      .x(function(d) { return x(d.year); }).y0(y(0))
      .y1(function(d) { return y(Math.max(d.premium, -30)); })
      .curve(d3.curveMonotoneX);

    clipped.append('path').datum(holdData)
      .attr('fill', '#1B3A5C').attr('fill-opacity', 0.04).attr('d', areaHold);
    clipped.append('path').datum(flipData)
      .attr('fill', '#C68B3C').attr('fill-opacity', 0.04).attr('d', areaFlip);

    /* line generators */
    var lineHold = d3.line()
      .x(function(d) { return x(d.year); })
      .y(function(d) { return y(Math.min(d.premium, yCap)); })
      .curve(d3.curveMonotoneX);

    var lineFlip = d3.line()
      .x(function(d) { return x(d.year); })
      .y(function(d) { return y(Math.max(d.premium, -30)); })
      .curve(d3.curveMonotoneX);

    /* draw lines hidden */
    pathHold = clipped.append('path').datum(holdData).attr('fill', 'none')
      .attr('stroke', '#1B3A5C').attr('stroke-width', 3)
      .attr('stroke-linecap', 'round').attr('d', lineHold);
    var lenH = pathHold.node().getTotalLength();
    pathHold.attr('stroke-dasharray', lenH).attr('stroke-dashoffset', lenH);

    pathFlip = clipped.append('path').datum(flipData).attr('fill', 'none')
      .attr('stroke', '#C68B3C').attr('stroke-width', 3)
      .attr('stroke-linecap', 'round').attr('d', lineFlip);
    var lenF = pathFlip.node().getTotalLength();
    pathFlip.attr('stroke-dasharray', lenF).attr('stroke-dashoffset', lenF);

    /* annotation group, invisible until animation finishes */
    annotations = g.append('g').attr('opacity', 0);

    var spike = holdData.find(function(d) { return d.year === 2019; });
    if (spike && spike.premium > yCap) {
      annotations.append('text').attr('x', x(2019)).attr('y', -6)
        .attr('text-anchor', 'middle').attr('fill', '#1B3A5C')
        .style('font-size', '10px').style('font-weight', '600')
        .style('font-family', mono).text('\u2191 +' + Math.round(spike.premium) + '%');
    }

    var trough = flipData.find(function(d) { return d.year === 2009; });
    if (trough) {
      annotations.append('text').attr('x', x(2009)).attr('y', y(trough.premium) + 16)
        .attr('text-anchor', 'middle').attr('fill', '#C68B3C')
        .style('font-size', '10px').style('font-weight', '600')
        .style('font-family', mono).text(Math.round(trough.premium) + '%');
    }

    var lastH = holdData[holdData.length - 1];
    var lastF = flipData[flipData.length - 1];

    annotations.append('text').attr('x', x(2022) + 6)
      .attr('y', y(Math.min(lastH.premium, yCap)) + 4)
      .attr('fill', '#1B3A5C').style('font-size', '12px').style('font-weight', '700')
      .style('font-family', mono).text('+' + Math.round(lastH.premium) + '%');

    annotations.append('text').attr('x', x(2022) + 6)
      .attr('y', y(lastF.premium) + 4)
      .attr('fill', '#C68B3C').style('font-size', '12px').style('font-weight', '700')
      .style('font-family', mono).text('+' + Math.round(lastF.premium) + '%');

    /* legend */
    var lg = svg.append('g').attr('transform', 'translate(' + (m.left + 8) + ', 14)');
    lg.append('line').attr('x1', 0).attr('x2', 18).attr('y1', 0).attr('y2', 0)
      .attr('stroke', '#1B3A5C').attr('stroke-width', 3);
    lg.append('text').attr('x', 24).attr('y', 4).attr('fill', '#46433C')
      .style('font-size', '11px').style('font-family', font).text('Holding tracts');
    lg.append('line').attr('x1', 135).attr('x2', 153).attr('y1', 0).attr('y2', 0)
      .attr('stroke', '#C68B3C').attr('stroke-width', 3);
    lg.append('text').attr('x', 159).attr('y', 4).attr('fill', '#46433C')
      .style('font-size', '11px').style('font-family', font).text('Flipping tracts');

    if (active && !hasAnimated) {
      hasAnimated = true;
      triggerAnimation();
    }
  }

  function triggerAnimation() {
    if (!pathHold || !pathFlip) return;

    pathHold.transition().duration(DRAW_MS).ease(EASE)
      .attr('stroke-dashoffset', 0)
      .on('end', function() { d3.select(this).attr('stroke-dasharray', null); });

    pathFlip.transition().delay(FLIP_DELAY).duration(DRAW_MS).ease(EASE)
      .attr('stroke-dashoffset', 0)
      .on('end', function() { d3.select(this).attr('stroke-dasharray', null); });

    annotations.transition().delay(DRAW_MS + FLIP_DELAY + 400)
      .duration(600).ease(d3.easeCubicOut).attr('opacity', 1);
  }
</script>

<div bind:this={el}></div>
