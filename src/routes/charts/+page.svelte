<script>
  import TimeSeriesChart from '$lib/components/TimeSeriesChart.svelte';
  import PriceWedgeChart from '$lib/components/PriceWedgeChart.svelte';
</script>

<div class="charts-test">
  <h2>Section 1: The Regime Shift</h2>
  <p class="chart-subtitle">Investor share of Boston home purchases, 2000 to 2022</p>
  <TimeSeriesChart width={560} height={320} />

  <h2 style="margin-top: 48px;">Section 3: The Price Wedge</h2>
  <p class="chart-subtitle">Investor price premium vs. non-investors (%)</p>
  <PriceWedgeChart width={560} height={320} />
</div>

<style>
  :global(html), :global(body) {
    overflow: auto !important;
    height: auto !important;
  }
  .charts-test {
    max-width: 620px;
    margin: 40px auto;
    padding: 20px;
    font-family: Plus Jakarta Sans, sans-serif;
  }
  h2 {
    margin-bottom: 4px;
    color: #191816;
  }
  .chart-subtitle {
    color: #6A665E;
    margin-bottom: 20px;
    font-size: 14px;
  }
</style>
