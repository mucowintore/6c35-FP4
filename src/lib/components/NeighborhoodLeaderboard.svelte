<script>
  import { isLowDataTract } from '$lib/formatters';

  export let geoData = null;

  const TOP_N = 5;

  function formatScore(v) {
    if (!Number.isFinite(v)) return '\u2014';
    return v >= 0 ? '+' + v.toFixed(2) : v.toFixed(2);
  }

  function byPattern(data, dominant, scoreKey) {
    if (!data?.features?.length) return [];

    var grouped = new Map();
    data.features.forEach(function (feature) {
      var props = feature?.properties || {};
      if (isLowDataTract(props)) return;
      if (props.dominant !== dominant) return;

      var score = Number(props[scoreKey]);
      if (!Number.isFinite(score)) return;

      var neighborhood = props.neighborhood || 'Unknown';
      var row = grouped.get(neighborhood) || {
        neighborhood: neighborhood,
        tracts: 0,
        scoreSum: 0
      };
      row.tracts += 1;
      row.scoreSum += score;
      grouped.set(neighborhood, row);
    });

    return Array.from(grouped.values())
      .map(function (row) {
        return {
          neighborhood: row.neighborhood,
          tracts: row.tracts,
          meanScore: row.scoreSum / row.tracts
        };
      })
      .sort(function (a, b) {
        if (b.meanScore !== a.meanScore) return b.meanScore - a.meanScore;
        if (b.tracts !== a.tracts) return b.tracts - a.tracts;
        return a.neighborhood.localeCompare(b.neighborhood);
      })
      .slice(0, TOP_N);
  }

  $: holdRows = byPattern(geoData, 'holding', 'hold_score');
  $: flipRows = byPattern(geoData, 'flipping', 'flip_score');
  $: hasRows = holdRows.length > 0 || flipRows.length > 0;
</script>

<div class="leaderboard-shell" role="region" aria-label="Neighborhood leaderboard by speculation pattern">
  <header class="lb-head">
    <h4 class="lb-title">Top Neighborhood Pressure by Pattern</h4>
    <p class="lb-subtitle">Top 5 by average dominant tract score</p>
  </header>

  {#if hasRows}
    <div class="lb-grid">
      <section class="lb-card lb-hold" aria-label="Holding leaderboard">
        <div class="lb-card-head">
          <p class="lb-card-kicker">Holding</p>
          <p class="lb-card-sub">Navy zones</p>
        </div>
        <ol class="lb-list">
          {#each holdRows as row, i}
            <li class="lb-row">
              <span class="lb-rank">{i + 1}</span>
              <div class="lb-copy">
                <p class="lb-name">{row.neighborhood}</p>
                <p class="lb-meta">{row.tracts} tract{row.tracts === 1 ? '' : 's'}</p>
              </div>
              <span class="lb-score">{formatScore(row.meanScore)}</span>
            </li>
          {/each}
        </ol>
      </section>

      <section class="lb-card lb-flip" aria-label="Flipping leaderboard">
        <div class="lb-card-head">
          <p class="lb-card-kicker">Flipping</p>
          <p class="lb-card-sub">Amber zones</p>
        </div>
        <ol class="lb-list">
          {#each flipRows as row, i}
            <li class="lb-row">
              <span class="lb-rank">{i + 1}</span>
              <div class="lb-copy">
                <p class="lb-name">{row.neighborhood}</p>
                <p class="lb-meta">{row.tracts} tract{row.tracts === 1 ? '' : 's'}</p>
              </div>
              <span class="lb-score">{formatScore(row.meanScore)}</span>
            </li>
          {/each}
        </ol>
      </section>
    </div>
    <p class="lb-interpretation">Each value is a neighborhood average
      across tracts with at least 250 sales: the
      <strong>Holding</strong> leaderboard uses mean
      <strong>hold score</strong>, while the
      <strong>Flipping</strong> leaderboard uses mean
      <strong>flip score</strong>. Neighborhoods are then ranked from
      highest to lowest, so larger positive values indicate stronger
      concentration of that pattern.</p>
  {:else}
    <div class="lb-empty">Leaderboard data is not available yet.</div>
  {/if}
</div>

<style>
  .leaderboard-shell {
    width: min(920px, 100%);
    margin: 0;
    background: #fff;
    border: 1px solid var(--rule);
    border-radius: 12px;
    box-shadow: 0 8px 28px rgba(25, 24, 22, 0.08);
    padding: 16px 16px 14px;
  }

  .lb-head {
    margin-bottom: 12px;
  }
  .lb-title {
    margin: 0;
    font-family: "DM Serif Display", Georgia, serif;
    font-size: 26px;
    font-weight: 400;
    line-height: 1.06;
    color: var(--ink);
    letter-spacing: -0.01em;
  }
  .lb-subtitle {
    margin: 4px 0 0;
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--sub);
  }

  .lb-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .lb-card {
    border: 1px solid var(--rule);
    border-radius: 10px;
    overflow: hidden;
    background: #fff;
  }
  .lb-card-head {
    padding: 10px 12px 9px;
    color: #fff;
  }
  .lb-hold .lb-card-head {
    background: var(--navy-mid-dark, #0E1F33);
  }
  .lb-flip .lb-card-head {
    background: var(--amber-mid-dark, #7A5020);
  }
  .lb-card-kicker {
    margin: 0;
    font-family: "DM Serif Display", Georgia, serif;
    font-size: 23px;
    line-height: 1.02;
    font-weight: 400;
  }
  .lb-card-sub {
    margin: 3px 0 0;
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    opacity: 0.88;
  }

  .lb-list {
    margin: 0;
    padding: 4px 0;
    list-style: none;
  }
  .lb-row {
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr) auto;
    align-items: center;
    gap: 9px;
    padding: 8px 10px;
    border-top: 1px solid var(--rule);
  }
  .lb-row:first-child {
    border-top: 0;
  }

  .lb-rank {
    width: 22px;
    height: 22px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: 11px;
    font-weight: 700;
  }
  .lb-hold .lb-rank {
    background: rgba(27, 58, 92, 0.12);
    color: var(--navy-dark, #0E1F33);
  }
  .lb-flip .lb-rank {
    background: rgba(198, 139, 60, 0.18);
    color: var(--amber-dark, #7A5020);
  }

  .lb-copy {
    min-width: 0;
  }
  .lb-name {
    margin: 0;
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: 13.5px;
    font-weight: 700;
    line-height: 1.26;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .lb-meta {
    margin: 1px 0 0;
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: 11px;
    line-height: 1.3;
    color: var(--sub);
  }

  .lb-score {
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: 13px;
    font-weight: 700;
  }
  .lb-hold .lb-score {
    color: var(--navy-dark, #0E1F33);
  }
  .lb-flip .lb-score {
    color: var(--amber-dark, #7A5020);
  }

  .lb-empty {
    border: 1px dashed var(--rule);
    border-radius: 10px;
    padding: 12px;
    color: var(--sub);
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: 13px;
  }
  .lb-interpretation {
    margin: 12px 2px 2px;
    color: var(--text);
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: 13px;
    line-height: 1.55;
  }
  .lb-interpretation strong {
    color: var(--ink);
    font-weight: 700;
  }

  @media (max-width: 980px) {
    .lb-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
