<script>
  import * as d3 from 'd3';
  import { onMount } from 'svelte';

  export let width = 520;
  export let height = 320;

  let el;
  let rawData = [];

  onMount(async () => {
    try {
      rawData = await d3.json('data/price_wedge_yearly.json');
      if (el && rawData.length) draw();
    } catch (e) {
      console.error('PriceWedgeChart: could not load data', e);
    }
  });

  function draw() {
    el.innerHTML = '';

    var holdData = rawData.filter(function(d) { return d.pattern === 'holding'; });
    var flipData = rawData.filter(function(d) { return d.pattern === 'flipping'; });

    var m = { top: 32, right: 58, bottom: 38, left: 52 };
    var w = width - m.left - m.right;
    var h = height - m.top - m.bottom;
    var yCap = 90;

    var font = 'Plus Jakarta Sans, sans-serif';
    var mono = 'IBM Plex Mono, monospace';

    var DRAW_MS = 2800;
    var FLIP_DELAY = 600;
    var EASE = d3.easeCubicInOut;

    var svg = d3.select(el).append('svg')
      .attr('width', width).attr('height', height)
      .attr('viewBox', '0 0 ' + width + ' ' + height)
      .attr('role', 'img')
      .attr('aria-label', 'Line chart showing investor price premiums diverging: holding tracts reaching +82% while flipping tracts paid discounts during the crisis')
      .style('max-width', '100%');

    svg.append('defs').append('clipPath').attr('id', 'pw-clip')
      .append('rect').attr('width', w).attr('height', h);

    var g = svg.append('g').attr('transform', 'translate(' + m.left + ',' + m.top + ')');

    var x = d3.scaleLinear([2000, 2022], [0, w]);
    var y = d3.scaleLinear([-30, yCap], [h, 0]);

    /* x axis */
    g.append('g').attr('transform', 'translate(0,' + h + ')')
      .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format('d')).tickSize(0))
      .call(function(axis) { axis.select('.domain').attr('stroke', '#D6D2C8'); })
      .call(function(axis) {
        axis.selectAll('text').attr('fill', '#9C9890')
          .style('font-size', '11px').style('font-family', font);
      });

    /* y axis with faint gridlines */
    g.append('g')
      .call(d3.axisLeft(y).ticks(7)
        .tickFormat(function(d) { return (d > 0 ? '+' : '') + d + '%'; }).tickSize(0))
      .call(function(axis) { axis.select('.domain').remove(); })
      .call(function(axis) {
        axis.selectAll('.tick line').clone()
          .attr('x2', w).attr('stroke', '#D6D2C8').attr('stroke-opacity', 0.3);
      })
      .call(function(axis) {
        axis.selectAll('text').attr('fill', '#9C9890')
          .style('font-size', '11px').style('font-family', font);
      });

    /* zero reference line */
    g.append('line').attr('x1', 0).attr('x2', w)
      .attr('y1', y(0)).attr('y2', y(0))
      .attr('stroke', '#B0A898').attr('stroke-width', 1).attr('stroke-dasharray', '4 3');

    var clipped = g.append('g').attr('clip-path', 'url(#pw-clip)');

    /* subtle area fills beneath each line */
    var areaHold = d3.area()
      .x(function(d) { return x(d.year); }).y0(y(0))
      .y1(function(d) { return y(Math.min(d.premium, yCap)); })
      .curve(d3.curveMonotoneX);

    var areaFlip = d3.area()
      .x(function(d) { return x(d.year); }).y0(y(0))
      .y1(function(d) { return y(Math.max(d.premium, -30)); })
      .curve(d3.curveMonotoneX);

    clipped.append('path').datum(holdData)
      .attr('fill', '#1B3A5C').attr('fill-opacity', 0.05).attr('d', areaHold);
    clipped.append('path').datum(flipData)
      .attr('fill', '#C68B3C').attr('fill-opacity', 0.05).attr('d', areaFlip);

    /* line generators, clamped to the visible y range */
    var lineHold = d3.line()
      .x(function(d) { return x(d.year); })
      .y(function(d) { return y(Math.min(d.premium, yCap)); })
      .curve(d3.curveMonotoneX);

    var lineFlip = d3.line()
      .x(function(d) { return x(d.year); })
      .y(function(d) { return y(Math.max(d.premium, -30)); })
      .curve(d3.curveMonotoneX);

    /* staggered animated draw: holding first, flipping enters later */
    function animateLine(gen, lineData, color, sw, delay) {
      var p = clipped.append('path').datum(lineData).attr('fill', 'none')
        .attr('stroke', color).attr('stroke-width', sw)
        .attr('stroke-linecap', 'round').attr('d', gen);
      var len = p.node().getTotalLength();
      p.attr('stroke-dasharray', len).attr('stroke-dashoffset', len)
        .transition().delay(delay).duration(DRAW_MS).ease(EASE)
        .attr('stroke-dashoffset', 0)
        .on('end', function() { d3.select(this).attr('stroke-dasharray', null); });
    }

    animateLine(lineHold, holdData, '#1B3A5C', 3, 0);
    animateLine(lineFlip, flipData, '#C68B3C', 3, FLIP_DELAY);

    /* annotations fade in after both lines finish */
    var annotDelay = DRAW_MS + FLIP_DELAY + 400;
    var annotations = g.append('g').attr('opacity', 0);

    /* spike callout for 2019 */
    var spike = holdData.find(function(d) { return d.year === 2019; });
    if (spike && spike.premium > yCap) {
      annotations.append('text').attr('x', x(2019)).attr('y', -6)
        .attr('text-anchor', 'middle').attr('fill', '#1B3A5C')
        .style('font-size', '10px').style('font-weight', '600')
        .style('font-family', mono).text('\u2191 +' + Math.round(spike.premium) + '%');
    }

    /* trough callout for 2009 */
    var trough = flipData.find(function(d) { return d.year === 2009; });
    if (trough) {
      annotations.append('text').attr('x', x(2009)).attr('y', y(trough.premium) + 16)
        .attr('text-anchor', 'middle').attr('fill', '#C68B3C')
        .style('font-size', '10px').style('font-weight', '600')
        .style('font-family', mono).text(Math.round(trough.premium) + '%');
    }

    /* endpoint labels */
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

    /* fade in all annotations together */
    annotations.transition().delay(annotDelay).duration(600).ease(d3.easeCubicOut)
      .attr('opacity', 1);

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
  }
</script>

<div bind:this={el}></div>
