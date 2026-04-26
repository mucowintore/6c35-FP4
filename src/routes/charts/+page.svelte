<script>
  import TimeSeriesChart from '$lib/components/TimeSeriesChart.svelte';
  import PriceWedgeChart from '$lib/components/PriceWedgeChart.svelte';
</script>

<div style="max-width: 600px; margin: 40px auto; font-family: Plus Jakarta Sans, sans-serif;">
  <h2 style="margin-bottom: 8px;">Section 1: The Regime Shift</h2>
  <p style="color: #6A665E; margin-bottom: 20px;">Investor share of Boston home purchases, 2000–2022</p>
  <TimeSeriesChart width={560} height={320} />

  <h2 style="margin-top: 48px; margin-bottom: 8px;">Section 3: The Price Wedge</h2>
  <p style="color: #6A665E; margin-bottom: 20px;">Investor price premium vs. non-investors (%)</p>
  <PriceWedgeChart width={560} height={320} />
</div>
