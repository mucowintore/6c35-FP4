<script>
  /* Section 01. Investor share of Boston home purchases, 2000 to 2022.
   *
   * The line draws once when the layer is conceptually active and the
   * layer's DOM is visibly on screen. When the reader scrolls away it
   * resets, so re-entry plays the animation again rather than showing
   * a static line.
   *
   * Two visual moves carry the meaning beyond the line itself.
   * First, 2000 to 2007 renders muted (thinner, lower opacity), 2008
   * to 2022 at full weight. The break is shown before it is named.
   * Second, a vertical "2008 financial crisis" label sits along the
   * dashed marker, the way the Times sets pivot-year annotations.
   *
   * The end-of-line punchline arrives last. The eye lands there. */

  import * as d3 from 'd3';
  import { onMount } from 'svelte';

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

  let pathPre = null, pathPost = null;
  let pathTopPre = null, pathTopPost = null;
  let areaPre = null, areaPost = null;
  let lenPre = 0, lenPost = 0;
  let lenTopPre = 0, lenTopPost = 0;
  let annotations = null;
  let endCallout = null;
  let topLineLabel = null;
  let attribution = null;
  let marker2008 = null;
  let dotGroup = null;
  let hoverLayer = null;

  /* Palette tuned for the dark Section 01 background. */
  const COLOR_NAVY = '#A8C5DD';
  const COLOR_PRE = 'rgba(168, 197, 221, 0.55)';
  const COLOR_FILL = '#5A88AE';
  const COLOR_END = '#F2F0EA';
  const AXIS_TEXT = 'rgba(242, 240, 234, 0.55)';
  const AXIS_LINE = 'rgba(242, 240, 234, 0.18)';
  const GRID_LINE = 'rgba(242, 240, 234, 0.08)';
  const MARKER_LINE = 'rgba(242, 240, 234, 0.32)';
  const CAPTION_TEXT = 'rgba(242, 240, 234, 0.62)';
  const ATTR_TEXT = 'rgba(242, 240, 234, 0.32)';

  onMount(async () => {
    try {
      data = await d3.json('data/investor_share_yearly.json');
      if (el && data.length) buildChart();
    } catch (e) {
      console.error('TimeSeriesChart: could not load data', e);
    }
  });

  /* Animate only when the layer is the conceptual active section AND
   * the DOM is genuinely on screen. The viewport gate is what
   * prevents the cold-load case where the section is conceptually
   * active before the reader has scrolled past the opening. */
  $: if (active && inViewport && visible && built && !animating && !hasAnimated) {
    animating = true;
    hasAnimated = true;
    runDrawAnimation();
  }

  /* When the reader scrolls away, reset so the next entry plays
   * fresh rather than showing a static finished line. */
  $: if ((!active || !inViewport) && built && hasAnimated && !animating) {
    resetForReplay();
  }

  function resetForReplay() {
    if (!pathPre || !pathPost) return;
    pathPre.interrupt().attr('stroke-dashoffset', lenPre);
    pathPost.interrupt().attr('stroke-dashoffset', lenPost);
    if (pathTopPre) pathTopPre.interrupt().attr('stroke-dashoffset', lenTopPre);
    if (pathTopPost) pathTopPost.interrupt().attr('stroke-dashoffset', lenTopPost);
    if (areaPre) areaPre.interrupt().attr('opacity', 0);
    if (areaPost) areaPost.interrupt().attr('opacity', 0);
    if (annotations) annotations.interrupt().attr('opacity', 0);
    if (endCallout) endCallout.interrupt().attr('opacity', 0);
    if (topLineLabel) topLineLabel.interrupt().attr('opacity', 0);
    if (attribution) attribution.interrupt().attr('opacity', 0);
    if (marker2008) marker2008.interrupt().attr('stroke-opacity', 0.36);
    if (dotGroup) dotGroup.interrupt().attr('opacity', 0);
    hasAnimated = false;
  }

  function runDrawAnimation() {
    if (!pathPre || !pathPost) return;

    /* Pre-2008 muted segment, drawn first. */
    pathPre.transition('draw-pre')
      .duration(1400).ease(d3.easeCubicInOut)
      .attr('stroke-dashoffset', 0);
    if (areaPre) {
      areaPre.transition('fade-pre').duration(1400).ease(d3.easeCubicOut)
        .attr('opacity', 0.10);
    }
    if (pathTopPre) {
      pathTopPre.transition('draw-top-pre').delay(400)
        .duration(1000).ease(d3.easeCubicInOut)
        .attr('stroke-dashoffset', 0);
    }

    /* Post-2008 full weight segment, the body of the story. */
    pathPost.transition('draw-post').delay(1350)
      .duration(2100).ease(d3.easeCubicInOut)
      .attr('stroke-dashoffset', 0);
    if (areaPost) {
      areaPost.transition('fade-post').delay(1350)
        .duration(2100).ease(d3.easeCubicOut)
        .attr('opacity', 0.24);
    }
    if (pathTopPost) {
      pathTopPost.transition('draw-top-post').delay(1800)
        .duration(1700).ease(d3.easeCubicInOut)
        .attr('stroke-dashoffset', 0);
    }

    /* Pulse the 2008 marker as the line crosses it. */
    if (marker2008) {
      marker2008.transition('pulse-2008').delay(1400)
        .duration(360).ease(d3.easeCubicOut)
        .attr('stroke-opacity', 0.92)
        .transition().duration(420).ease(d3.easeCubicIn)
        .attr('stroke-opacity', 0.4);
    }

    /* Anchor dots fade in last as a quiet Tufte note: the line is
     * built from measurements. */
    if (dotGroup) {
      dotGroup.transition('dots').delay(3500)
        .duration(700).ease(d3.easeCubicOut)
        .attr('opacity', 1);
    }

    if (annotations) {
      annotations.transition('anno').delay(3700)
        .duration(700).ease(d3.easeCubicOut)
        .attr('opacity', 1);
    }
    if (topLineLabel) {
      topLineLabel.transition('top-label').delay(3700)
        .duration(700).ease(d3.easeCubicOut)
        .attr('opacity', 1);
    }
    if (attribution) {
      attribution.transition('attr').delay(4400)
        .duration(700).ease(d3.easeCubicOut)
        .attr('opacity', 1);
    }
    if (endCallout) {
      endCallout.transition('callout').delay(3900)
        .duration(900).ease(d3.easeCubicOut)
        .attr('opacity', 1)
        .on('end', function () { animating = false; startAmbientPulse(); });
    } else {
      animating = false;
    }
  }

  /* Once the line is settled, give it a barely perceptible breath. */
  function startAmbientPulse() {
    if (!pathPost) return;
    function loop() {
      if (!pathPost) return;
      pathPost.transition('breath')
        .duration(3000).ease(d3.easeSinInOut).attr('opacity', 0.94)
        .transition().duration(3000).ease(d3.easeSinInOut).attr('opacity', 1)
        .on('end', loop);
    }
    loop();
  }

  function buildChart() {
    el.innerHTML = '';

    var m = { top: 38, right: 110, bottom: 56, left: 56 };
    var w = width - m.left - m.right;
    var h = height - m.top - m.bottom;
    var font = 'Plus Jakarta Sans, sans-serif';
    var mono = 'IBM Plex Mono, monospace';
    var serif = '"DM Serif Display", Georgia, serif';

    var svg = d3.select(el).append('svg')
      .attr('width', '100%').attr('height', '100%')
      .attr('viewBox', '0 0 ' + width + ' ' + height)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('role', 'img')
      .attr('aria-labelledby', 'ts-title ts-desc')
      .style('overflow', 'visible');

    /* Title and desc carry the same meaning for screen readers that
     * prefer in-document description over aria-label. */
    svg.append('title').attr('id', 'ts-title')
      .text('Investor share of Boston home purchases, 2000 to 2022');
    svg.append('desc').attr('id', 'ts-desc')
      .text('A time series showing investor share rising from 16 percent in 2000 to a sharp jump after the 2008 financial crisis, never returning to pre-crisis levels and reaching 27 percent by 2022.');

    var defs = svg.append('defs');
    var grad = defs.append('linearGradient').attr('id', 'ts-area-grad')
      .attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 1);
    grad.append('stop').attr('offset', '0%')
      .attr('stop-color', COLOR_FILL).attr('stop-opacity', 1);
    grad.append('stop').attr('offset', '100%')
      .attr('stop-color', COLOR_FILL).attr('stop-opacity', 0);

    var g = svg.append('g').attr('transform', 'translate(' + m.left + ',' + m.top + ')');

    var x = d3.scaleLinear([2000, 2022], [0, w]);
    var yMax = Math.ceil(d3.max(data, function (d) { return d.top_decile_share; }) * 10) / 10;
    var y = d3.scaleLinear([0, yMax], [h, 0]);

    /* x axis */
    g.append('g').attr('transform', 'translate(0,' + h + ')')
      .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format('d')).tickSize(0))
      .call(function (a) { a.select('.domain').attr('stroke', AXIS_LINE); })
      .call(function (a) {
        a.selectAll('text').attr('fill', AXIS_TEXT)
          .attr('dy', '1em')
          .style('font-size', '11px').style('font-family', font);
      });

    /* y axis with subtle gridlines */
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
          .attr('dx', '-0.4em')
          .style('font-size', '11px').style('font-family', font);
      });

    /* 2008 marker. The vertical label sits along it. Slightly heavier
     * type and higher opacity so the eye finds it without searching. */
    marker2008 = g.append('line')
      .attr('x1', x(2008)).attr('x2', x(2008))
      .attr('y1', 0).attr('y2', h)
      .attr('stroke', MARKER_LINE).attr('stroke-dasharray', '4 3')
      .attr('stroke-opacity', 0.4);

    g.append('text')
      .attr('transform', 'translate(' + (x(2008) - 9) + ',' + (h * 0.18) + ') rotate(-90)')
      .attr('text-anchor', 'end')
      .attr('fill', 'rgba(242, 240, 234, 0.65)')
      .style('font-size', '10px')
      .style('font-family', font)
      .style('font-weight', '600')
      .style('letter-spacing', '0.14em')
      .style('text-transform', 'uppercase')
      .text('2008 financial crisis');

    /* Split at 2008 so the muted vs full visual treatment lands. The
     * boundary year sits in both halves to keep the line continuous. */
    var pre = data.filter(function (d) { return d.year <= 2008; });
    var post = data.filter(function (d) { return d.year >= 2008; });

    var lineGen = d3.line()
      .x(function (d) { return x(d.year); })
      .y(function (d) { return y(d.investor_share); })
      .curve(d3.curveMonotoneX);

    var lineTopGen = d3.line()
      .x(function (d) { return x(d.year); })
      .y(function (d) { return y(d.top_decile_share); })
      .curve(d3.curveMonotoneX);

    var areaGen = d3.area()
      .x(function (d) { return x(d.year); })
      .y0(h)
      .y1(function (d) { return y(d.investor_share); })
      .curve(d3.curveMonotoneX);

    /* Areas first so lines sit on top. */
    areaPre = g.append('path').datum(pre)
      .attr('fill', 'url(#ts-area-grad)')
      .attr('opacity', 0)
      .attr('d', areaGen);
    areaPost = g.append('path').datum(post)
      .attr('fill', 'url(#ts-area-grad)')
      .attr('opacity', 0)
      .attr('d', areaGen);

    /* Top decile is the secondary, lighter line. Pre and post halves. */
    pathTopPre = g.append('path').datum(pre)
      .attr('fill', 'none')
      .attr('stroke', COLOR_NAVY).attr('stroke-width', 1.4)
      .attr('stroke-opacity', 0.45)
      .attr('stroke-linecap', 'round')
      .attr('d', lineTopGen);
    lenTopPre = pathTopPre.node().getTotalLength();
    pathTopPre.attr('stroke-dasharray', lenTopPre)
      .attr('stroke-dashoffset', lenTopPre);

    pathTopPost = g.append('path').datum(post)
      .attr('fill', 'none')
      .attr('stroke', COLOR_NAVY).attr('stroke-width', 1.8)
      .attr('stroke-opacity', 0.78)
      .attr('stroke-linecap', 'round')
      .attr('d', lineTopGen);
    lenTopPost = pathTopPost.node().getTotalLength();
    pathTopPost.attr('stroke-dasharray', lenTopPost)
      .attr('stroke-dashoffset', lenTopPost);

    /* Primary line, pre-crisis muted half. */
    pathPre = g.append('path').datum(pre)
      .attr('fill', 'none')
      .attr('stroke', COLOR_PRE).attr('stroke-width', 1.8)
      .attr('stroke-linecap', 'round')
      .attr('d', lineGen);
    lenPre = pathPre.node().getTotalLength();
    pathPre.attr('stroke-dasharray', lenPre)
      .attr('stroke-dashoffset', lenPre);

    /* Primary line, post-crisis full weight. The body of the story. */
    pathPost = g.append('path').datum(post)
      .attr('fill', 'none')
      .attr('stroke', COLOR_NAVY).attr('stroke-width', 3.6)
      .attr('stroke-linecap', 'round')
      .attr('d', lineGen);
    lenPost = pathPost.node().getTotalLength();
    pathPost.attr('stroke-dasharray', lenPost)
      .attr('stroke-dashoffset', lenPost);

    /* Anchor dots at every recorded year. Low opacity, Tufte-style. */
    dotGroup = g.append('g').attr('opacity', 0);
    data.forEach(function (d) {
      dotGroup.append('circle')
        .attr('cx', x(d.year)).attr('cy', y(d.investor_share))
        .attr('r', 1.8).attr('fill', COLOR_NAVY).attr('opacity', 0.35);
    });

    /* End-of-line punchline. Large serif final value, year in mono
     * caps below, italic serif caption below that telling the reader
     * what the ending value means. */
    var last = data[data.length - 1];
    var endX = x(2022) + 14;
    var endY = y(last.investor_share);
    endCallout = g.append('g').attr('opacity', 0)
      .attr('transform', 'translate(' + endX + ',' + endY + ')');
    endCallout.append('text')
      .attr('x', 0).attr('y', 4)
      .attr('fill', COLOR_END)
      .style('font-family', serif)
      .style('font-size', '34px')
      .style('font-weight', '400')
      .text(Math.round(last.investor_share * 100) + '%');
    endCallout.append('text')
      .attr('x', 1).attr('y', 22)
      .attr('fill', AXIS_TEXT)
      .style('font-family', mono)
      .style('font-size', '10px')
      .style('letter-spacing', '0.12em')
      .text(String(last.year));
    endCallout.append('text')
      .attr('x', 1).attr('y', 42)
      .attr('fill', CAPTION_TEXT)
      .style('font-family', serif)
      .style('font-style', 'italic')
      .style('font-size', '12px')
      .text('Holding steady');
    endCallout.append('text')
      .attr('x', 1).attr('y', 58)
      .attr('fill', CAPTION_TEXT)
      .style('font-family', serif)
      .style('font-style', 'italic')
      .style('font-size', '12px')
      .text('through 2022.');

    /* Inline label tucked at the end of the secondary line. The label
     * is the legend; no upper-left swatch row needed. */
    var endTopY = y(last.top_decile_share);
    topLineLabel = g.append('g').attr('opacity', 0)
      .attr('transform', 'translate(' + (x(2022) + 14) + ',' + endTopY + ')');
    topLineLabel.append('text')
      .attr('x', 0).attr('y', 4)
      .attr('fill', COLOR_NAVY)
      .attr('opacity', 0.85)
      .style('font-family', mono)
      .style('font-size', '11px')
      .style('font-weight', '700')
      .text('+' + Math.round(last.top_decile_share * 100) + '%');
    topLineLabel.append('text')
      .attr('x', 1).attr('y', 18)
      .attr('fill', COLOR_NAVY)
      .attr('opacity', 0.55)
      .style('font-family', mono)
      .style('font-size', '8.5px')
      .style('letter-spacing', '0.12em')
      .text('TOP 10% BY PRICE');

    /* Starting-year value as a quiet anchor on the left edge. */
    annotations = g.append('g').attr('opacity', 0);
    var first = data[0];
    annotations.append('text').attr('x', x(2000) - 8)
      .attr('y', y(first.investor_share) - 10)
      .attr('text-anchor', 'end').attr('fill', AXIS_TEXT)
      .style('font-size', '10px').style('font-family', mono)
      .text(Math.round(first.investor_share * 100) + '%');

    /* Data attribution at the chart's bottom-right corner. The kind
     * of small line a Times chart sits below the x-axis, anchoring
     * the figure in the source. */
    attribution = svg.append('g').attr('opacity', 0)
      .attr('transform', 'translate(' + (width - 8) + ',' + (height - 8) + ')');
    attribution.append('text')
      .attr('x', 0).attr('y', 0)
      .attr('text-anchor', 'end')
      .attr('fill', ATTR_TEXT)
      .style('font-family', mono)
      .style('font-size', '9px')
      .style('letter-spacing', '0.08em')
      .text('MAPC residential sales  ·  2000 to 2022');

    /* Hover layer last so it sits above everything else. */
    hoverLayer = svg.append('g').attr('opacity', 0).style('pointer-events', 'none');
    var hoverLine = hoverLayer.append('line')
      .attr('y1', m.top).attr('y2', m.top + h)
      .attr('stroke', '#F2F0EA').attr('stroke-width', 1)
      .attr('stroke-opacity', 0.35).attr('stroke-dasharray', '2 3');
    var hoverCard = hoverLayer.append('g');
    hoverCard.append('rect')
      .attr('width', 138).attr('height', 60)
      .attr('rx', 8)
      .attr('fill', 'rgba(20, 20, 18, 0.82)')
      .attr('stroke', 'rgba(242, 240, 234, 0.18)')
      .attr('stroke-width', 0.5);
    var cardYear = hoverCard.append('text')
      .attr('x', 12).attr('y', 18)
      .attr('fill', '#F2F0EA')
      .style('font-family', mono).style('font-size', '11px')
      .style('font-weight', '700').style('letter-spacing', '0.06em');
    var cardAll = hoverCard.append('text')
      .attr('x', 12).attr('y', 36)
      .attr('fill', COLOR_NAVY)
      .style('font-family', font).style('font-size', '11px');
    var cardTop = hoverCard.append('text')
      .attr('x', 12).attr('y', 52)
      .attr('fill', 'rgba(138, 174, 200, 0.78)')
      .style('font-family', font).style('font-size', '10.5px');
    var hoverDotAll = hoverLayer.append('circle')
      .attr('r', 4).attr('fill', '#0F0F0E')
      .attr('stroke', COLOR_NAVY).attr('stroke-width', 2);
    var hoverDotTop = hoverLayer.append('circle')
      .attr('r', 3).attr('fill', '#0F0F0E')
      .attr('stroke', COLOR_NAVY).attr('stroke-width', 1.5)
      .attr('opacity', 0.78);

    /* Invisible capture rect for mouse events. */
    svg.append('rect')
      .attr('x', m.left).attr('y', m.top)
      .attr('width', w).attr('height', h)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair')
      .on('mousemove', function (event) {
        var mx = d3.pointer(event, svg.node())[0];
        var year = Math.round(x.invert(mx - m.left));
        if (year < 2000) year = 2000;
        if (year > 2022) year = 2022;
        var d = data.find(function (r) { return r.year === year; });
        if (!d) return;

        var px = x(year) + m.left;
        var pyAll = y(d.investor_share) + m.top;
        var pyTop = y(d.top_decile_share) + m.top;

        hoverLayer.attr('opacity', 1);
        hoverLine.attr('x1', px).attr('x2', px);
        hoverDotAll.attr('cx', px).attr('cy', pyAll);
        hoverDotTop.attr('cx', px).attr('cy', pyTop);

        var cardX = px + 14;
        if (cardX + 138 > width - 4) cardX = px - 152;
        var cardY = m.top + 6;
        hoverCard.attr('transform', 'translate(' + cardX + ',' + cardY + ')');
        cardYear.text(year);
        cardAll.text('All sales: ' + Math.round(d.investor_share * 100) + '%');
        cardTop.text('Top decile: ' + Math.round(d.top_decile_share * 100) + '%');
      })
      .on('mouseleave', function () {
        hoverLayer.attr('opacity', 0);
      });

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
