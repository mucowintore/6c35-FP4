<script>
  import * as d3 from 'd3';
  import { onMount, tick } from 'svelte';

  let data = [];
  let svgEl;
  let wrapperEl;

  let selectedNeighborhoods = ['Dorchester', 'Roxbury'];
  let selectedMetric = 'investor_share';

  const metrics = [
    { key: 'investor_share', label: 'Investor share', format: d3.format('.0%') },
    { key: 'flip_rate', label: 'Flip rate', format: d3.format('.1%') },
    { key: 'price_premium', label: 'Investor price premium', format: d3.format('+.0%') }
  ];

  $: neighborhoods = Array.from(new Set(data.map(d => d.neighborhood))).sort();
  $: activeMetric = metrics.find(m => m.key === selectedMetric) ?? metrics[0];
  $: filteredData = data.filter(d => selectedNeighborhoods.includes(d.neighborhood));

  async function loadTimelineData() {
    try {
      data = await d3.json('/data/neighborhood_temporal_metrics.json');
      await tick();
      drawChart();
    } catch (err) {
      console.warn('Timeline data not loaded yet:', err);
      data = [];
    }
  }

  function toggleNeighborhood(name) {
    if (selectedNeighborhoods.includes(name)) {
      selectedNeighborhoods = selectedNeighborhoods.filter(n => n !== name);
    } else {
      selectedNeighborhoods = [...selectedNeighborhoods, name];
    }
  }

  function drawChart() {
    if (!svgEl || !wrapperEl || filteredData.length === 0) return;

    const width = wrapperEl.clientWidth;
    const height = 420;
    const margin = { top: 28, right: 32, bottom: 48, left: 64 };

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const x = d3.scaleLinear()
      .domain(d3.extent(data, d => d.year))
      .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
      .domain(d3.extent(filteredData, d => d[selectedMetric]))
      .nice()
      .range([height - margin.bottom, margin.top]);

    const color = d3.scaleOrdinal()
      .domain(selectedNeighborhoods)
      .range(['var(--navy)', 'var(--amber)', 'var(--navy-mid)', 'var(--amber-dark)', 'var(--neutral)']);

    const line = d3.line()
      .x(d => x(d.year))
      .y(d => y(d[selectedMetric]))
      .defined(d => d[selectedMetric] != null);

    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).tickFormat(d3.format('d')));

    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).tickFormat(activeMetric.format));

    svg.append('line')
      .attr('x1', x(2008))
      .attr('x2', x(2008))
      .attr('y1', margin.top)
      .attr('y2', height - margin.bottom)
      .attr('stroke', 'var(--faint)')
      .attr('stroke-dasharray', '4 4');

    svg.append('text')
      .attr('x', x(2008) + 6)
      .attr('y', margin.top + 12)
      .attr('fill', 'var(--sub)')
      .attr('font-size', 11)
      .text('2008 crisis');

    const grouped = d3.group(filteredData, d => d.neighborhood);

    for (const [neighborhood, values] of grouped) {
      const sorted = values.slice().sort((a, b) => a.year - b.year);

      const path = svg.append('path')
        .datum(sorted)
        .attr('fill', 'none')
        .attr('stroke', color(neighborhood))
        .attr('stroke-width', 3)
        .attr('d', line);

      const length = path.node().getTotalLength();

      path
        .attr('stroke-dasharray', `${length} ${length}`)
        .attr('stroke-dashoffset', length)
        .transition()
        .duration(900)
        .ease(d3.easeCubicOut)
        .attr('stroke-dashoffset', 0);

      const last = sorted[sorted.length - 1];

      svg.append('text')
        .attr('x', x(last.year) + 6)
        .attr('y', y(last[selectedMetric]))
        .attr('fill', color(neighborhood))
        .attr('font-size', 12)
        .attr('font-weight', 700)
        .text(neighborhood);
    }
  }

  onMount(() => {
    loadTimelineData();
    window.addEventListener('resize', drawChart);

    return () => window.removeEventListener('resize', drawChart);
  });

  $: if (data.length > 0) {
    tick().then(drawChart);
  }
</script>

<section class="timeline-panel" bind:this={wrapperEl}>
  <div class="timeline-header">
    <div>
      <h2>Compare neighborhood trajectories</h2>
      <p>
        Select neighborhoods and a metric to see whether investor activity followed similar paths
        or diverged over time.
      </p>
    </div>
  </div>

  <div class="timeline-controls">
    <div class="metric-buttons">
      {#each metrics as metric}
        <button
          class:active={selectedMetric === metric.key}
          on:click={() => selectedMetric = metric.key}
        >
          {metric.label}
        </button>
      {/each}
    </div>

    <div class="neighborhood-buttons">
      {#each neighborhoods as neighborhood}
        <button
          class:active={selectedNeighborhoods.includes(neighborhood)}
          on:click={() => toggleNeighborhood(neighborhood)}
        >
          {neighborhood}
        </button>
      {/each}
    </div>
  </div>

  {#if data.length === 0}
    <div class="timeline-empty">
      Temporal data file not found yet. Add
      <code>static/data/neighborhood_temporal_metrics.json</code>.
    </div>
  {:else}
    <svg bind:this={svgEl} class="timeline-chart"></svg>
  {/if}
</section>