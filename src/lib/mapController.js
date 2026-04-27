import * as d3 from 'd3';
import {
  HOLD_RAMP,
  FLIP_RAMP,
  COLORS,
  accentColorFromDominant,
  tractStrokeFromDominant,
  isLowDataTract
} from '$lib/formatters';

const LABEL_NEIGHBORHOODS = [
  'Downtown',
  'Back Bay',
  'South Boston Waterfront',
  'Dorchester',
  'East Boston',
  'Mattapan',
  'Roxbury',
  'Jamaica Plain',
  'South End',
  'Fenway',
  'South Boston',
  'Hyde Park',
  'Allston',
  'Brighton',
  'Charlestown',
  'West Roxbury',
  'Roslindale'
];

const SHORT_NAMES = {
  'South Boston Waterfront': 'Seaport',
  'Jamaica Plain': 'JP',
  'South Boston': 'S. Boston',
  'West Roxbury': 'W. Roxbury'
};

const HOVER_STROKE_WIDTH = 1.8;
const SELECTED_STROKE = '#ffffff';

/* Boston Common, the geographic origin of the radial bloom. Tracts
 * near here color first; the wave travels outward. */
const BLOOM_ORIGIN_LON = -71.0655;
const BLOOM_ORIGIN_LAT = 42.3554;

/* Nudge a hex color toward white by amt (0..1). Used for the brightness
 * overshoot during the bloom transition: each tract briefly flashes
 * 18% lighter than its target color, then settles. The standard
 * animation principle of follow-through. */
function lighten(hex, amt) {
  var c = d3.color(hex);
  if (!c) return hex;
  var rgb = c.rgb();
  rgb.r = rgb.r + (255 - rgb.r) * amt;
  rgb.g = rgb.g + (255 - rgb.g) * amt;
  rgb.b = rgb.b + (255 - rgb.b) * amt;
  return rgb.formatHex();
}

export function createMapController(callbacks = {}) {
  let container = null;
  let geoData = null;
  let ranges = null;

  let svgElement = null;
  let mapGroup = null;
  let tractPaths = null;
  let pathGenerator = null;
  let zoomBehavior = null;
  let neighborhoodLabels = null;
  let tractIdLabels = null;

  let currentFocus = 'all';
  let selectedNeighborhood = null;
  let hoveredClass = null;
  let hoveredPath = null;
  let selectedPath = null;
  let selectedGeoid = null;
  let leaveTimer = null;
  let pendingPointerDown = null;
  let presentationState = 'interactive';
  let previousPresentationState = 'interactive';
  let allowInteraction = true;
  let bloomMaxDist = 1;
  let pulseTimer = null;

  const holdColorScale = d3.scaleSequential().interpolator(d3.interpolateRgbBasis(HOLD_RAMP));
  const flipColorScale = d3.scaleSequential().interpolator(d3.interpolateRgbBasis(FLIP_RAMP));

  function tractClassFromProps(props) {
    if (isLowDataTract(props)) return 'low_data';
    if (props?.dominant === 'holding') return 'holding';
    if (props?.dominant === 'flipping') return 'flipping';
    return 'mixed';
  }

  function tractStrokeFromProps(props) {
    if (isLowDataTract(props)) return tractStrokeFromDominant('mixed');
    return tractStrokeFromDominant(props.dominant);
  }

  function tractAccentFromProps(props) {
    if (isLowDataTract(props)) return '#8E897F';
    return accentColorFromDominant(props.dominant);
  }

  function classifiedTractFill(feature) {
    const p = feature.properties;

    if (isLowDataTract(p)) {
      return COLORS.neutral;
    }

    if (p.dominant === 'holding' && ranges?.hold_score && Number.isFinite(p.hold_score)) {
      holdColorScale.domain([ranges.hold_score.min, ranges.hold_score.max]);
      return holdColorScale(p.hold_score);
    }

    if (p.dominant === 'flipping' && ranges?.flip_score && Number.isFinite(p.flip_score)) {
      flipColorScale.domain([ranges.flip_score.min, ranges.flip_score.max]);
      return flipColorScale(p.flip_score);
    }

    return COLORS.neutral;
  }

  function tractFill(feature) {
    var props = feature.properties;

    if (presentationState === 'gray') {
      return isLowDataTract(props) ? '#F5F3ED' : '#CFC9BC';
    }

    return classifiedTractFill(feature);
  }

  function tractOpacity(feature) {
    var props = feature.properties;

    if (presentationState === 'holdingDimmed') {
      return props.dominant === 'flipping' && !isLowDataTract(props) ? 1 : 0.12;
    }

    if (presentationState === 'gray') {
      return isLowDataTract(props) ? 0.45 : 0.9;
    }

    return 1;
  }

  /* The flip-pulse breath. Applied while the map sits in holdingDimmed
   * state; only flipping tracts receive the class. The CSS keyframe
   * lives in app.css and runs an opacity 1 to 0.92 cycle every 3.2s. */
  function applyFlipPulseClass(active) {
    if (!tractPaths) return;
    tractPaths.classed('flip-pulse', function (f) {
      return active && f.properties.dominant === 'flipping' && !isLowDataTract(f.properties);
    });
  }

  function clearFlipPulseTimer() {
    if (pulseTimer) {
      clearTimeout(pulseTimer);
      pulseTimer = null;
    }
  }

  function applyPresentationState(options) {
    options = options || {};
    if (!tractPaths) return;

    var animate = options.animate !== false;
    if (!allowInteraction || presentationState !== 'interactive') {
      tractPaths.classed('dimmed', false);
    }

    var pointerVal = allowInteraction ? 'auto' : 'none';

    /* Remove policy annotations unless entering the annotated state. */
    if (presentationState !== 'fullViewAnnotated') {
      removePolicyAnnotations();
    }

    /* Clear any in-flight pulse so transitions do not collide. */
    clearFlipPulseTimer();
    if (presentationState !== 'holdingDimmed') {
      applyFlipPulseClass(false);
    }

    /* Geographic radial bloom with brightness overshoot.
     *
     * Tracts near Boston Common color first; the wave radiates outward.
     * Each tract first transitions to a brighter version of its target
     * color (520ms), then settles to the correct value (320ms). This
     * follow-through gives the bloom an organic, almost living quality.
     * Holding leads, mixed follows, flipping last. */
    if (animate && previousPresentationState === 'gray' && presentationState === 'classified') {
      var md = bloomMaxDist || 1;
      var overshootMs = 520;
      var settleMs = 320;

      function bloomTract(filterFn, baseDelay, fanout) {
        var sel = tractPaths.filter(filterFn);

        sel.transition('bloom-overshoot')
          .delay(function (f) { return baseDelay + ((f._bloomDist || 0) / md) * fanout; })
          .duration(overshootMs).ease(d3.easeCubicOut)
          .attr('fill', function (f) { return lighten(tractFill(f), 0.18); })
          .attr('opacity', tractOpacity)
          .attr('pointer-events', pointerVal);

        sel.transition('bloom-settle')
          .delay(function (f) {
            return baseDelay + ((f._bloomDist || 0) / md) * fanout + overshootMs;
          })
          .duration(settleMs).ease(d3.easeCubicInOut)
          .attr('fill', tractFill);
      }

      bloomTract(
        function (f) {
          return f.properties.dominant === 'holding' && !isLowDataTract(f.properties);
        },
        0, 1400
      );

      bloomTract(
        function (f) {
          var d = f.properties.dominant;
          return d !== 'holding' && d !== 'flipping' && !isLowDataTract(f.properties);
        },
        400, 1200
      );

      bloomTract(
        function (f) {
          return f.properties.dominant === 'flipping' && !isLowDataTract(f.properties);
        },
        600, 1400
      );

      /* Low-data tracts fade in together at the end. */
      tractPaths.filter(function (f) { return isLowDataTract(f.properties); })
        .transition('bloom-low').delay(1800).duration(600).ease(d3.easeCubicOut)
        .attr('fill', tractFill).attr('opacity', tractOpacity)
        .attr('pointer-events', pointerVal);

      refreshPathStrokes();
      return;
    }

    /* Standard transition for all other state changes. */
    var target = animate
      ? tractPaths.transition('state-change').duration(800).ease(d3.easeCubicInOut)
      : tractPaths;

    target
      .attr('fill', tractFill)
      .attr('opacity', tractOpacity)
      .attr('pointer-events', pointerVal);

    refreshPathStrokes();

    /* Show policy zone labels when entering the annotated state. */
    if (presentationState === 'fullViewAnnotated' && animate) {
      setTimeout(addPolicyAnnotations, 400);
    } else if (presentationState === 'fullViewAnnotated') {
      addPolicyAnnotations();
    }

    /* Schedule the flip-pulse breath after the dim transition completes.
     * Starting it earlier would compete with the opacity transition and
     * the eye would read flicker rather than breath. */
    if (presentationState === 'holdingDimmed') {
      var pulseDelay = animate ? 850 : 0;
      pulseTimer = setTimeout(function () {
        if (presentationState === 'holdingDimmed') applyFlipPulseClass(true);
      }, pulseDelay);
    }
  }

  /* Policy zone labels placed at the centroid of each tract cluster. */
  function addPolicyAnnotations() {
    if (!mapGroup || !geoData || !pathGenerator) return;
    removePolicyAnnotations();

    var holdFeats = geoData.features.filter(function (f) {
      return f.properties.dominant === 'holding' && !isLowDataTract(f.properties);
    });
    var flipFeats = geoData.features.filter(function (f) {
      return f.properties.dominant === 'flipping' && !isLowDataTract(f.properties);
    });

    function clusterCenter(feats) {
      var xs = [], ys = [];
      feats.forEach(function (f) {
        var c = pathGenerator.centroid(f);
        if (c && !isNaN(c[0])) { xs.push(c[0]); ys.push(c[1]); }
      });
      return [d3.mean(xs) || 0, d3.mean(ys) || 0];
    }

    var hc = clusterCenter(holdFeats);
    var fc = clusterCenter(flipFeats);
    var font = 'Plus Jakarta Sans, sans-serif';

    function placeLabel(cx, cy, text, color, bgColor) {
      var g = mapGroup.append('g')
        .attr('class', 'policy-annotation')
        .attr('transform', 'translate(' + cx + ',' + cy + ')');

      var t = g.append('text')
        .attr('text-anchor', 'middle').attr('dy', '0.35em')
        .attr('fill', color)
        .attr('font-size', '11px').attr('font-weight', '700')
        .attr('font-family', font)
        .text(text);

      var bbox = t.node().getBBox();
      g.insert('rect', 'text')
        .attr('x', bbox.x - 6).attr('y', bbox.y - 3)
        .attr('width', bbox.width + 12).attr('height', bbox.height + 6)
        .attr('rx', 4).attr('fill', bgColor).attr('opacity', 0.88);

      g.attr('opacity', 0)
        .transition().duration(500).ease(d3.easeCubicOut)
        .attr('opacity', 1);
    }

    placeLabel(hc[0], hc[1], 'Transfer fee zone', '#1B3A5C', '#E2ECF4');
    placeLabel(fc[0], fc[1], 'TOPA zone', '#7A5020', '#FDF4E6');
  }

  function removePolicyAnnotations() {
    if (mapGroup) mapGroup.selectAll('.policy-annotation').remove();
  }

  function applyDimming() {
    if (!tractPaths) return;
    if (!allowInteraction || presentationState !== 'interactive') return;

    tractPaths.classed('dimmed', (feature) => {
      const props = feature.properties;
      const thisClass = tractClassFromProps(props);
      const isSelected = Boolean(selectedGeoid && props.geoid === selectedGeoid);
      let dimByNeighborhood = false;
      let dimByFocus = false;
      let dimByLowDataFocus = false;
      let dimByHoverContext = false;

      if (selectedNeighborhood && props.neighborhood !== selectedNeighborhood) {
        dimByNeighborhood = true;
      }

      if (currentFocus === 'hold' && props.dominant !== 'holding') {
        dimByFocus = true;
      } else if (currentFocus === 'flip' && props.dominant !== 'flipping') {
        dimByFocus = true;
      } else if (currentFocus === 'mixed' && props.dominant !== 'mixed') {
        dimByFocus = true;
      }

      if (currentFocus !== 'all' && thisClass === 'low_data') {
        dimByLowDataFocus = true;
      }

      if (currentFocus === 'all' && hoveredClass) {
        dimByHoverContext = thisClass !== hoveredClass;
      }

      const dimByFilters = dimByNeighborhood || dimByFocus || dimByLowDataFocus;

      if (isSelected && !dimByFilters) return false;

      return dimByFilters || dimByHoverContext;
    });
  }

  function selectedProps() {
    if (selectedPath) {
      const datum = d3.select(selectedPath).datum();
      if (datum?.properties?.geoid === selectedGeoid) return datum.properties;
    }

    if (!selectedGeoid || !geoData?.features) return null;
    const feature = geoData.features.find((entry) => entry.properties?.geoid === selectedGeoid);
    return feature?.properties ?? null;
  }

  function tractMatchesActiveFilters(props) {
    if (!props) return false;

    if (selectedNeighborhood && props.neighborhood !== selectedNeighborhood) return false;

    if (currentFocus === 'hold' && props.dominant !== 'holding') return false;
    if (currentFocus === 'flip' && props.dominant !== 'flipping') return false;
    if (currentFocus === 'mixed' && props.dominant !== 'mixed') return false;

    if (currentFocus !== 'all' && tractClassFromProps(props) === 'low_data') return false;

    return true;
  }

  function ensureSelectionMatchesActiveFilters(options = {}) {
    const { notify = true } = options;
    if (!selectedGeoid) return;

    const props = selectedProps();
    if (!props || !tractMatchesActiveFilters(props)) {
      clearSelection({ notify });
    }
  }

  function matchesCurrentStrategyFilter(props) {
    if (currentFocus === 'all') return true;

    if (currentFocus === 'hold') return props?.dominant === 'holding';
    if (currentFocus === 'flip') return props?.dominant === 'flipping';
    if (currentFocus === 'mixed') return props?.dominant === 'mixed';

    return true;
  }

  function setNeighborhoodFilter(name, options = {}) {
    const { notify = true } = options;
    selectedNeighborhood = name || null;
    ensureSelectionMatchesActiveFilters({ notify });
    applyDimming();
    if (notify) callbacks.onNeighborhoodChange?.({ name: selectedNeighborhood });
  }

  function clearNeighborhoodFilter(options = {}) {
    const { notify = true } = options;
    if (!selectedNeighborhood) return;
    setNeighborhoodFilter(null, { notify });
  }

  function onZoom(event) {
    mapGroup.attr('transform', event.transform);
    const k = event.transform.k;
    if (tractPaths) {
      refreshPathStrokes(k);
    }

    if (neighborhoodLabels) {
      neighborhoodLabels.attr('opacity', k > 2 ? Math.min(0.24, 0.12 * (k - 2)) : 0);
    }

    if (tractIdLabels) {
      tractIdLabels.attr('opacity', k > 5 ? Math.min(0.4, 0.13 * (k - 5)) : 0);
    }

    callbacks.onZoomChange?.({ k });
  }

  function baseStrokeWidth(k) {
    return Math.max(0.15, 0.5 / k);
  }

  function emphasisStrokeWidth(k) {
    return HOVER_STROKE_WIDTH / k;
  }

  function applyPathStroke(pathNode, k) {
    const node = d3.select(pathNode);
    const datum = node.datum();
    if (!datum?.properties) return;

    if (selectedPath === pathNode) {
      node.attr('stroke', SELECTED_STROKE).attr('stroke-width', emphasisStrokeWidth(k) + 'px');
      return;
    }

    if (hoveredPath === pathNode) {
      node
        .attr('stroke', tractAccentFromProps(datum.properties))
        .attr('stroke-width', emphasisStrokeWidth(k) + 'px');
      return;
    }

    node
      .attr('stroke', tractStrokeFromProps(datum.properties))
      .attr('stroke-width', baseStrokeWidth(k) + 'px');
  }

  function refreshPathStrokes(explicitK = null) {
    if (!svgElement || !tractPaths) return;
    const k = explicitK ?? d3.zoomTransform(svgElement.node()).k;

    tractPaths.each(function () {
      applyPathStroke(this, k);
    });

    if (hoveredPath && hoveredPath.parentNode) hoveredPath.parentNode.appendChild(hoveredPath);
    if (selectedPath && selectedPath.parentNode) selectedPath.parentNode.appendChild(selectedPath);
  }

  function selectPath(pathNode, feature, options = {}) {
    const { notify = true } = options;
    selectedPath = pathNode || null;
    selectedGeoid = feature?.properties?.geoid ?? null;
    refreshPathStrokes();
    if (notify && feature) callbacks.onSelect?.({ feature });
  }

  function clearSelection(options = {}) {
    const { notify = true } = options;
    if (!selectedPath && !selectedGeoid) return;
    selectedPath = null;
    selectedGeoid = null;
    refreshPathStrokes();
    if (notify) callbacks.onSelectClear?.();
  }

  function clearHoverState(options = {}) {
    const { notify = true } = options;

    if (leaveTimer) {
      clearTimeout(leaveTimer);
      leaveTimer = null;
    }
    pendingPointerDown = null;

    hoveredPath = null;
    hoveredClass = null;
    applyDimming();
    refreshPathStrokes();

    if (notify) callbacks.onHoverClear?.();
    callbacks.onTooltipHide?.();
  }

  function handleMouseEnter(event, feature) {
    if (leaveTimer) {
      clearTimeout(leaveTimer);
      leaveTimer = null;
    }

    if (!svgElement) return;

    const props = feature.properties;
    hoveredPath = this;
    hoveredClass = isLowDataTract(props) ? null : tractClassFromProps(props);
    applyDimming();
    refreshPathStrokes();

    callbacks.onHover?.({ feature, event });
    callbacks.onTooltipShow?.({ feature, event });
  }

  function handleMouseMove(event, feature) {
    callbacks.onHoverMove?.({ feature, event });
    callbacks.onTooltipMove?.({ event });
  }

  function handleMouseLeave(_event, _feature) {
    if (!svgElement) return;
    if (hoveredPath === this) hoveredPath = null;
    if (leaveTimer) {
      clearTimeout(leaveTimer);
      leaveTimer = null;
    }

    leaveTimer = setTimeout(() => {
      clearHoverState();
    }, 50);
  }

  function toggleSelection(pathNode, feature) {
    if (leaveTimer) {
      clearTimeout(leaveTimer);
      leaveTimer = null;
    }

    const props = feature.properties;

    if (!matchesCurrentStrategyFilter(props)) {
      currentFocus = 'all';
      callbacks.onFocusChange?.({ mode: 'all' });
    }

    applyDimming();

    if (isLowDataTract(props)) return;

    if (selectedNeighborhood && props.neighborhood !== selectedNeighborhood) {
      clearNeighborhoodFilter({ notify: true });
    }

    if (selectedGeoid && selectedGeoid === props.geoid) {
      clearSelection({ notify: true });
      return;
    }

    selectPath(pathNode, feature, { notify: true });
  }

  function clearPendingPointerDown() {
    pendingPointerDown = null;
  }

  function handleTractPointerDown(event, _feature) {
    pendingPointerDown = {
      pathNode: this,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY
    };
  }

  function handleTractPointerUp(event, feature) {
    if (!pendingPointerDown) return;
    const samePath = pendingPointerDown.pathNode === this;
    const samePointer = pendingPointerDown.pointerId === event.pointerId;
    if (!samePath || !samePointer) {
      clearPendingPointerDown();
      return;
    }

    const dx = event.clientX - pendingPointerDown.x;
    const dy = event.clientY - pendingPointerDown.y;
    clearPendingPointerDown();

    const movement = Math.hypot(dx, dy);
    if (movement > 6) return;

    toggleSelection(this, feature);
  }

  function buildMap() {
    if (!container || !geoData || !ranges) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    d3.select(container).html('');
    hoveredPath = null;
    hoveredClass = null;
    pendingPointerDown = null;
    if (leaveTimer) {
      clearTimeout(leaveTimer);
      leaveTimer = null;
    }
    clearFlipPulseTimer();

    svgElement = d3
      .select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('role', 'img')
      .attr('aria-label', 'Map of Boston census tracts colored by dominant investor strategy');

    svgElement
      .append('defs')
      .append('clipPath')
      .attr('id', 'map-clip')
      .append('rect')
      .attr('width', width)
      .attr('height', height);

    mapGroup = svgElement.append('g').attr('clip-path', 'url(#map-clip)');

    const projection = d3.geoMercator().fitSize([width * 0.98, height * 0.98], geoData);
    const projectionTranslate = projection.translate();
    projection.translate([projectionTranslate[0] + width * 0.01, projectionTranslate[1] + height * 0.01]);

    pathGenerator = d3.geoPath().projection(projection);

    tractPaths = mapGroup
      .selectAll('.tract')
      .data(geoData.features)
      .join('path')
      .attr('class', 'tract')
      .attr('d', pathGenerator)
      .attr('fill', tractFill)
      .attr('opacity', tractOpacity)
      .attr('stroke', (d) => tractStrokeFromProps(d.properties))
      .attr('stroke-width', 0.5)
      .attr('pointer-events', allowInteraction ? 'auto' : 'none');

    /* Pre-compute radial distances from Boston Common for the bloom. */
    var commonXY = projection([BLOOM_ORIGIN_LON, BLOOM_ORIGIN_LAT]);
    if (commonXY && !isNaN(commonXY[0])) {
      tractPaths.each(function (feature) {
        var c = pathGenerator.centroid(feature);
        if (c && !isNaN(c[0])) {
          feature._bloomDist = Math.hypot(c[0] - commonXY[0], c[1] - commonXY[1]);
        } else {
          feature._bloomDist = 999;
        }
      });
      bloomMaxDist = d3.max(tractPaths.data(), function (f) { return f._bloomDist || 0; }) || 1;
    }

    if (allowInteraction) {
      tractPaths
        .on('mouseenter', handleMouseEnter)
        .on('mousemove', handleMouseMove)
        .on('mouseleave', handleMouseLeave)
        .on('pointerdown', handleTractPointerDown)
        .on('pointerup', handleTractPointerUp)
        .on('pointercancel', clearPendingPointerDown);
    }

    if (selectedGeoid) {
      selectedPath = tractPaths.filter((d) => d.properties.geoid === selectedGeoid).node() || null;
      if (!selectedPath) selectedGeoid = null;
    } else {
      selectedPath = null;
    }

    const neighborhoodCentroids = {};

    geoData.features.forEach((feature) => {
      const name = feature.properties.neighborhood;
      if (!name) return;

      const centroid = pathGenerator.centroid(feature);
      if (!centroid || Number.isNaN(centroid[0])) return;

      if (!neighborhoodCentroids[name]) neighborhoodCentroids[name] = { xs: [], ys: [], name };

      neighborhoodCentroids[name].xs.push(centroid[0]);
      neighborhoodCentroids[name].ys.push(centroid[1]);
    });

    const labelData = Object.values(neighborhoodCentroids)
      .filter((neighborhood) => LABEL_NEIGHBORHOODS.includes(neighborhood.name))
      .map((neighborhood) => ({
        name: SHORT_NAMES[neighborhood.name] || neighborhood.name,
        x: d3.mean(neighborhood.xs),
        y: d3.mean(neighborhood.ys)
      }));

    neighborhoodLabels = mapGroup
      .selectAll('.neighborhood-label')
      .data(labelData)
      .join('text')
      .attr('class', 'neighborhood-label')
      .attr('x', (d) => d.x)
      .attr('y', (d) => d.y)
      .attr('font-size', '9px')
      .attr('opacity', 0)
      .text((d) => d.name);

    const idData = geoData.features
      .map((feature) => {
        const centroid = pathGenerator.centroid(feature);
        return {
          id: feature.properties.geoid ? feature.properties.geoid.slice(-4) : '',
          x: centroid[0],
          y: centroid[1]
        };
      })
      .filter((entry) => !Number.isNaN(entry.x));

    tractIdLabels = mapGroup
      .selectAll('.tract-id-label')
      .data(idData)
      .join('text')
      .attr('class', 'tract-id-label')
      .attr('x', (d) => d.x)
      .attr('y', (d) => d.y)
      .attr('font-size', '6px')
      .attr('opacity', 0)
      .text((d) => d.id);

    if (allowInteraction) {
      zoomBehavior = d3
        .zoom()
        .scaleExtent([1, 16])
        .clickDistance(8)
        .tapDistance(12)
        .filter((event) => {
          const target = event.target;
          const isTract = target?.classList?.contains('tract');

          if (event.type === 'wheel') return true;
          if (isTract) return false;

          if (event.type === 'mousedown') return event.button === 0;
          if (event.type === 'touchstart') return true;

          return true;
        })
        .on('zoom', onZoom);

      svgElement.call(zoomBehavior);

      svgElement.on('click', (event) => {
        if (event.target.tagName === 'svg') {
          clearNeighborhoodFilter({ notify: true });
          clearSelection({ notify: true });
          clearHoverState();
          callbacks.onBackgroundClick?.();
        }
      });

      svgElement.on('mouseleave', () => {
        clearHoverState();
      });
    } else {
      zoomBehavior = null;
    }

    applyPresentationState({ animate: false });
    applyDimming();
    refreshPathStrokes(1);
    callbacks.onZoomChange?.({ k: 1 });
  }

  function setFocus(mode) {
    currentFocus = mode;
    ensureSelectionMatchesActiveFilters({ notify: true });
    applyDimming();
  }

  function setPresentationState(state, options = {}) {
    var nextState = state || 'interactive';
    /* No-op short-circuit. Same state arriving back-to-back used to
     * cancel in-flight transitions and produce visible flicker. */
    if (nextState === presentationState && options.animate !== false) return;
    previousPresentationState = presentationState;
    presentationState = nextState;
    applyPresentationState(options);
  }

  function jumpToNeighborhood(name) {
    if (!svgElement || !pathGenerator || !zoomBehavior || !geoData) return;

    const features = geoData.features.filter((feature) => feature.properties.neighborhood === name);
    if (features.length === 0) return;

    const bounds = pathGenerator.bounds({ type: 'FeatureCollection', features });
    const [[x0, y0], [x1, y1]] = bounds;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scale = Math.min(10, 0.6 / Math.max((x1 - x0 || 1) / width, (y1 - y0 || 1) / height));

    svgElement
      .transition()
      .duration(700)
      .ease(d3.easeCubicInOut)
      .call(
        zoomBehavior.transform,
        d3.zoomIdentity
          .translate(width / 2, height / 2)
          .scale(scale)
          .translate(-(x0 + x1) / 2, -(y0 + y1) / 2)
      );

    setNeighborhoodFilter(name, { notify: true });
    clearSelection({ notify: true });
    clearHoverState();
  }

  function resetZoom() {
    if (!svgElement || !zoomBehavior) return;

    svgElement
      .transition()
      .duration(500)
      .ease(d3.easeCubicInOut)
      .call(zoomBehavior.transform, d3.zoomIdentity);

    clearNeighborhoodFilter({ notify: true });
    clearSelection({ notify: true });
    clearHoverState();
  }

  function resize() {
    if (!geoData) return;
    clearHoverState({ notify: false });
    buildMap();
  }

  function init({ containerEl, data, metricRanges, interactive = true, initialPresentationState = 'interactive' }) {
    container = containerEl;
    geoData = data;
    ranges = metricRanges;
    allowInteraction = interactive;
    presentationState = initialPresentationState;
    /* Both states set so the bloom branch sees a stable previous state
     * on the first user-driven transition rather than a stale default. */
    previousPresentationState = initialPresentationState;
    buildMap();
  }

  function destroy() {
    if (leaveTimer) clearTimeout(leaveTimer);
    leaveTimer = null;
    clearFlipPulseTimer();
    pendingPointerDown = null;
    removePolicyAnnotations();

    if (svgElement) {
      svgElement.on('.zoom', null);
      svgElement.on('click', null);
      svgElement.on('mouseleave', null);
    }

    if (container) d3.select(container).html('');

    svgElement = null;
    mapGroup = null;
    tractPaths = null;
    pathGenerator = null;
    zoomBehavior = null;
    neighborhoodLabels = null;
    tractIdLabels = null;
    hoveredPath = null;
    hoveredClass = null;
    selectedPath = null;
    selectedGeoid = null;
  }

  return {
    init,
    setFocus,
    setPresentationState,
    jumpToNeighborhood,
    resetZoom,
    resize,
    destroy,
    clearHover: clearHoverState,
    setNeighborhoodFilter
  };
}
