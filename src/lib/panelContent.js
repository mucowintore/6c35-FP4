import * as d3 from 'd3';
import { COLORS, formatDollars, formatPercent, formatScore } from '$lib/formatters';

const BAR_METRICS = [
  { key: 'median_price', label: 'Price' },
  { key: 'investor_share', label: 'Investors' },
  { key: 'flip_rate', label: 'Flip rate' },
  { key: 'condo_share', label: 'Condos' },
  { key: 'r23_share', label: 'Multi-family' },
  { key: 'pct_nonwhite', label: 'Non-white' }
];

const METRIC_EXPLANATIONS = {
  median_price: 'Median residential sale price, 2000\u20132022',
  investor_share: 'Purchases by LLC, trust, bank, or business entities',
  flip_rate: 'Properties bought and resold within two years',
  condo_share: 'Vehicle for long-term capital parking',
  r23_share: 'TOPA protections apply to multi-family buildings',
  pct_nonwhite: 'ACS 5-Year Estimates, Census 2020'
};

function fmtForKey(key) {
  return key === 'median_price' ? formatDollars : formatPercent;
}

/* Right panel content for the explorer.
 *
 * The reader has already walked the entire scrolly to get here, so
 * the overview tab is intentionally short. One sentence of welcome,
 * then four small tiles that double as a quick reference and as a
 * map preview affordance. Hovering a tile dims the map to highlight
 * that subset; this is wired in SidePanel via data-preview-kind. */
export function buildOverviewSections({ holdCount, flipCount }) {
  const overview = `
    <div class="explorer-welcome">
      Now it is your turn. Hover any tract to read its full investor
      profile. Click to lock the panel on that tract. The metrics
      below are how every tract earned its color.
    </div>

    <div class="overview-section-divider"></div>

    <div class="explorer-tile-grid" role="group"
         aria-label="Quick reference. Hover to preview each subset on the map.">
      <button class="explorer-tile explorer-tile-hold"
              data-preview-kind="hold"
              type="button">
        <span class="explorer-tile-num">${holdCount}</span>
        <span class="explorer-tile-label">Holding-dominant tracts.
          Investors overpay by +49%.</span>
      </button>
      <button class="explorer-tile explorer-tile-flip"
              data-preview-kind="flip"
              type="button">
        <span class="explorer-tile-num">${flipCount}</span>
        <span class="explorer-tile-label">Flipping-dominant tracts.
          During the crisis, they bought at 25% discounts.</span>
      </button>
      <button class="explorer-tile explorer-tile-flip"
              data-preview-kind="flip"
              type="button">
        <span class="explorer-tile-num">87<span class="explorer-tile-pct">%</span></span>
        <span class="explorer-tile-label">Flipping tracts that are
          non-white. The harm is racially concentrated.</span>
      </button>
      <button class="explorer-tile explorer-tile-flip"
              data-preview-kind="flip"
              type="button">
        <span class="explorer-tile-num">$40<span class="explorer-tile-pct">K</span></span>
        <span class="explorer-tile-label">Median renter income in
          flipping tracts. Half the citywide average.</span>
      </button>
    </div>

    <div class="explorer-tile-hint" aria-hidden="true">
      Hover a tile to preview that subset on the map.
    </div>`;

  const howToExplore = `
    <div class="overview-title">How to explore</div>
    <div class="how-to">
      <b>Hover</b> any tract to see its full investor profile, a diverging bar
      chart comparing it to the city average, and a contextual description. When
      you hover in the default "All tracts" view, the opposite type will fade
      out, revealing the geographic split between the two markets.
    </div>
    <div class="how-to">
      <b>Neighborhood buttons</b> on the left edge of the map zoom to key areas.
      Right below them, the <b>strategy filter</b> lets you switch between all,
      holding, flipping, and mixed tracts. Navy dots mark holding neighborhoods,
      amber dots mark flipping neighborhoods.
    </div>
    <div class="how-to">
      <b>Scroll</b> to zoom in. Neighborhood names appear at medium zoom. Census
      tract IDs appear at high zoom. Drag to pan.
    </div>`;

  const about = `
    <div class="overview-title">Classification method</div>
    <div class="overview-text">
      Each tract receives two composite scores. The hold score combines
      z-scores of median price, condo share, and top-decile investor
      presence. The flip score combines z-scores of flip rate, buy-side
      flip rate, and 2-3 family property share. A tract is classified
      when one score exceeds the other by more than 0.75 standard
      deviations. This threshold was validated with K-Means clustering
      (85.5% agreement) and Random Forest classification (F1&nbsp;=&nbsp;0.894).
    </div>

    <div class="overview-section-divider"></div>
    <div class="overview-title overview-section-title">About this project</div>
    <div class="overview-text">
      This project was developed with guidance and feedback from the
      <a href="https://www.mapc.org/" target="_blank"
         rel="noopener noreferrer">Metropolitan Area Planning
      Commission&nbsp;(MAPC)</a>.
    </div>

    <div class="source-credit">
      Data: MAPC Residential Sales Transactions 2000&ndash;2022,
      American Community Survey 5-Year Estimates, Census 2020.
      173 census tracts with &ge;250 recorded sales each.<br>
      Joseph Firmansyah, Jessica Shoemaker, Jean-Michel Mucowintore
    </div>`;

  return { overview, howToExplore, about };
}

export function buildDetailModel(props) {
  const neighborhood = props.neighborhood || 'Unknown';
  const dominant = props.dominant;

  const accent = dominant === 'holding' ? COLORS.navy
    : dominant === 'flipping' ? COLORS.amber : '#6A665E';
  const barColor = dominant === 'holding' ? '#3E6B94'
    : dominant === 'flipping' ? '#D8A45A' : '#B0A898';
  const tagLabel = dominant === 'holding' ? 'Holding-dominant'
    : dominant === 'flipping' ? 'Flipping-dominant' : 'Mixed';
  const tagBg = dominant === 'holding' ? '#E2ECF4'
    : dominant === 'flipping' ? '#FDF4E6' : '#ECEAE2';

  let contextText = '';
  if (dominant === 'holding') {
    contextText = `<b style="color: var(--navy)">Holding zone.</b>
      Investors in this tract buy properties at a premium and keep them
      as long-term financial assets. The housing stock is
      <b>${(props.condo_share * 100).toFixed(0)}%</b> condominiums, and
      <b>${(props.investor_share * 100).toFixed(0)}%</b> of all purchases
      are made by investors.`;
  } else if (dominant === 'flipping') {
    contextText = `<b style="color: var(--amber)">Flipping zone.</b>
      Investors in this tract buy multi-family homes, renovate or convert
      them, and resell within months. The flip rate is
      <b>${(props.flip_rate * 100).toFixed(0)}%</b>. The population is
      <b>${(props.pct_nonwhite * 100).toFixed(0)}%</b> non-white with
      a median renter income of <b>${formatDollars(props.r_mhi || 0)}</b>.`;
  } else {
    contextText = `<b>Mixed tract.</b> This area shows both holding and
      flipping activity without a clear dominant pattern. The hold score
      is ${formatScore(props.hold_score)} and the flip score is
      ${formatScore(props.flip_score)}. The gap is less than 0.75 standard
      deviations, so the tract is not classified as either type.`;
  }

  const policyName = props.policy_fit || 'Layered approach';
  let policyDesc = '';
  if (dominant === 'holding') {
    policyDesc = `A <b>transfer fee on high-value condominium sales</b>
      would capture a portion of speculative gains from luxury transactions
      and redirect those funds toward affordable housing production in the
      neighborhoods that need it most.`;
  } else if (dominant === 'flipping') {
    policyDesc = `The <b>Tenant Opportunity to Purchase Act (TOPA)</b> gives
      tenants in multi-family rental buildings the right of first refusal
      when their building is sold. Combined with an <b>anti-flip transfer
      fee</b> on properties resold within two years, these measures can slow
      the rapid turnover that drives displacement in communities like this one.
      Note: TOPA applies to multi-family rental properties, which make up
      <b>${(props.r23_share * 100).toFixed(0)}%</b> of the housing stock
      in this tract.`;
  } else {
    policyDesc = `Both transfer fees and tenant protections may be warranted
      here, calibrated to the relative intensity of each strategy.`;
  }

  return {
    neighborhood, accent, barColor, tagLabel, tagBg,
    contextText, policyName, policyDesc
  };
}

export function renderMetric(label, value, key, formatter, color, ranges, cityAverages) {
  if (value == null || !Number.isFinite(value) || (value === 0 && key === 'r_mhi')) {
    return `<div>
      <div class="metric-name">${label}</div>
      <div class="metric-value" style="color: var(--faint)">&mdash;</div>
    </div>`;
  }

  const range = ranges[key];
  const pct = range
    ? Math.max(0, Math.min(100, ((value - range.min) / (range.max - range.min)) * 100))
    : 50;

  const avg = cityAverages[key];
  let tickHtml = '';
  if (range && avg != null) {
    const avgPct = ((avg - range.min) / (range.max - range.min)) * 100;
    tickHtml = `<div class="metric-avg-tick" style="left: ${avgPct.toFixed(1)}%"
                     title="City average: ${formatter(avg)}"></div>`;
  }

  const explanation = METRIC_EXPLANATIONS[key] || '';
  const explainHtml = explanation
    ? `<div class="metric-explanation">${explanation}</div>` : '';

  return `<div>
    <div class="metric-name">${label}</div>
    <div class="metric-value">${formatter(value)}</div>
    <div class="metric-bar">
      <div class="metric-fill" style="width: ${pct.toFixed(1)}%;
           background: ${color}"></div>
      ${tickHtml}
    </div>
    ${explainHtml}
  </div>`;
}

/* Diverging bar chart: one tract vs city average */
export function drawDivergingBars(container, props, ranges, cityAverages, accentCol) {
  if (!container) return;
  container.innerHTML = '';

  var W = 396, rowH = 36, barH = 14;
  var ml = 76, mr = 54;
  var barW = W - ml - mr;
  var totalH = 8 + BAR_METRICS.length * rowH + 8;

  var svg = d3.select(container).append('svg')
    .attr('width', W).attr('height', totalH).style('max-width', '100%');

  for (var i = 0; i < BAR_METRICS.length; i++) {
    var metric = BAR_METRICS[i];
    var val = props[metric.key];
    var avg = cityAverages[metric.key];
    var rng = ranges[metric.key];

    if (val == null || avg == null || !rng || rng.max === rng.min) continue;

    var rowY = 8 + i * rowH;
    var barY = rowY + (rowH - barH) / 2;

    var scale = d3.scaleLinear().domain([rng.min, rng.max]).range([0, barW]);
    var cx = scale(avg);
    var clamped = Math.max(rng.min, Math.min(rng.max, val));
    var vx = scale(clamped);

    var bx = Math.min(cx, vx);
    var bw = Math.abs(vx - cx);

    /* gray track */
    svg.append('rect').attr('x', ml).attr('y', barY)
      .attr('width', barW).attr('height', barH)
      .attr('fill', '#ECEAE2').attr('rx', 2);

    /* colored bar */
    svg.append('rect')
      .attr('x', ml + bx).attr('y', barY)
      .attr('width', Math.max(1, bw)).attr('height', barH)
      .attr('fill', accentCol).attr('opacity', 0.75).attr('rx', 2);

    /* center line marks the city average */
    svg.append('line')
      .attr('x1', ml + cx).attr('x2', ml + cx)
      .attr('y1', barY - 4).attr('y2', barY + barH + 4)
      .attr('stroke', '#9C9890').attr('stroke-width', 1);

    /* metric label on the left */
    svg.append('text')
      .attr('x', ml - 8).attr('y', rowY + rowH / 2)
      .attr('text-anchor', 'end').attr('dominant-baseline', 'central')
      .attr('fill', '#9C9890').attr('font-size', '11px')
      .attr('font-family', 'Plus Jakarta Sans, sans-serif')
      .attr('font-weight', '600')
      .text(metric.label);

    /* tract value on the right */
    svg.append('text')
      .attr('x', ml + barW + 6).attr('y', rowY + rowH / 2)
      .attr('text-anchor', 'start').attr('dominant-baseline', 'central')
      .attr('fill', '#46433C').attr('font-size', '11px')
      .attr('font-family', 'IBM Plex Mono, monospace')
      .attr('font-weight', '500')
      .text(fmtForKey(metric.key)(val));
  }
}

/* Paired diverging bars: holding average vs flipping average */
export function drawPairedDivergingBars(container, holdAvg, flipAvg, ranges, cityAverages) {
  if (!container) return;
  container.innerHTML = '';

  var W = 396, rowH = 36, subH = 6, gap = 2;
  var ml = 76, mr = 54;
  var barW = W - ml - mr;
  var totalH = 8 + BAR_METRICS.length * rowH + 8;

  var svg = d3.select(container).append('svg')
    .attr('width', W).attr('height', totalH).style('max-width', '100%');

  for (var i = 0; i < BAR_METRICS.length; i++) {
    var metric = BAR_METRICS[i];
    var avg = cityAverages[metric.key];
    var rng = ranges[metric.key];
    var hVal = holdAvg[metric.key];
    var fVal = flipAvg[metric.key];

    if (avg == null || !rng || rng.max === rng.min) continue;

    var rowY = 8 + i * rowH;
    var blockH = subH + gap + subH;
    var barY = rowY + (rowH - blockH) / 2;

    var scale = d3.scaleLinear().domain([rng.min, rng.max]).range([0, barW]);
    var cx = scale(avg);

    /* gray track */
    svg.append('rect').attr('x', ml).attr('y', barY)
      .attr('width', barW).attr('height', blockH)
      .attr('fill', '#ECEAE2').attr('rx', 2);

    /* center line marks the city average */
    svg.append('line')
      .attr('x1', ml + cx).attr('x2', ml + cx)
      .attr('y1', barY - 3).attr('y2', barY + blockH + 3)
      .attr('stroke', '#9C9890').attr('stroke-width', 1);

    /* holding bar in navy */
    if (hVal != null) {
      var hx = scale(Math.max(rng.min, Math.min(rng.max, hVal)));
      svg.append('rect')
        .attr('x', ml + Math.min(cx, hx)).attr('y', barY)
        .attr('width', Math.max(1, Math.abs(hx - cx))).attr('height', subH)
        .attr('fill', COLORS.navy).attr('opacity', 0.8).attr('rx', 1);
    }

    /* flipping bar in amber */
    if (fVal != null) {
      var fx = scale(Math.max(rng.min, Math.min(rng.max, fVal)));
      svg.append('rect')
        .attr('x', ml + Math.min(cx, fx)).attr('y', barY + subH + gap)
        .attr('width', Math.max(1, Math.abs(fx - cx))).attr('height', subH)
        .attr('fill', COLORS.amber).attr('opacity', 0.8).attr('rx', 1);
    }

    /* metric label on the left */
    svg.append('text')
      .attr('x', ml - 8).attr('y', rowY + rowH / 2)
      .attr('text-anchor', 'end').attr('dominant-baseline', 'central')
      .attr('fill', '#9C9890').attr('font-size', '11px')
      .attr('font-family', 'Plus Jakarta Sans, sans-serif')
      .attr('font-weight', '600')
      .text(metric.label);
  }
}

export { formatDollars, formatPercent, formatScore };
