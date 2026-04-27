import * as d3 from 'd3';
import { METRIC_KEYS, isLowDataTract } from '$lib/formatters';

export async function loadTractProfileData() {
  const data = await d3.json('data/fp2_boston_tract_profiles.geojson');

  let holdCount = 0;
  let flipCount = 0;
  let mixedCount = 0;
  let lowDataCount = 0;
  const metricRanges = {};

  data.features.forEach((feature) => {
    const props = feature.properties;

    if (isLowDataTract(props)) {
      lowDataCount += 1;
      return;
    }

    if (props.dominant === 'holding') holdCount += 1;
    else if (props.dominant === 'flipping') flipCount += 1;
    else mixedCount += 1;

    for (const key of METRIC_KEYS) {
      const value = props[key];
      if (value == null || !Number.isFinite(value)) continue;

      if (!metricRanges[key]) metricRanges[key] = { min: Infinity, max: -Infinity };

      metricRanges[key].min = Math.min(metricRanges[key].min, value);
      metricRanges[key].max = Math.max(metricRanges[key].max, value);
    }
  });

  const validFeatures = data.features.filter((feature) => !isLowDataTract(feature.properties));
  const cityAverages = {};

  for (const key of METRIC_KEYS) {
    const values = validFeatures
      .map((feature) => feature.properties[key])
      .filter((value) => value != null && Number.isFinite(value));
    cityAverages[key] = d3.mean(values);
  }

  const holdFeatures = validFeatures.filter((feature) => feature.properties.dominant === 'holding');
  const flipFeatures = validFeatures.filter((feature) => feature.properties.dominant === 'flipping');
  const holdingAverages = {};
  const flippingAverages = {};

  for (const key of METRIC_KEYS) {
    const hVals = holdFeatures
      .map((feature) => feature.properties[key])
      .filter((value) => value != null && Number.isFinite(value));
    const fVals = flipFeatures
      .map((feature) => feature.properties[key])
      .filter((value) => value != null && Number.isFinite(value));
    holdingAverages[key] = d3.mean(hVals);
    flippingAverages[key] = d3.mean(fVals);
  }

  return {
    geoData: data,
    ranges: metricRanges,
    cityAverages,
    holdingAverages,
    flippingAverages,
    counts: { holdCount, flipCount, mixedCount, lowDataCount }
  };
}
