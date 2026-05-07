<script>
  /* Section 03. The price wedge.
   *
   * Two lines diverge from a common floor at zero. Holding climbs
   * into positive territory and stays there. Flipping plunges in
   * 2008 to 2009 to roughly minus 25 percent, recovers slowly, and
   * ends modestly above zero. The space between them is the visual
   * signature of two opposite investor strategies in two opposite
   * parts of the city.
   *
   * Both lines play a one-shot timed draw when the layer is the
   * conceptual active section AND its DOM is on screen. A clip rect
   * underneath unzips the gap fill from left to right in lockstep.
   * End callouts and the 2008 trough callout fade in afterward.
   *
   * Pre-2008 portions render muted, post-2008 full strength, the
   * same convention as Section 01. */

  import * as d3 from 'd3';
  import { onMount } from 'svelte';

  export let width = 720;
  export let height = 420;
  export let active = false;
  export let inViewport = false;
  export let visible = false;

  let el;
  let rawData = [];
  let combined = [];
  let built = false;
  let animating = false;
  let hasAnimated = false;

  let pathHoldPre = null, pathHoldPost = null;
  let pathFlipPre = null, pathFlipPost = null;
  let lenHoldPre = 0, lenHoldPost = 0;
  let lenFlipPre = 0, lenFlipPost = 0;

  let gapClipRect = null;
  let chartW = 0;
  let marker2008 = null;
  let troughCallout = null;
  let endHoldCallout = null;
  let endFlipCallout = null;
  let gapAnnotation = null;
  let dotGroupHold = null;
  let dotGroupFlip = null;
  let hoverLayer = null;

  /* Palette tuned for light backgrounds. */
  const COLOR_NAVY = '#3E6B94';
  const COLOR_AMBER = '#C68B3C';
  const COLOR_NAVY_PRE = 'rgba(62, 107, 148, 0.58)';
  const COLOR_AMBER_PRE = 'rgba(198, 139, 60, 0.58)';
  const COLOR_END = '#191816';
  const AXIS_TEXT = 'rgba(70, 67, 60, 0.85)';
  const AXIS_LINE = 'rgba(156, 152, 144, 0.45)';
  const GRID_LINE = 'rgba(156, 152, 144, 0.22)';
  const ZERO_LINE = 'rgba(106, 102, 94, 0.4)';
  const MARKER_LINE = 'rgba(106, 102, 94, 0.45)';
  const LEGEND_TEXT = 'rgba(70, 67, 60, 0.86)';
  const ANNO_LINE = 'rgba(106, 102, 94, 0.46)';
  const ANNO_TEXT = 'rgba(70, 67, 60, 0.84)';

  onMount(async () => {
    try {
      rawData = await d3.json('data/price_wedge_yearly.json');
      if (el && rawData.length) buildChart();
    } catch (e) {
      console.error('PriceWedgeChart: could not load data', e);
    }
  });

  /* Animate only when the layer is conceptually active AND its DOM
   * is visibly on screen. The viewport gate prevents off-screen
   * draws on cold load. */
  $: if (active && inViewport && visible && built && !animating && !hasAnimated) {
    animating = true;
    hasAnimated = true;
    runDrawAnimation();
  }

  $: if ((!active || !inViewport) && built && hasAnimated && !animating) {
    resetForReplay();
  }

  function resetForReplay() {
    if (!pathHoldPost || !pathFlipPost) return;
    pathHoldPre.interrupt().attr('stroke-dashoffset', lenHoldPre);
    pathHoldPost.interrupt().attr('stroke-dashoffset', lenHoldPost);
    pathFlipPre.interrupt().attr('stroke-dashoffset', lenFlipPre);
    pathFlipPost.interrupt().attr('stroke-dashoffset', lenFlipPost);
    if (gapClipRect) gapClipRect.interrupt().attr('width', 0);
    if (troughCallout) troughCallout.interrupt().attr('opacity', 0);
    if (endHoldCallout) endHoldCallout.interrupt().attr('opacity', 0);
    if (endFlipCallout) endFlipCallout.interrupt().attr('opacity', 0);
    if (gapAnnotation) gapAnnotation.interrupt().attr('opacity', 0);
    if (marker2008) marker2008.interrupt().attr('stroke-opacity', 0.4);
    if (dotGroupHold) dotGroupHold.interrupt().attr('opacity', 0);
    if (dotGroupFlip) dotGroupFlip.interrupt().attr('opacity', 0);
    hasAnimated = false;
  }

  function runDrawAnimation() {
    if (!pathHoldPost || !pathFlipPost) return;

    var DRAW_TOTAL = 3500;

    /* Pre-2008 muted halves draw over the first 1400 ms. */
    pathHoldPre.transition('hold-pre')
      .duration(1400).ease(d3.easeCubicInOut)
      .attr('stroke-dashoffset', 0);
    pathFlipPre.transition('flip-pre')
      .duration(1400).ease(d3.easeCubicInOut)
      .attr('stroke-dashoffset', 0);

    /* Post-2008 full weight halves draw over the remaining 2100 ms. */
    pathHoldPost.transition('hold-post').delay(1400)
      .duration(2100).ease(d3.easeCubicInOut)
      .attr('stroke-dashoffset', 0);
    pathFlipPost.transition('flip-post').delay(1400)
      .duration(2100).ease(d3.easeCubicInOut)
      .attr('stroke-dashoffset', 0);

    /* Gap fill clip rect grows with the lines so the wedge unzips. */
    if (gapClipRect) {
      gapClipRect.transition('gap')
        .duration(DRAW_TOTAL).ease(d3.easeCubicInOut)
        .attr('width', chartW);
    }

    /* The 2008 marker pulses as the line crosses it. */
    if (marker2008) {
      marker2008.transition('pulse-2008').delay(1400)
        .duration(360).ease(d3.easeCubicOut)
        .attr('stroke-opacity', 0.92)
        .transition().duration(420).ease(d3.easeCubicIn)
        .attr('stroke-opacity', 0.4);
    }

    /* Anchor dots fade in after lines complete. */
    if (dotGroupHold) {
      dotGroupHold.transition('dots-h').delay(DRAW_TOTAL)
        .duration(700).ease(d3.easeCubicOut).attr('opacity', 1);
    }
    if (dotGroupFlip) {
      dotGroupFlip.transition('dots-f').delay(DRAW_TOTAL)
        .duration(700).ease(d3.easeCubicOut).attr('opacity', 1);
    }

    /* The trough callout sits at the bottom of the flipping line.
     * That negative number is the visual lede; let it bloom in
     * mid-draw rather than waiting until the end. */
    if (troughCallout) {
      troughCallout.transition('trough').delay(2100)
        .duration(700).ease(d3.easeCubicOut)
        .attr('opacity', 1);
    }

    /* The "the gap" annotation arrives once the wedge has unzipped. */
    if (gapAnnotation) {
      gapAnnotation.transition('gap-anno').delay(DRAW_TOTAL + 100)
        .duration(900).ease(d3.easeCubicOut)
        .attr('opacity', 1);
    }

    /* End callouts last. The reader's eye lands on the right edge. */
    if (endHoldCallout) {
      endHoldCallout.transition('end-h').delay(DRAW_TOTAL + 200)
        .duration(900).ease(d3.easeCubicOut)
        .attr('opacity', 1);
    }
    if (endFlipCallout) {
      endFlipCallout.transition('end-f').delay(DRAW_TOTAL + 350)
        .duration(900).ease(d3.easeCubicOut)
        .attr('opacity', 1)
        .on('end', function () { animating = false; startAmbientPulse(); });
    } else {
      animating = false;
    }
  }

  function startAmbientPulse() {
    if (!pathHoldPost || !pathFlipPost) return;
    function loop() {
      if (!pathHoldPost) return;
      pathHoldPost.transition('breath-h')
        .duration(3000).ease(d3.easeSinInOut).attr('opacity', 0.94)
        .transition().duration(3000).ease(d3.easeSinInOut).attr('opacity', 1)
        .on('end', loop);
      pathFlipPost.transition('breath-f')
        .duration(3000).ease(d3.easeSinInOut).attr('opacity', 0.94)
        .transition().duration(3000).ease(d3.easeSinInOut).attr('opacity', 1);
    }
    loop();
  }

  function buildChart() {
    el.innerHTML = '';

    var holdData = rawData.filter(function (d) { return d.pattern === 'holding'; });
    var flipData = rawData.filter(function (d) { return d.pattern === 'flipping'; });

    /* Pivot rows by year so the gap area can interpolate between
     * the two lines year by year. Only years where both values
     * exist are kept. */
    var byYear = {};
    rawData.forEach(function (d) {
      if (!byYear[d.year]) byYear[d.year] = { year: d.year };
      byYear[d.year][d.pattern] = d.premium;
    });
    combined = Object.values(byYear)
      .filter(function (d) { return d.holding != null && d.flipping != null; })
      .sort(function (a, b) { return a.year - b.year; });

    var m = { top: 34, right: 58, bottom: 52, left: 48 };
    var w = width - m.left - m.right;
    var h = height - m.top - m.bottom;
    chartW = w;
    var yCap = 90;
    var yFloor = -32;
    var font = 'Plus Jakarta Sans, sans-serif';
    var mono = 'Plus Jakarta Sans, sans-serif';
    var serif = '"DM Serif Display", Georgia, serif';

    var svg = d3.select(el).append('svg')
      .attr('width', '100%').attr('height', '100%')
      .attr('viewBox', '0 0 ' + width + ' ' + height)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('role', 'img')
      .attr('aria-labelledby', 'pw-title pw-desc')
      .style('overflow', 'visible');

    svg.append('title').attr('id', 'pw-title')
      .text('Investor price premiums by strategy, 2000 to 2022');
    svg.append('desc').attr('id', 'pw-desc')
      .text('Two lines on a chart. Holding tracts climbed steadily to roughly 80 percent above market. Flipping tracts fell to 25 percent below market during the 2008 crisis and have not fully recovered. The widening gap between them is the central finding.');

    var defs = svg.append('defs');
    defs.append('clipPath').attr('id', 'pw-line-clip')
      .append('rect').attr('width', w).attr('height', h);
    defs.append('clipPath').attr('id', 'pw-gap-clip')
      .append('rect').attr('width', 0).attr('height', h);

    /* Vertical gradient for the gap fill. Navy at top edge, amber
     * at bottom edge. */
    var grad = defs.append('linearGradient').attr('id', 'pw-gap-grad')
      .attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 1);
    grad.append('stop').attr('offset', '0%')
      .attr('stop-color', COLOR_NAVY).attr('stop-opacity', 0.14);
    grad.append('stop').attr('offset', '50%')
      .attr('stop-color', COLOR_NAVY).attr('stop-opacity', 0.06);
    grad.append('stop').attr('offset', '100%')
      .attr('stop-color', COLOR_AMBER).attr('stop-opacity', 0.14);

    gapClipRect = defs.select('#pw-gap-clip rect');

    var g = svg.append('g').attr('transform', 'translate(' + m.left + ',' + m.top + ')');
    var x = d3.scaleLinear([2000, 2022], [0, w]);
    var y = d3.scaleLinear([yFloor, yCap], [h, 0]);

    /* x axis */
    g.append('g').attr('transform', 'translate(0,' + h + ')')
      .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format('d')).tickSize(0))
      .call(function (a) { a.select('.domain').attr('stroke', AXIS_LINE); })
      .call(function (a) {
        a.selectAll('text').attr('fill', AXIS_TEXT)
          .attr('dy', '1em')
          .style('font-size', '11px').style('font-family', font);
      });

    /* y axis with gridlines and a signed format. */
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
          .attr('dx', '-0.4em')
          .style('font-size', '11px').style('font-family', font);
      });

    /* Zero baseline. The line above it is overpaying. The line
     * below is buying the crisis. */
    g.append('line').attr('x1', 0).attr('x2', w)
      .attr('y1', y(0)).attr('y2', y(0))
      .attr('stroke', ZERO_LINE).attr('stroke-width', 1)
      .attr('stroke-dasharray', '3 3');

    /* Gap fill behind everything else, clipped by a rect that grows
     * with the draw animation. */
    var gapArea = d3.area()
      .x(function (d) { return x(d.year); })
      .y0(function (d) { return y(Math.max(d.flipping, yFloor)); })
      .y1(function (d) { return y(Math.min(d.holding, yCap)); })
      .curve(d3.curveMonotoneX);

    g.append('path').datum(combined)
      .attr('fill', 'url(#pw-gap-grad)')
      .attr('d', gapArea)
      .attr('clip-path', 'url(#pw-gap-clip)');

    /* 2008 marker line plus the vertical label along it. Type sits
     * heavier and slightly higher contrast so the eye finds it. */
    marker2008 = g.append('line')
      .attr('x1', x(2008)).attr('x2', x(2008))
      .attr('y1', 0).attr('y2', h)
      .attr('stroke', MARKER_LINE).attr('stroke-dasharray', '4 3')
      .attr('stroke-opacity', 0.4);

    g.append('text')
      .attr('transform', 'translate(' + (x(2008) - 9) + ',' + (h * 0.18) + ') rotate(-90)')
      .attr('text-anchor', 'end')
      .attr('fill', 'rgba(106, 102, 94, 0.82)')
      .style('font-size', '10px')
      .style('font-family', font)
      .style('font-weight', '600')
      .style('letter-spacing', '0.14em')
      .style('text-transform', 'uppercase')
      .text('2008 financial crisis');

    /* Split the data at 2008 for the muted vs full visual treatment.
     * Boundary year sits in both halves so the lines stay continuous. */
    var holdPre = holdData.filter(function (d) { return d.year <= 2008; });
    var holdPost = holdData.filter(function (d) { return d.year >= 2008; });
    var flipPre = flipData.filter(function (d) { return d.year <= 2008; });
    var flipPost = flipData.filter(function (d) { return d.year >= 2008; });

    var lineHold = d3.line()
      .x(function (d) { return x(d.year); })
      .y(function (d) { return y(Math.min(d.premium, yCap)); })
      .curve(d3.curveMonotoneX);
    var lineFlip = d3.line()
      .x(function (d) { return x(d.year); })
      .y(function (d) { return y(Math.max(d.premium, yFloor)); })
      .curve(d3.curveMonotoneX);

    /* Holding line halves. */
    pathHoldPre = g.append('path').datum(holdPre)
      .attr('fill', 'none')
      .attr('stroke', COLOR_NAVY_PRE).attr('stroke-width', 1.8)
      .attr('stroke-linecap', 'round').attr('d', lineHold);
    lenHoldPre = pathHoldPre.node().getTotalLength();
    pathHoldPre.attr('stroke-dasharray', lenHoldPre)
      .attr('stroke-dashoffset', lenHoldPre);

    pathHoldPost = g.append('path').datum(holdPost)
      .attr('fill', 'none')
      .attr('stroke', COLOR_NAVY).attr('stroke-width', 3)
      .attr('stroke-linecap', 'round').attr('d', lineHold);
    lenHoldPost = pathHoldPost.node().getTotalLength();
    pathHoldPost.attr('stroke-dasharray', lenHoldPost)
      .attr('stroke-dashoffset', lenHoldPost);

    /* Flipping line halves. */
    pathFlipPre = g.append('path').datum(flipPre)
      .attr('fill', 'none')
      .attr('stroke', COLOR_AMBER_PRE).attr('stroke-width', 1.8)
      .attr('stroke-linecap', 'round').attr('d', lineFlip);
    lenFlipPre = pathFlipPre.node().getTotalLength();
    pathFlipPre.attr('stroke-dasharray', lenFlipPre)
      .attr('stroke-dashoffset', lenFlipPre);

    pathFlipPost = g.append('path').datum(flipPost)
      .attr('fill', 'none')
      .attr('stroke', COLOR_AMBER).attr('stroke-width', 3)
      .attr('stroke-linecap', 'round').attr('d', lineFlip);
    lenFlipPost = pathFlipPost.node().getTotalLength();
    pathFlipPost.attr('stroke-dasharray', lenFlipPost)
      .attr('stroke-dashoffset', lenFlipPost);

    /* Anchor dots, low opacity. */
    dotGroupHold = g.append('g').attr('opacity', 0);
    holdData.forEach(function (d) {
      dotGroupHold.append('circle')
        .attr('cx', x(d.year)).attr('cy', y(Math.min(d.premium, yCap)))
        .attr('r', 1.8).attr('fill', COLOR_NAVY).attr('opacity', 0.35);
    });
    dotGroupFlip = g.append('g').attr('opacity', 0);
    flipData.forEach(function (d) {
      dotGroupFlip.append('circle')
        .attr('cx', x(d.year)).attr('cy', y(Math.max(d.premium, yFloor)))
        .attr('r', 1.8).attr('fill', COLOR_AMBER).attr('opacity', 0.35);
    });

    /* End-of-line callouts. The holding callout is the headline:
     * +82% deserves more weight than +9%. Sized asymmetrically so
     * the reader's eye goes to the larger one first. */
    var lastH = holdData[holdData.length - 1];
    var lastF = flipData[flipData.length - 1];

    endHoldCallout = g.append('g').attr('opacity', 0)
      .attr('transform', 'translate(' + (x(2022) + 14) + ',' + y(Math.min(lastH.premium, yCap)) + ')');
    endHoldCallout.append('text')
      .attr('x', 0).attr('y', 4)
      .attr('fill', COLOR_END)
      .style('font-family', serif)
      .style('font-size', '34px')
      .style('font-weight', '400')
      .text('+' + Math.round(lastH.premium) + '%');
    endHoldCallout.append('text')
      .attr('x', 1).attr('y', 21)
      .attr('fill', COLOR_NAVY)
      .style('font-family', mono)
      .style('font-size', '10px')
      .style('letter-spacing', '0.12em')
      .text('HOLDING');

    endFlipCallout = g.append('g').attr('opacity', 0)
      .attr('transform', 'translate(' + (x(2022) + 14) + ',' + y(lastF.premium) + ')');
    endFlipCallout.append('text')
      .attr('x', 0).attr('y', 2)
      .attr('fill', COLOR_END)
      .style('font-family', serif)
      .style('font-size', '22px')
      .style('font-weight', '400')
      .text((lastF.premium > 0 ? '+' : '') + Math.round(lastF.premium) + '%');
    endFlipCallout.append('text')
      .attr('x', 1).attr('y', 18)
      .attr('fill', COLOR_AMBER)
      .style('font-family', mono)
      .style('font-size', '9.5px')
      .style('letter-spacing', '0.12em')
      .text('FLIPPING');

    /* The 2008 trough callout. The single most arresting number on
     * this chart. Leader runs down and to the LEFT into the empty
     * bottom-left quadrant so it does not cross the rising holding
     * line. */
    var trough = flipData.find(function (d) { return d.year === 2009; })
              || flipData.reduce(function (a, b) { return a.premium < b.premium ? a : b; });
    if (trough) {
      var tx = x(trough.year);
      var ty = y(trough.premium);
      var labelY = ty - 50;
      troughCallout = g.append('g').attr('opacity', 0);
      troughCallout.append('text')
        .attr('x', tx).attr('y', labelY)
        .attr('text-anchor', 'middle')
        .attr('fill', COLOR_END)
        .style('font-family', serif)
        .style('font-size', '20px')
        .style('font-weight', '400')
        .text(Math.round(trough.premium) + '% in ' + trough.year);
    }

    /* The "the gap" annotation. A small italic serif label sits in
     * the empty top-left quadrant, connected by a thin curved line
     * to the widest part of the wedge (around 2018-2019). The
     * annotation makes the chart an argument: this gap is the
     * point. */
    var widest = combined.reduce(function (a, b) {
      var ga = a.holding - a.flipping;
      var gb = b.holding - b.flipping;
      return gb > ga ? b : a;
    }, combined[0]);
    if (widest) {
      var wx = x(widest.year);
      var wyTop = y(Math.min(widest.holding, yCap));
      var wyBot = y(Math.max(widest.flipping, yFloor));
      var wyMid = (wyTop + wyBot) / 2;
      var labX = Math.max(8, wx - 150);
      var labY = Math.max(18, wyTop - 18);

      gapAnnotation = g.append('g').attr('opacity', 0);

      /* Curved leader: a quadratic Bezier from the label to the
       * midpoint of the wedge. The control point sits above and to
       * the right of the label so the curve arcs gently down. */
      var midX = (labX + 30 + wx) / 2;
      var midY = labY + 4;
      var curveD = 'M ' + (labX + 30) + ' ' + (labY + 4)
                 + ' Q ' + midX + ' ' + midY + ' ' + wx + ' ' + wyMid;
      gapAnnotation.append('path')
        .attr('d', curveD)
        .attr('fill', 'none')
        .attr('stroke', ANNO_LINE)
        .attr('stroke-width', 1)
        .attr('stroke-opacity', 0.8)
        .attr('stroke-linecap', 'round');

      gapAnnotation.append('text')
        .attr('x', labX).attr('y', labY)
        .attr('fill', ANNO_TEXT)
        .style('font-family', serif)
        .style('font-style', 'italic')
        .style('font-size', '14px')
        .text('the gap');
    }

    /* Inline legend, top left. Useful here because both lines need
     * naming and the end labels do double duty as values. */
    var lg = svg.append('g').attr('transform', 'translate(' + (m.left + 4) + ', 18)');
    lg.append('line').attr('x1', 0).attr('x2', 18).attr('y1', 0).attr('y2', 0)
      .attr('stroke', COLOR_NAVY).attr('stroke-width', 3);
    lg.append('text').attr('x', 24).attr('y', 4).attr('fill', LEGEND_TEXT)
      .style('font-size', '11px').style('font-family', font).text('Holding tracts');
    lg.append('line').attr('x1', 130).attr('x2', 148).attr('y1', 0).attr('y2', 0)
      .attr('stroke', COLOR_AMBER).attr('stroke-width', 3);
    lg.append('text').attr('x', 154).attr('y', 4).attr('fill', LEGEND_TEXT)
      .style('font-size', '11px').style('font-family', font).text('Flipping tracts');

    /* Hover layer: vertical guide and a four-row frosted card. */
    hoverLayer = svg.append('g').attr('opacity', 0).style('pointer-events', 'none');
    var hoverLine = hoverLayer.append('line')
      .attr('y1', m.top).attr('y2', m.top + h)
      .attr('stroke', '#6A665E').attr('stroke-width', 1)
      .attr('stroke-opacity', 0.35).attr('stroke-dasharray', '2 3');
    var hoverCard = hoverLayer.append('g');
    hoverCard.append('rect')
      .attr('width', 156).attr('height', 86)
      .attr('rx', 8)
      .attr('fill', 'rgba(255, 255, 255, 0.95)')
      .attr('stroke', 'rgba(156, 152, 144, 0.4)')
      .attr('stroke-width', 0.5);
    var rowYear = hoverCard.append('text')
      .attr('x', 12).attr('y', 18)
      .attr('fill', '#191816')
      .style('font-family', mono).style('font-size', '11px')
      .style('font-weight', '700').style('letter-spacing', '0.06em');
    var rowHold = hoverCard.append('text')
      .attr('x', 12).attr('y', 38)
      .attr('fill', COLOR_NAVY)
      .style('font-family', font).style('font-size', '11px');
    var rowFlip = hoverCard.append('text')
      .attr('x', 12).attr('y', 56)
      .attr('fill', COLOR_AMBER)
      .style('font-family', font).style('font-size', '11px');
    var rowGap = hoverCard.append('text')
      .attr('x', 12).attr('y', 76)
      .attr('fill', AXIS_TEXT)
      .style('font-family', mono).style('font-size', '10.5px');
    var hoverDotHold = hoverLayer.append('circle')
      .attr('r', 4).attr('fill', '#FFFFFF')
      .attr('stroke', COLOR_NAVY).attr('stroke-width', 2);
    var hoverDotFlip = hoverLayer.append('circle')
      .attr('r', 4).attr('fill', '#FFFFFF')
      .attr('stroke', COLOR_AMBER).attr('stroke-width', 2);

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
        var row = combined.find(function (r) { return r.year === year; });
        if (!row) return;

        var px = x(year) + m.left;
        var pyHold = y(Math.min(row.holding, yCap)) + m.top;
        var pyFlip = y(Math.max(row.flipping, yFloor)) + m.top;

        hoverLayer.attr('opacity', 1);
        hoverLine.attr('x1', px).attr('x2', px);
        hoverDotHold.attr('cx', px).attr('cy', pyHold);
        hoverDotFlip.attr('cx', px).attr('cy', pyFlip);

        var cardX = px + 14;
        if (cardX + 156 > width - 4) cardX = px - 170;
        var cardY = m.top + 6;
        hoverCard.attr('transform', 'translate(' + cardX + ',' + cardY + ')');

        rowYear.text(year);
        rowHold.text('Holding: ' + (row.holding > 0 ? '+' : '') + Math.round(row.holding) + '%');
        rowFlip.text('Flipping: ' + (row.flipping > 0 ? '+' : '') + Math.round(row.flipping) + '%');
        var gap = Math.round(row.holding - row.flipping);
        rowGap.text('Gap: ' + gap + ' percentage points');
      })
      .on('mouseleave', function () {
        hoverLayer.attr('opacity', 0);
      });

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
