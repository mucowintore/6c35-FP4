import * as d3 from 'd3';

export const HOLD_RAMP = ['#E2ECF4', '#8AAEC8', '#3E6B94', '#1B3A5C', '#0E1F33'];
export const FLIP_RAMP = ['#FDF4E6', '#F0D4A4', '#D8A45A', '#C68B3C', '#7A5020'];

export const COLORS = {
  navy: '#1B3A5C',
  navyDark: '#0E1F33',
  amber: '#C68B3C',
  amberDark: '#7A5020',
  neutral: '#B0A898',
  lowDataFill: '#FFFFFF',
  lowDataStroke: '#BDB8AD'
};

export const METRIC_KEYS = [
  'median_price',
  'investor_share',
  'flip_rate',
  'condo_share',
  'r23_share',
  'pct_nonwhite',
  'r_mhi',
  'hold_score',
  'flip_score'
];

export const DEFAULT_CONTEXT =
  'Hover a tract to see which policy intervention fits local speculative pressure and why.';

export function formatDollars(v) {
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
  return '$' + d3.format(',.0f')(v);
}

export function formatPercent(v) {
  return (v * 100).toFixed(1) + '%';
}

export function formatScore(v) {
  return v != null ? v.toFixed(1) : '\u2014';
}

export function isLowDataTract(props) {
  if (!props) return true;
  return props.sales == null || props.sales < 250;
}

export function tractStrokeFromDominant(dominant) {
  if (dominant === 'holding') return '#14304C';
  if (dominant === 'flipping') return '#A8722C';
  return '#9E988E';
}

export function accentColorFromDominant(dominant) {
  if (dominant === 'holding') return COLORS.navyDark;
  if (dominant === 'flipping') return COLORS.amberDark;
  return '#5A5650';
}

export function buildTooltipModel(props) {
  if (isLowDataTract(props)) {
    return {
      className: 'tip-low',
      html: 'Insufficient data (&lt;250 sales).'
    };
  }

  const priceStr = formatDollars(props.median_price);
  const className =
    props.dominant === 'holding' ? 'tip-hold' : props.dominant === 'flipping' ? 'tip-flip' : 'tip-mixed';

  return {
    className,
    html: `<b>${props.neighborhood || 'Tract'}</b>
    <span class="tip-stats">${priceStr} median | ${(props.investor_share * 100).toFixed(0)}% investors | ${(props.flip_rate * 100).toFixed(0)}% flipped</span>`
  };
}

export function buildHoverContextHtml(props) {
  if (isLowDataTract(props)) {
    return 'Insufficient data (&lt;250 sales).';
  }

  const nh = props.neighborhood || 'Tract';

  if (props.dominant === 'holding') {
    return `<span class="ctx-hold">${nh}</span>: Holding zone. Investors buy at <b>${formatDollars(
      props.median_price
    )}</b> and sit. <b>${(props.condo_share * 100).toFixed(0)}%</b> condos.`;
  }

  if (props.dominant === 'flipping') {
    return `<span class="ctx-flip">${nh}</span>: Flipping zone. <b>${(props.flip_rate * 100).toFixed(
      0
    )}%</b> flip rate; <b>${(props.pct_nonwhite * 100).toFixed(0)}%</b> non-white.`;
  }

  return `<b>${nh}</b>: Mixed tract. Both strategies are present here.`;
}
