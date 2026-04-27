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
    var p = feature.properties;

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

  function applyPresentationState(options) {
    options = options || {};
    if (!tractPaths) return;

    var animate = options.animate !== false;
    if (!allowInteraction || presentationState !== 'interactive') {
      tractPaths.classed('dimmed', false);
    }

    var pointerVal = allowInteraction ? 'auto' : 'none';

    /*
     * Staggered bloom when transitioning from gray to classified.
     * Holding tracts appear first, then mixed, then flipping, creating
     * a two-beat reveal that mirrors the narrative structure.
     */
    if (animate && previousPresentationState === 'gray' && presentationState === 'classified') {

      tractPaths.filter(function(f) { return f.properties.dominant === 'holding'; })
        .transition().duration(1200).ease(d3.easeCubicInOut)
        .attr('fill', tractFill).attr('opacity', tractOpacity)
        .attr('pointer-events', pointerVal);

      tractPaths.filter(function(f) {
        return f.properties.dominant !== 'holding' && f.properties.dominant !== 'flipping';
      })
        .transition().delay(300).duration(1000).ease(d3.easeCubicInOut)
        .attr('fill', tractFill).attr('opacity', tractOpacity)
        .attr('pointer-events', pointerVal);

      tractPaths.filter(function(f) { return f.properties.dominant === 'flipping'; })
        .transition().delay(500).duration(1000).ease(d3.easeCubicInOut)
        .attr('fill', tractFill).attr('opacity', tractOpacity)
        .attr('pointer-events', pointerVal);

      refreshPathStrokes();
      return;
    }

    /* standard transition for all other state changes */
    var target = animate
      ? tractPaths.transition().duration(800).ease(d3.easeCubicInOut)
      : tractPaths;

    target
      .attr('fill', tractFill)
      .attr('opacity', tractOpacity)
      .attr('pointer-events', pointerVal);

    refreshPathStrokes();
  }

  function applyDimming() {
    if (!tractPaths) return;
    if (!allowInteraction || presentationState !== 'interactive') return;

    tractPaths.classed('dimmed', function(feature) {
      var props = feature.properties;
      var thisClass = tractClassFromProps(props);
      var isSelected = Boolean(selectedGeoid && props.geoid === selectedGeoid);
      var dimByNeighborhood = false;
      var dimByFocus = false;
      var dimByLowDataFocus = false;
      var dimByHoverContext = false;

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

      var dimByFilters = dimByNeighborhood || dimByFocus || dimByLowDataFocus;

      /* keep selected tract visible during contextual hover dimming */
      if (isSelected && !dimByFilters) return false;

      return dimByFilters || dimByHoverContext;
    });
  }

  function selectedProps() {
    if (selectedPath) {
      var datum = d3.select(selectedPath).datum();
      if (datum?.properties?.geoid === selectedGeoid) return datum.properties;
    }

    if (!selectedGeoid || !geoData?.features) return null;
    var feature = geoData.features.find(function(entry) { return entry.properties?.geoid === selectedGeoid; });
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

  function ensureSelectionMatchesActiveFilters(options) {
    var notify = (options || {}).notify !== false;
    if (!selectedGeoid) return;

    var props = selectedProps();
    if (!props || !tractMatchesActiveFilters(props)) {
      clearSelection({ notify: notify });
    }
  }

  function matchesCurrentStrategyFilter(props) {
    if (currentFocus === 'all') return true;

    if (currentFocus === 'hold') return props?.dominant === 'holding';
    if (currentFocus === 'flip') return props?.dominant === 'flipping';
    if (currentFocus === 'mixed') return props?.dominant === 'mixed';

    return true;
  }

  function setNeighborhoodFilter(name, options) {
    var notify = (options || {}).notify !== false;
    selectedNeighborhood = name || null;
    ensureSelectionMatchesActiveFilters({ notify: notify });
    applyDimming();
    if (notify) callbacks.onNeighborhoodChange?.({ name: selectedNeighborhood });
  }

  function clearNeighborhoodFilter(options) {
    var notify = (options || {}).notify !== false;
    if (!selectedNeighborhood) return;
    setNeighborhoodFilter(null, { notify: notify });
  }

  function onZoom(event) {
    mapGroup.attr('transform', event.transform);
    var k = event.transform.k;
    if (tractPaths) {
      refreshPathStrokes(k);
    }

    if (neighborhoodLabels) {
      neighborhoodLabels.attr('opacity', k > 2 ? Math.min(0.24, 0.12 * (k - 2)) : 0);
    }

    if (tractIdLabels) {
      tractIdLabels.attr('opacity', k > 5 ? Math.min(0.4, 0.13 * (k - 5)) : 0);
    }

    callbacks.onZoomChange?.({ k: k });
  }

  function baseStrokeWidth(k) {
    return Math.max(0.15, 0.5 / k);
  }

  function emphasisStrokeWidth(k) {
    return HOVER_STROKE_WIDTH / k;
  }

  function applyPathStroke(pathNode, k) {
    var node = d3.select(pathNode);
    var datum = node.datum();
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

  function refreshPathStrokes(explicitK) {
    if (!svgElement || !tractPaths) return;
    var k = explicitK ?? d3.zoomTransform(svgElement.node()).k;

    tractPaths.each(function() {
      applyPathStroke(this, k);
    });

    if (hoveredPath && hoveredPath.parentNode) hoveredPath.parentNode.appendChild(hoveredPath);
    if (selectedPath && selectedPath.parentNode) selectedPath.parentNode.appendChild(selectedPath);
  }

  function selectPath(pathNode, feature, options) {
    var notify = (options || {}).notify !== false;
    selectedPath = pathNode || null;
    selectedGeoid = feature?.properties?.geoid ?? null;
    refreshPathStrokes();
    if (notify && feature) callbacks.onSelect?.({ feature: feature });
  }

  function clearSelection(options) {
    var notify = (options || {}).notify !== false;
    if (!selectedPath && !selectedGeoid) return;
    selectedPath = null;
    selectedGeoid = null;
    refreshPathStrokes();
    if (notify) callbacks.onSelectClear?.();
  }

  function clearHoverState(options) {
    var notify = (options || {}).notify !== false;

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

    var props = feature.properties;
    hoveredPath = this;
    hoveredClass = isLowDataTract(props) ? null : tractClassFromProps(props);
    applyDimming();
    refreshPathStrokes();

    callbacks.onHover?.({ feature: feature, event: event });
    callbacks.onTooltipShow?.({ feature: feature, event: event });
  }

  function handleMouseMove(event, feature) {
    callbacks.onHoverMove?.({ feature: feature, event: event });
    callbacks.onTooltipMove?.({ event: event });
  }

  function handleMouseLeave(_event, _feature) {
    if (!svgElement) return;
    if (hoveredPath === this) hoveredPath = null;
    if (leaveTimer) {
      clearTimeout(leaveTimer);
      leaveTimer = null;
    }

    leaveTimer = setTimeout(function() {
      clearHoverState();
    }, 50);
  }

  function toggleSelection(pathNode, feature) {
    if (leaveTimer) {
      clearTimeout(leaveTimer);
      leaveTimer = null;
    }

    var props = feature.properties;

    /*
     * If the user clicks a tract outside the active strategy filter,
     * reset the filter so the click acts as an easy exit action.
     */
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
    var samePath = pendingPointerDown.pathNode === this;
    var samePointer = pendingPointerDown.pointerId === event.pointerId;
    if (!samePath || !samePointer) {
      clearPendingPointerDown();
      return;
    }

    var dx = event.clientX - pendingPointerDown.x;
    var dy = event.clientY - pendingPointerDown.y;
    clearPendingPointerDown();

    var movement = Math.hypot(dx, dy);
    if (movement > 6) return;

    toggleSelection(this, feature);
  }

  function buildMap() {
    if (!container || !geoData || !ranges) return;

    var width = container.clientWidth;
    var height = container.clientHeight;

    d3.select(container).html('');
    hoveredPath = null;
    hoveredClass = null;
    pendingPointerDown = null;
    if (leaveTimer) {
      clearTimeout(leaveTimer);
      leaveTimer = null;
    }

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

    var projection = d3.geoMercator().fitSize([width * 0.98, height * 0.98], geoData);
    var projectionTranslate = projection.translate();
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
      .attr('stroke', function(d) { return tractStrokeFromProps(d.properties); })
      .attr('stroke-width', 0.5)
      .attr('pointer-events', allowInteraction ? 'auto' : 'none');

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
      selectedPath = tractPaths.filter(function(d) { return d.properties.geoid === selectedGeoid; }).node() || null;
      if (!selectedPath) selectedGeoid = null;
    } else {
      selectedPath = null;
    }

    var neighborhoodCentroids = {};

    geoData.features.forEach(function(feature) {
      var name = feature.properties.neighborhood;
      if (!name) return;

      var centroid = pathGenerator.centroid(feature);
      if (!centroid || Number.isNaN(centroid[0])) return;

      if (!neighborhoodCentroids[name]) neighborhoodCentroids[name] = { xs: [], ys: [], name: name };

      neighborhoodCentroids[name].xs.push(centroid[0]);
      neighborhoodCentroids[name].ys.push(centroid[1]);
    });

    var labelData = Object.values(neighborhoodCentroids)
      .filter(function(nh) { return LABEL_NEIGHBORHOODS.includes(nh.name); })
      .map(function(nh) {
        return {
          name: SHORT_NAMES[nh.name] || nh.name,
          x: d3.mean(nh.xs),
          y: d3.mean(nh.ys)
        };
      });

    neighborhoodLabels = mapGroup
      .selectAll('.neighborhood-label')
      .data(labelData)
      .join('text')
      .attr('class', 'neighborhood-label')
      .attr('x', function(d) { return d.x; })
      .attr('y', function(d) { return d.y; })
      .attr('font-size', '9px')
      .attr('opacity', 0)
      .text(function(d) { return d.name; });

    var idData = geoData.features
      .map(function(feature) {
        var centroid = pathGenerator.centroid(feature);
        return {
          id: feature.properties.geoid ? feature.properties.geoid.slice(-4) : '',
          x: centroid[0],
          y: centroid[1]
        };
      })
      .filter(function(entry) { return !Number.isNaN(entry.x); });

    tractIdLabels = mapGroup
      .selectAll('.tract-id-label')
      .data(idData)
      .join('text')
      .attr('class', 'tract-id-label')
      .attr('x', function(d) { return d.x; })
      .attr('y', function(d) { return d.y; })
      .attr('font-size', '6px')
      .attr('opacity', 0)
      .text(function(d) { return d.id; });

    if (allowInteraction) {
      zoomBehavior = d3
        .zoom()
        .scaleExtent([1, 16])
        .clickDistance(8)
        .tapDistance(12)
        .filter(function(event) {
          var target = event.target;
          var isTract = target?.classList?.contains('tract');

          if (event.type === 'wheel') return true;
          if (isTract) return false;

          if (event.type === 'mousedown') return event.button === 0;
          if (event.type === 'touchstart') return true;

          return true;
        })
        .on('zoom', onZoom);

      svgElement.call(zoomBehavior);

      svgElement.on('click', function(event) {
        if (event.target.tagName === 'svg') {
          clearNeighborhoodFilter({ notify: true });
          clearSelection({ notify: true });
          clearHoverState();
          callbacks.onBackgroundClick?.();
        }
      });

      svgElement.on('mouseleave', function() {
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

  function setPresentationState(state, options) {
    previousPresentationState = presentationState;
    presentationState = state || 'interactive';
    applyPresentationState(options);
  }

  function jumpToNeighborhood(name) {
    if (!svgElement || !pathGenerator || !zoomBehavior || !geoData) return;

    var features = geoData.features.filter(function(feature) { return feature.properties.neighborhood === name; });
    if (features.length === 0) return;

    var bounds = pathGenerator.bounds({ type: 'FeatureCollection', features: features });
    var x0 = bounds[0][0], y0 = bounds[0][1], x1 = bounds[1][0], y1 = bounds[1][1];

    var width = container.clientWidth;
    var height = container.clientHeight;

    var scale = Math.min(10, 0.6 / Math.max((x1 - x0 || 1) / width, (y1 - y0 || 1) / height));

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

  function init(config) {
    container = config.containerEl;
    geoData = config.data;
    ranges = config.metricRanges;
    allowInteraction = config.interactive !== false;
    presentationState = config.initialPresentationState || 'interactive';
    buildMap();
  }

  function destroy() {
    if (leaveTimer) clearTimeout(leaveTimer);
    leaveTimer = null;
    pendingPointerDown = null;

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
    init: init,
    setFocus: setFocus,
    setPresentationState: setPresentationState,
    jumpToNeighborhood: jumpToNeighborhood,
    resetZoom: resetZoom,
    resize: resize,
    destroy: destroy,
    clearHover: clearHoverState,
    setNeighborhoodFilter: setNeighborhoodFilter
  };
}
