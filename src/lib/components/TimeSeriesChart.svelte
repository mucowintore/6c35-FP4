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
      console.error('TimeSeriesChart: failed to load data', e);
    }
  });

  function draw() {
    el.innerHTML = '';

    const m = { top: 32, right: 58, bottom: 38, left: 50 };
    const w = width - m.left - m.right;
    const h = height - m.top - m.bottom;

    const svg = d3.select(el).append('svg')
      .attr('width', width).attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('max-width', '100%');

    const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

    const x = d3.scaleLinear([2000, 2022], [0, w]);
    const yMax = Math.ceil(d3.max(data, d => d.top_decile_share) * 10) / 10;
    const y = d3.scaleLinear([0, yMax], [h, 0]);

    const font = 'Plus Jakarta Sans, sans-serif';
    const mono = 'IBM Plex Mono, monospace';

    // x-axis
    g.append('g').attr('transform', `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format('d')).tickSize(0))
      .call(g => g.select('.domain').attr('stroke', '#D6D2C8'))
      .call(g => g.selectAll('text').attr('fill', '#9C9890')
        .style('font-size', '11px').style('font-family', font));

    // y-axis with grid
    g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => Math.round(d * 100) + '%').tickSize(0))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line').clone()
        .attr('x2', w).attr('stroke', '#ECEAE2').attr('stroke-width', 0.5))
      .call(g => g.selectAll('text').attr('fill', '#9C9890')
        .style('font-size', '11px').style('font-family', font));

    // 2008 marker
    g.append('line')
      .attr('x1', x(2008)).attr('x2', x(2008)).attr('y1', 0).attr('y2', h)
      .attr('stroke', '#B0A898').attr('stroke-dasharray', '4 3');
    g.append('text').attr('x', x(2008)).attr('y', -8).attr('text-anchor', 'middle')
      .attr('fill', '#9C9890').style('font-size', '10px').style('font-family', font).text('2008');

    // line generators
    const lineAll = d3.line().x(d => x(d.year)).y(d => y(d.investor_share)).curve(d3.curveMonotoneX);
    const lineTop = d3.line().x(d => x(d.year)).y(d => y(d.top_decile_share)).curve(d3.curveMonotoneX);

    // animated line draw
    function animateLine(gen, color, sw, delay) {
      const p = g.append('path').datum(data).attr('fill', 'none')
        .attr('stroke', color).attr('stroke-width', sw)
        .attr('stroke-linecap', 'round').attr('d', gen);
      const len = p.node().getTotalLength();
      p.attr('stroke-dasharray', len).attr('stroke-dashoffset', len)
        .transition().delay(delay).duration(1500).ease(d3.easeCubicOut)
        .attr('stroke-dashoffset', 0)
        .on('end', function () { d3.select(this).attr('stroke-dasharray', null); });
    }

    animateLine(lineTop, '#8AAEC8', 1.8, 200);
    animateLine(lineAll, '#1B3A5C', 2.5, 0);

    // endpoint labels
    const last = data[data.length - 1];
    const first = data[0];

    g.append('text').attr('x', x(2022) + 6).attr('y', y(last.investor_share) + 4)
      .attr('fill', '#1B3A5C').style('font-size', '11px').style('font-weight', '600')
      .style('font-family', mono).text(Math.round(last.investor_share * 100) + '%');

    g.append('text').attr('x', x(2022) + 6).attr('y', y(last.top_decile_share) + 4)
      .attr('fill', '#8AAEC8').style('font-size', '11px').style('font-weight', '600')
      .style('font-family', mono).text(Math.round(last.top_decile_share * 100) + '%');

    g.append('text').attr('x', x(2000) - 4).attr('y', y(first.investor_share) + 4)
      .attr('text-anchor', 'end').attr('fill', '#1B3A5C')
      .style('font-size', '10px').style('font-family', mono)
      .text(Math.round(first.investor_share * 100) + '%');

    // legend
    const lg = svg.append('g').attr('transform', `translate(${m.left + 8}, 14)`);
    lg.append('line').attr('x1', 0).attr('x2', 18).attr('y1', 0).attr('y2', 0)
      .attr('stroke', '#1B3A5C').attr('stroke-width', 2.5);
    lg.append('text').attr('x', 24).attr('y', 4).attr('fill', '#46433C')
      .style('font-size', '11px').style('font-family', font).text('All sales');
    lg.append('line').attr('x1', 95).attr('x2', 113).attr('y1', 0).attr('y2', 0)
      .attr('stroke', '#8AAEC8').attr('stroke-width', 1.8);
    lg.append('text').attr('x', 119).attr('y', 4).attr('fill', '#46433C')
      .style('font-size', '11px').style('font-family', font).text('Top price decile');
  }
</script>

<div bind:this={el}></div>
