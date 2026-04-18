import * as d3 from 'd3';
import { COLORS, formatDollars, formatPercent, formatScore } from '$lib/formatters';

export function buildOverviewSections({ holdCount, flipCount }) {
  const overview = `
    <div class="overview-title">Two markets, one crisis</div>

    <div class="overview-text">
      Every colored shape on this map is a census tract in the City of Boston.
      We analyzed <b>180,000 residential sale transactions</b> recorded by the
      Metropolitan Area Planning Council (MAPC) between 2000 and 2022 to
      understand what the word "speculation" actually means in practice.
    </div>

    <div class="overview-text">
      What we found is that investors pursue <b>two fundamentally different
      strategies</b>, and those strategies concentrate in <b>two fundamentally
      different communities</b>.
    </div>

    <div class="overview-section-divider"></div>
    <div class="overview-title overview-section-title">How to read this map</div>

    <div class="overview-text">
      <b style="color: var(--navy)">Navy tracts</b> are <b>holding zones</b>.
      Investors here buy expensive condominiums and keep them as long-term
      financial assets. They pay a median of <b>49% more</b> than non-investors
      for comparable properties. Darker navy means more intense holding activity.
    </div>

    <div class="overview-text">
      <b style="color: var(--amber)">Amber tracts</b> are <b>flipping zones</b>.
      Investors here buy less expensive multi-family homes, renovate or convert
      them, and resell within months. They pay <b>6% less</b> than non-investors,
      targeting properties they can turn over quickly. Darker amber means more
      flipping.
    </div>

    <div class="overview-text">
      <b>Gray tracts</b> are <b>mixed</b>, meaning neither strategy clearly
      dominates (the score gap is less than 0.75 standard deviations).
    </div>

    <div class="stat-grid">
      <div class="stat-box">
        <div class="stat-value" style="color: var(--navy)">${holdCount}</div>
        <div class="stat-label">Holding-dominant tracts.
          Investors overpay by +49%.</div>
      </div>
      <div class="stat-box">
        <div class="stat-value" style="color: var(--amber)">${flipCount}</div>
        <div class="stat-label">Flipping-dominant tracts.
          Investors underpay by 6%.</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">87%</div>
        <div class="stat-label">Flipping tracts are non-white.
          The harm is racially concentrated.</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">$40K</div>
        <div class="stat-label">Median renter income in flipping
          tracts. Half the citywide average.</div>
      </div>
    </div>`;

  const howToExplore = `
    <div class="overview-title">How to explore</div>
    <div class="how-to">
      <b>Hover</b> any tract to see its full investor profile, a radar chart
      comparing it to the city average, and a contextual description. When you
      hover in the default "All tracts" view, the opposite type will fade out,
      revealing the geographic split between the two markets.
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
      (85.5% agreement) and Random Forest classification (F1 = 0.894).
    </div>

    <div class="overview-section-divider"></div>
    <div class="overview-title overview-section-title">About this project</div>
    <div class="overview-text">
      This interactive visualization is our proof of concept for
      6.C85 Interactive Data Visualization &amp; Society (Spring 2026).
      In FP4, we plan to wrap this map in a scrollytelling narrative
      showing how investor patterns evolved between 2000 and 2022,
      with embedded time-series charts, an East Boston case study,
      and a policy scenario explorer.
    </div>

    <div class="source-credit">
      Data: MAPC Residential Sales Transactions 2000&ndash;2022,
      American Community Survey 5-Year Estimates.
      173 census tracts with &ge;250 recorded sales each.<br>
      Joseph Firmansyah, Jessica Shoemaker, Jean-Michel Mucowintore
    </div>`;

  return { overview, howToExplore, about };
}

export function buildDetailModel(props) {
  const neighborhood = props.neighborhood || 'Unknown';
  const dominant = props.dominant;

  const accent = dominant === 'holding' ? COLORS.navy : dominant === 'flipping' ? COLORS.amber : '#6A665E';
  const barColor = dominant === 'holding' ? '#3E6B94' : dominant === 'flipping' ? '#D8A45A' : '#B0A898';
  const tagLabel = dominant === 'holding' ? 'Holding-dominant' : dominant === 'flipping' ? 'Flipping-dominant' : 'Mixed';
  const tagBg = dominant === 'holding' ? '#E2ECF4' : dominant === 'flipping' ? '#FDF4E6' : '#ECEAE2';

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
      Investors in this tract buy below market, renovate or convert
      multi-family homes, and resell within months. The flip rate is
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
    neighborhood,
    accent,
    barColor,
    tagLabel,
    tagBg,
    contextText,
    policyName,
    policyDesc
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
  const pct = range ? Math.max(0, Math.min(100, ((value - range.min) / (range.max - range.min)) * 100)) : 50;

  const avg = cityAverages[key];
  let tickHtml = '';

  if (range && avg != null) {
    const avgPct = ((avg - range.min) / (range.max - range.min)) * 100;
    tickHtml = `<div class="metric-avg-tick" style="left: ${avgPct.toFixed(1)}%"
                     title="City average: ${formatter(avg)}"></div>`;
  }

  return `<div>
    <div class="metric-name">${label}</div>
    <div class="metric-value">${formatter(value)}</div>
    <div class="metric-bar">
      <div class="metric-fill" style="width: ${pct.toFixed(1)}%;
           background: ${color}"></div>
      ${tickHtml}
    </div>
  </div>`;
}

export function drawRadarChart(container, props, ranges, cityAverages, accentCol) {
  if (!container) return;

  container.innerHTML = '';

  const metrics = [
    { key: 'investor_share', label: 'Investors' },
    { key: 'flip_rate', label: 'Flips' },
    { key: 'condo_share', label: 'Condos' },
    { key: 'r23_share', label: 'Multi-fam' },
    { key: 'pct_nonwhite', label: 'Non-white' },
    { key: 'median_price', label: 'Price' }
  ];

  const n = metrics.length;
  const w = 340;
  const h = 220;
  const cx = w / 2;
  const cy = h / 2 + 8;
  const radius = 76;
  const angleStep = (Math.PI * 2) / n;

  const tractVals = metrics.map((metric) => {
    const value = props[metric.key];
    const range = ranges[metric.key];
    if (value == null || !range || range.max === range.min) return 0.04;
    return Math.max(0.04, Math.min(1, (value - range.min) / (range.max - range.min)));
  });

  const avgVals = metrics.map((metric) => {
    const value = cityAverages[metric.key];
    const range = ranges[metric.key];
    if (value == null || !range || range.max === range.min) return 0.04;
    return Math.max(0.04, Math.min(1, (value - range.min) / (range.max - range.min)));
  });

  const svg = d3.select(container).append('svg').attr('width', w).attr('height', h);
  const g = svg.append('g').attr('transform', `translate(${cx}, ${cy})`);

  [0.25, 0.5, 0.75, 1].forEach((level) => {
    g.append('circle').attr('r', radius * level).attr('fill', 'none').attr('stroke', '#D6D2C8').attr('stroke-width', 0.5);
  });

  metrics.forEach((metric, i) => {
    const angle = angleStep * i - Math.PI / 2;

    g.append('line')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', Math.cos(angle) * radius)
      .attr('y2', Math.sin(angle) * radius)
      .attr('stroke', '#D6D2C8')
      .attr('stroke-width', 0.5);

    g.append('text')
      .attr('x', Math.cos(angle) * (radius + 18))
      .attr('y', Math.sin(angle) * (radius + 18))
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', '10px')
      .attr('fill', '#9C9890')
      .attr('font-family', 'Plus Jakarta Sans, sans-serif')
      .attr('font-weight', '600')
      .text(metric.label);
  });

  function toPoints(values) {
    return values.map((value, i) => {
      const angle = angleStep * i - Math.PI / 2;
      return [Math.cos(angle) * radius * value, Math.sin(angle) * radius * value];
    });
  }

  const avgPts = toPoints(avgVals);
  g.append('polygon')
    .attr('points', avgPts.map((point) => point.join(',')).join(' '))
    .attr('fill', 'none')
    .attr('stroke', '#B0A898')
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '3 2');

  const tractPts = toPoints(tractVals);

  g.append('polygon')
    .attr('points', tractPts.map((point) => point.join(',')).join(' '))
    .attr('fill', accentCol + '18')
    .attr('stroke', accentCol)
    .attr('stroke-width', 1.6);

  tractPts.forEach((point) => {
    g.append('circle')
      .attr('cx', point[0])
      .attr('cy', point[1])
      .attr('r', 3.2)
      .attr('fill', accentCol);
  });
}

export { formatDollars, formatPercent, formatScore };
