<script>
  import * as d3 from 'd3';
  import { onMount } from 'svelte';

  export let width = 520;
  export let height = 320;

  let el;
  let data = [];

  onMount(async () => {
    try {
      data = await d3.json('data/investor_share_yearly.json');
      if (el && data.length) draw();
    } catch (e) {
      console.error('TimeSeriesChart: could not load data', e);
    }
  });

  function draw() {
    el.innerHTML = '';

    var m = { top: 32, right: 58, bottom: 38, left: 50 };
    var w = width - m.left - m.right;
    var h = height - m.top - m.bottom;

    var font = 'Plus Jakarta Sans, sans-serif';
    var mono = 'IBM Plex Mono, monospace';

    var svg = d3.select(el).append('svg')
      .attr('width', width).attr('height', height)
      .attr('viewBox', '0 0 ' + width + ' ' + height)
      .attr('role', 'img')
      .attr('aria-label', 'Line chart showing investor share of Boston home purchases rising from 16% in 2000 to 27% in 2022, with a permanent jump after 2008')
      .style('max-width', '100%');

    var g = svg.append('g').attr('transform', 'translate(' + m.left + ',' + m.top + ')');

    var x = d3.scaleLinear([2000, 2022], [0, w]);
    var yMax = Math.ceil(d3.max(data, function(d) { return d.top_decile_share; }) * 10) / 10;
    var y = d3.scaleLinear([0, yMax], [h, 0]);

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
      .call(d3.axisLeft(y).ticks(5).tickFormat(function(d) { return Math.round(d * 100) + '%'; }).tickSize(0))
      .call(function(axis) { axis.select('.domain').remove(); })
      .call(function(axis) {
        axis.selectAll('.tick line').clone()
          .attr('x2', w).attr('stroke', '#D6D2C8').attr('stroke-opacity', 0.3);
      })
      .call(function(axis) {
        axis.selectAll('text').attr('fill', '#9C9890')
          .style('font-size', '11px').style('font-family', font);
      });

    /* 2008 marker (visible from the start, context before the lines arrive) */
    g.append('line')
      .attr('x1', x(2008)).attr('x2', x(2008)).attr('y1', 0).attr('y2', h)
      .attr('stroke', '#B0A898').attr('stroke-dasharray', '4 3');

    /* line generators */
    var lineAll = d3.line()
      .x(function(d) { return x(d.year); })
      .y(function(d) { return y(d.investor_share); })
      .curve(d3.curveMonotoneX);

    var lineTop = d3.line()
      .x(function(d) { return x(d.year); })
      .y(function(d) { return y(d.top_decile_share); })
      .curve(d3.curveMonotoneX);

    /* animated line draw with cinematic pacing */
    var DRAW_MS = 2800;
    var EASE = d3.easeCubicInOut;

    function animateLine(gen, color, sw, delay) {
      var p = g.append('path').datum(data).attr('fill', 'none')
        .attr('stroke', color).attr('stroke-width', sw)
        .attr('stroke-linecap', 'round').attr('d', gen);
      var len = p.node().getTotalLength();
      p.attr('stroke-dasharray', len).attr('stroke-dashoffset', len)
        .transition().delay(delay).duration(DRAW_MS).ease(EASE)
        .attr('stroke-dashoffset', 0)
        .on('end', function() { d3.select(this).attr('stroke-dasharray', null); });
    }

    animateLine(lineTop, '#8AAEC8', 2, 200);
    animateLine(lineAll, '#1B3A5C', 3, 0);

    /* annotations appear after the lines finish drawing */
    var last = data[data.length - 1];
    var first = data[0];
    var annotDelay = DRAW_MS + 400;

    var annotations = g.append('g').attr('opacity', 0);

    /* 2008 label */
    annotations.append('text').attr('x', x(2008)).attr('y', -8)
      .attr('text-anchor', 'middle').attr('fill', '#9C9890')
      .style('font-size', '10px').style('font-family', font).text('2008');

    /* endpoint: all sales */
    annotations.append('text').attr('x', x(2022) + 6)
      .attr('y', y(last.investor_share) + 4)
      .attr('fill', '#1B3A5C').style('font-size', '12px').style('font-weight', '700')
      .style('font-family', mono)
      .text(Math.round(last.investor_share * 100) + '%');

    /* endpoint: top decile */
    annotations.append('text').attr('x', x(2022) + 6)
      .attr('y', y(last.top_decile_share) + 4)
      .attr('fill', '#8AAEC8').style('font-size', '12px').style('font-weight', '700')
      .style('font-family', mono)
      .text(Math.round(last.top_decile_share * 100) + '%');

    /* start label */
    annotations.append('text').attr('x', x(2000) - 4)
      .attr('y', y(first.investor_share) - 8)
      .attr('text-anchor', 'end').attr('fill', '#1B3A5C')
      .style('font-size', '10px').style('font-family', mono)
      .text(Math.round(first.investor_share * 100) + '%');

    /* fade in all annotations together */
    annotations.transition().delay(annotDelay).duration(600).ease(d3.easeCubicOut)
      .attr('opacity', 1);

    /* legend */
    var lg = svg.append('g').attr('transform', 'translate(' + (m.left + 8) + ', 14)');
    lg.append('line').attr('x1', 0).attr('x2', 18).attr('y1', 0).attr('y2', 0)
      .attr('stroke', '#1B3A5C').attr('stroke-width', 3);
    lg.append('text').attr('x', 24).attr('y', 4).attr('fill', '#46433C')
      .style('font-size', '11px').style('font-family', font).text('All sales');
    lg.append('line').attr('x1', 95).attr('x2', 113).attr('y1', 0).attr('y2', 0)
      .attr('stroke', '#8AAEC8').attr('stroke-width', 2);
    lg.append('text').attr('x', 119).attr('y', 4).attr('fill', '#46433C')
      .style('font-size', '11px').style('font-family', font).text('Top price decile');
  }
</script>

<div bind:this={el}></div>
