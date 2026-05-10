<script>
  import * as d3 from 'd3';
  import { onDestroy, onMount } from 'svelte';

  export let width = 720;
  export let height = 420;
  export let active = false;
  export let inViewport = false;
  export let visible = false;

  let el;
  let data = [];
  let built = false;
  let animating = false;
  let hasAnimated = false;
  let animationEndTimer = null;

  let lineLayers = [];
  let markerLines = [];
  let dotGroups = [];
  let endLabels = [];

  const AXIS_TEXT = 'rgba(70, 67, 60, 0.85)';
  const AXIS_LINE = 'rgba(156, 152, 144, 0.45)';
  const GRID_LINE = 'rgba(156, 152, 144, 0.22)';
  const MARKER_LINE = 'rgba(106, 102, 94, 0.45)';
  const SERIES_ALL = '#2F4E6B';
  const SERIES_ALL_PRE = 'rgba(47, 78, 107, 0.55)';
  const SERIES_TOP = '#596575';
  const SERIES_TOP_PRE = 'rgba(89, 101, 117, 0.56)';
  const CARD_BG = 'rgba(255, 255, 255, 0.96)';

  const panelDefs = [
    { key: 'investor_share', label: 'All sales', color: SERIES_ALL, colorPre: SERIES_ALL_PRE },
    { key: 'top_decile_share', label: 'Top price decile', color: SERIES_TOP, colorPre: SERIES_TOP_PRE }
  ];

  onMount(async () => {
    try {
      data = await d3.json('data/investor_share_yearly.json');
      if (el && data.length) buildChart();
    } catch (e) {
      console.error('TimeSeriesChart: could not load data', e);
    }
  });

  onDestroy(() => {
    if (animationEndTimer) {
      clearTimeout(animationEndTimer);
      animationEndTimer = null;
    }
  });

  $: if (active && inViewport && visible && built && !animating && !hasAnimated) {
    animating = true;
    hasAnimated = true;
    runDrawAnimation();
  }

  $: if ((!active || !inViewport) && built && hasAnimated && !animating) {
    resetForReplay();
  }

  function resetForReplay() {
    lineLayers.forEach(function (layer) {
      layer.pathPre.interrupt().attr('stroke-dashoffset', layer.preLen);
      layer.pathPost.interrupt().attr('stroke-dashoffset', layer.postLen);
    });
    markerLines.forEach(function (line) {
      line.interrupt().attr('stroke-opacity', 0.4);
    });
    dotGroups.forEach(function (dots) {
      dots.interrupt().attr('opacity', 0);
    });
    endLabels.forEach(function (label) {
      label.interrupt().attr('opacity', 0);
    });
    if (animationEndTimer) {
      clearTimeout(animationEndTimer);
      animationEndTimer = null;
    }
    hasAnimated = false;
  }

  function runDrawAnimation() {
    lineLayers.forEach(function (layer, i) {
      var baseDelay = i * 220;
      layer.pathPre.transition('draw-pre-' + i)
        .delay(baseDelay)
        .duration(900)
        .ease(d3.easeCubicInOut)
        .attr('stroke-dashoffset', 0);
      layer.pathPost.transition('draw-post-' + i)
        .delay(baseDelay + 820)
        .duration(1400)
        .ease(d3.easeCubicInOut)
        .attr('stroke-dashoffset', 0);
    });

    markerLines.forEach(function (line, i) {
      line.transition('pulse-2008-' + i)
        .delay(1020 + i * 220)
        .duration(280)
        .ease(d3.easeCubicOut)
        .attr('stroke-opacity', 0.9)
        .transition()
        .duration(380)
        .ease(d3.easeCubicIn)
        .attr('stroke-opacity', 0.4);
    });

    dotGroups.forEach(function (dots, i) {
      dots.transition('dots-' + i)
        .delay(2360 + i * 160)
        .duration(520)
        .ease(d3.easeCubicOut)
        .attr('opacity', 1);
    });

    endLabels.forEach(function (label, i) {
      label.transition('labels-' + i)
        .delay(2520 + i * 160)
        .duration(620)
        .ease(d3.easeCubicOut)
        .attr('opacity', 1);
    });

    if (animationEndTimer) clearTimeout(animationEndTimer);
    animationEndTimer = setTimeout(function () {
      animating = false;
      animationEndTimer = null;
    }, 3400);
  }

  function buildChart() {
    el.innerHTML = '';
    lineLayers = [];
    markerLines = [];
    dotGroups = [];
    endLabels = [];

    var m = { top: 94, right: 84, bottom: 46, left: 58 };
    var panelGap = 38;
    var panelTitleGap = 14;
    var w = width - m.left - m.right;
    var panelHeight = (height - m.top - m.bottom - panelGap) / 2;
    var totalPlotHeight = panelHeight * 2 + panelGap;
    var font = 'Plus Jakarta Sans, sans-serif';
    var mono = 'Plus Jakarta Sans, sans-serif';
    var serif = '"DM Serif Display", Georgia, serif';

    var svg = d3.select(el).append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', '0 0 ' + width + ' ' + height)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('role', 'img')
      .attr('aria-labelledby', 'ts-title ts-desc')
      .style('overflow', 'visible');

    svg.append('title').attr('id', 'ts-title')
      .text('Investor share of Boston purchases over time');
    svg.append('desc').attr('id', 'ts-desc')
      .text('Two stacked line charts from 2000 to 2022. The top chart shows investor share of all sales. The bottom chart shows investor share in the top price decile. Both rise after 2008 and stay elevated.');

    svg.append('text')
      .attr('x', m.left)
      .attr('y', 30)
      .attr('fill', '#191816')
      .style('font-family', serif)
      .style('font-size', '20px')
      .style('font-weight', '400')
      .text('Investor activity rose after 2008 and stayed elevated');
    svg.append('text')
      .attr('x', m.left)
      .attr('y', 48)
      .attr('fill', AXIS_TEXT)
      .style('font-family', font)
      .style('font-size', '10.5px')
      .style('font-weight', '600')
      .style('letter-spacing', '0.08em')
      .style('text-transform', 'uppercase')
      .text('Share of Boston residential purchases by investors, 2000 to 2022');

    var root = svg.append('g').attr('transform', 'translate(' + m.left + ',' + m.top + ')');
    var x = d3.scaleLinear([2000, 2022], [0, w]);
    var pre = data.filter(function (d) { return d.year <= 2008; });
    var post = data.filter(function (d) { return d.year >= 2008; });
    var sharedYMax = Math.ceil(d3.max(data, function (d) {
      return Math.max(d.investor_share, d.top_decile_share);
    }) * 10) / 10;

    panelDefs.forEach(function (panel, i) {
      var y = d3.scaleLinear([0, sharedYMax], [panelHeight, 0]);
      var yOffset = i * (panelHeight + panelGap);
      var g = root.append('g').attr('transform', 'translate(0,' + yOffset + ')');

      g.append('text')
        .attr('x', 0)
        .attr('y', -panelTitleGap)
        .attr('fill', AXIS_TEXT)
        .style('font-family', font)
        .style('font-size', '11px')
        .style('font-weight', '700')
        .style('letter-spacing', '0.05em')
        .style('text-transform', 'uppercase')
        .text(panel.label);

      var yTicks = d3.range(0.2, sharedYMax + 0.001, 0.2).map(function (v) {
        return Math.round(v * 10) / 10;
      });
      g.append('g')
        .call(d3.axisLeft(y).tickValues(yTicks).tickFormat(function (d) {
          return Math.round(d * 100) + '%';
        }).tickSize(0))
        .call(function (a) { a.select('.domain').remove(); })
        .call(function (a) {
          a.selectAll('.tick line').clone()
            .attr('x2', w)
            .attr('stroke', GRID_LINE);
        })
        .call(function (a) {
          a.selectAll('text')
            .attr('fill', AXIS_TEXT)
            .style('font-size', '10.5px')
            .style('font-family', font);
        });

      var xAxis = d3.axisBottom(x).ticks(6).tickFormat(d3.format('d')).tickSize(0);
      if (i === 1) xAxis.tickValues([2002, 2006, 2010, 2014, 2018, 2022]);
      if (i === 0) xAxis.tickFormat(function () { return ''; });
      g.append('g')
        .attr('transform', 'translate(0,' + panelHeight + ')')
        .call(xAxis)
        .call(function (a) { a.select('.domain').attr('stroke', AXIS_LINE); })
        .call(function (a) {
          a.selectAll('text')
            .attr('fill', AXIS_TEXT)
            .attr('dy', '1em')
            .style('font-size', '10.5px')
            .style('font-family', font);
        });

      var marker2008 = g.append('line')
        .attr('x1', x(2008)).attr('x2', x(2008))
        .attr('y1', 0).attr('y2', panelHeight)
        .attr('stroke', MARKER_LINE)
        .attr('stroke-dasharray', '4 3')
        .attr('stroke-opacity', 0.4);
      markerLines.push(marker2008);

      if (i === 0) {
        g.append('text')
          .attr('transform', 'translate(' + (x(2008) - 9) + ',' + (panelHeight * 0.44) + ') rotate(-90)')
          .attr('text-anchor', 'end')
          .attr('fill', 'rgba(106, 102, 94, 0.82)')
          .style('font-size', '9.5px')
          .style('font-family', font)
          .style('font-weight', '600')
          .style('letter-spacing', '0.12em')
          .style('text-transform', 'uppercase')
          .text('2008 financial crisis');
      }

      var lineGen = d3.line()
        .x(function (d) { return x(d.year); })
        .y(function (d) { return y(d[panel.key]); })
        .curve(d3.curveMonotoneX);

      var pathPre = g.append('path').datum(pre)
        .attr('fill', 'none')
        .attr('stroke', panel.colorPre)
        .attr('stroke-width', 2.2)
        .attr('stroke-linecap', 'round')
        .attr('d', lineGen);
      var preLen = pathPre.node().getTotalLength();
      pathPre.attr('stroke-dasharray', preLen).attr('stroke-dashoffset', preLen);

      var pathPost = g.append('path').datum(post)
        .attr('fill', 'none')
        .attr('stroke', panel.color)
        .attr('stroke-width', 3.1)
        .attr('stroke-linecap', 'round')
        .attr('d', lineGen);
      var postLen = pathPost.node().getTotalLength();
      pathPost.attr('stroke-dasharray', postLen).attr('stroke-dashoffset', postLen);

      lineLayers.push({ pathPre: pathPre, pathPost: pathPost, preLen: preLen, postLen: postLen });

      var dotGroup = g.append('g').attr('opacity', 0);
      data.forEach(function (d) {
        dotGroup.append('circle')
          .attr('cx', x(d.year))
          .attr('cy', y(d[panel.key]))
          .attr('r', 1.9)
          .attr('fill', panel.color)
          .attr('opacity', 0.42);
      });
      dotGroups.push(dotGroup);

      var last = data[data.length - 1];
      var endLabel = g.append('g')
        .attr('opacity', 0)
        .attr('transform', 'translate(' + (x(last.year) + 10) + ',' + y(last[panel.key]) + ')');
      endLabel.append('text')
        .attr('x', 0)
        .attr('y', 4)
        .attr('fill', panel.color)
        .style('font-family', serif)
        .style('font-size', '22px')
        .style('font-weight', '400')
        .text(Math.round(last[panel.key] * 100) + '%');
      endLabel.append('text')
        .attr('x', 1)
        .attr('y', 17)
        .attr('fill', AXIS_TEXT)
        .style('font-family', mono)
        .style('font-size', '8.5px')
        .style('letter-spacing', '0.1em')
        .text(String(last.year));
      endLabels.push(endLabel);

      panel.y = y;
      panel.yOffset = yOffset;
    });

    var hoverLayer = svg.append('g').attr('opacity', 0).style('pointer-events', 'none');
    var hoverGuide = hoverLayer.append('line')
      .attr('y1', m.top)
      .attr('y2', m.top + totalPlotHeight)
      .attr('stroke', '#6A665E')
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 0.35)
      .attr('stroke-dasharray', '2 3');

    var hoverDots = {};
    panelDefs.forEach(function (panel) {
      hoverDots[panel.key] = hoverLayer.append('circle')
        .attr('r', 4)
        .attr('fill', '#fff')
        .attr('stroke', panel.color)
        .attr('stroke-width', 2);
    });

    var hoverCard = hoverLayer.append('g');
    hoverCard.append('rect')
      .attr('width', 162)
      .attr('height', 66)
      .attr('rx', 8)
      .attr('fill', CARD_BG)
      .attr('stroke', 'rgba(156, 152, 144, 0.4)')
      .attr('stroke-width', 0.6);
    var cardYear = hoverCard.append('text')
      .attr('x', 12).attr('y', 18)
      .attr('fill', '#191816')
      .style('font-family', mono).style('font-size', '11px')
      .style('font-weight', '700').style('letter-spacing', '0.06em');
    var cardAll = hoverCard.append('text')
      .attr('x', 12).attr('y', 37)
      .attr('fill', SERIES_ALL)
      .style('font-family', font).style('font-size', '11px');
    var cardTop = hoverCard.append('text')
      .attr('x', 12).attr('y', 53)
      .attr('fill', SERIES_TOP)
      .style('font-family', font).style('font-size', '11px');

    svg.append('rect')
      .attr('x', m.left)
      .attr('y', m.top)
      .attr('width', w)
      .attr('height', totalPlotHeight)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair')
      .on('mousemove', function (event) {
        var mx = d3.pointer(event, svg.node())[0];
        var year = Math.round(x.invert(mx - m.left));
        if (year < 2000) year = 2000;
        if (year > 2022) year = 2022;
        var row = data.find(function (d) { return d.year === year; });
        if (!row) return;

        var px = x(year) + m.left;
        hoverLayer.attr('opacity', 1);
        hoverGuide.attr('x1', px).attr('x2', px);

        panelDefs.forEach(function (panel) {
          var py = panel.y(row[panel.key]) + panel.yOffset + m.top;
          hoverDots[panel.key].attr('cx', px).attr('cy', py);
        });

        var cardX = px + 12;
        if (cardX + 162 > width - 4) cardX = px - 174;
        var cardY = m.top + 6;
        hoverCard.attr('transform', 'translate(' + cardX + ',' + cardY + ')');
        cardYear.text(year);
        cardAll.text('All sales: ' + Math.round(row.investor_share * 100) + '%');
        cardTop.text('Top decile: ' + Math.round(row.top_decile_share * 100) + '%');
      })
      .on('mouseleave', function () {
        hoverLayer.attr('opacity', 0);
      });

    var attribution = svg.append('g')
      .attr('transform', 'translate(' + (m.left + w) + ',' + (height - 8) + ')');
    attribution.append('text')
      .attr('text-anchor', 'end')
      .attr('fill', 'rgba(106, 102, 94, 0.75)')
      .style('font-family', mono)
      .style('font-size', '9px')
      .style('letter-spacing', '0.08em')
      .text('MAPC residential sales  ·  2000 to 2022');

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
