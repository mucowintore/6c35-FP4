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
      console.error('PriceWedgeChart: failed to load data', e);
    }
  });

  function draw() {
    el.innerHTML = '';

    const holdData = rawData.filter(d => d.pattern === 'holding');
    const flipData = rawData.filter(d => d.pattern === 'flipping');

    const m = { top: 32, right: 58, bottom: 38, left: 52 };
    const w = width - m.left - m.right;
    const h = height - m.top - m.bottom;
    const yCap = 90;

    const svg = d3.select(el).append('svg')
      .attr('width', width).attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('max-width', '100%');

    svg.append('defs').append('clipPath').attr('id', 'pw-clip')
      .append('rect').attr('width', w).attr('height', h);

    const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

    const font = 'Plus Jakarta Sans, sans-serif';
    const mono = 'IBM Plex Mono, monospace';

    const x = d3.scaleLinear([2000, 2022], [0, w]);
    const y = d3.scaleLinear([-30, yCap], [h, 0]);

    // x-axis
    g.append('g').attr('transform', `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format('d')).tickSize(0))
      .call(g => g.select('.domain').attr('stroke', '#D6D2C8'))
      .call(g => g.selectAll('text').attr('fill', '#9C9890')
        .style('font-size', '11px').style('font-family', font));

    // y-axis with grid
    g.append('g')
      .call(d3.axisLeft(y).ticks(7)
        .tickFormat(d => (d > 0 ? '+' : '') + d + '%').tickSize(0))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line').clone()
        .attr('x2', w).attr('stroke', '#ECEAE2').attr('stroke-width', 0.5))
      .call(g => g.selectAll('text').attr('fill', '#9C9890')
        .style('font-size', '11px').style('font-family', font));

    // zero line
    g.append('line').attr('x1', 0).attr('x2', w)
      .attr('y1', y(0)).attr('y2', y(0))
      .attr('stroke', '#B0A898').attr('stroke-width', 1).attr('stroke-dasharray', '4 3');

    const clipped = g.append('g').attr('clip-path', 'url(#pw-clip)');

    // area fills
    const areaHold = d3.area().x(d => x(d.year)).y0(y(0))
      .y1(d => y(Math.min(d.premium, yCap))).curve(d3.curveMonotoneX);
    const areaFlip = d3.area().x(d => x(d.year)).y0(y(0))
      .y1(d => y(Math.max(d.premium, -30))).curve(d3.curveMonotoneX);

    clipped.append('path').datum(holdData)
      .attr('fill', '#1B3A5C').attr('fill-opacity', 0.06).attr('d', areaHold);
    clipped.append('path').datum(flipData)
      .attr('fill', '#C68B3C').attr('fill-opacity', 0.06).attr('d', areaFlip);

    // line generators (capped/clamped)
    const lineHold = d3.line().x(d => x(d.year))
      .y(d => y(Math.min(d.premium, yCap))).curve(d3.curveMonotoneX);
    const lineFlip = d3.line().x(d => x(d.year))
      .y(d => y(Math.max(d.premium, -30))).curve(d3.curveMonotoneX);

    // animated draw
    function animateLine(gen, lineData, color, sw, delay) {
      const p = clipped.append('path').datum(lineData).attr('fill', 'none')
        .attr('stroke', color).attr('stroke-width', sw)
        .attr('stroke-linecap', 'round').attr('d', gen);
      const len = p.node().getTotalLength();
      p.attr('stroke-dasharray', len).attr('stroke-dashoffset', len)
        .transition().delay(delay).duration(1500).ease(d3.easeCubicOut)
        .attr('stroke-dashoffset', 0)
        .on('end', function () { d3.select(this).attr('stroke-dasharray', null); });
    }

    animateLine(lineHold, holdData, '#1B3A5C', 2.5, 0);
    animateLine(lineFlip, flipData, '#C68B3C', 2.5, 200);

    // spike annotation (2019)
    const spike = holdData.find(d => d.year === 2019);
    if (spike && spike.premium > yCap) {
      g.append('text').attr('x', x(2019)).attr('y', -6).attr('text-anchor', 'middle')
        .attr('fill', '#1B3A5C').style('font-size', '10px').style('font-weight', '600')
        .style('font-family', mono).text('↑ +' + Math.round(spike.premium) + '%');
    }

    // endpoint labels
    const lastH = holdData[holdData.length - 1];
    const lastF = flipData[flipData.length - 1];

    g.append('text').attr('x', x(2022) + 6)
      .attr('y', y(Math.min(lastH.premium, yCap)) + 4)
      .attr('fill', '#1B3A5C').style('font-size', '11px').style('font-weight', '600')
      .style('font-family', mono).text('+' + Math.round(lastH.premium) + '%');

    g.append('text').attr('x', x(2022) + 6).attr('y', y(lastF.premium) + 4)
      .attr('fill', '#C68B3C').style('font-size', '11px').style('font-weight', '600')
      .style('font-family', mono).text('+' + Math.round(lastF.premium) + '%');

    // legend
    const lg = svg.append('g').attr('transform', `translate(${m.left + 8}, 14)`);
    lg.append('line').attr('x1', 0).attr('x2', 18).attr('y1', 0).attr('y2', 0)
      .attr('stroke', '#1B3A5C').attr('stroke-width', 2.5);
    lg.append('text').attr('x', 24).attr('y', 4).attr('fill', '#46433C')
      .style('font-size', '11px').style('font-family', font).text('Holding tracts');
    lg.append('line').attr('x1', 135).attr('x2', 153).attr('y1', 0).attr('y2', 0)
      .attr('stroke', '#C68B3C').attr('stroke-width', 2.5);
    lg.append('text').attr('x', 159).attr('y', 4).attr('fill', '#46433C')
      .style('font-size', '11px').style('font-family', font).text('Flipping tracts');
  }
</script>

<div bind:this={el}></div>
