/* The narrative spine. Every section the reader passes through is
 * defined here. The fields drive layout, the active visualization
 * layer in StoryStage, and the state of the persistent map.
 *
 * Counter elements use data-count-target plus optional prefix, suffix,
 * duration, and delay attributes. StoryScroller animates them. */

export const NARRATIVE_SECTIONS = [

  /* 00 Opening. One city, two crises. */
  {
    id: 'opening',
    chapter: '00',
    label: '',
    title: '',
    theme: 'mixed',
    layout: 'fullscreen',
    viz: null,
    mapState: null,
    content: `
      <h1 class="hero-title">Boston. One city. Two crises</h1>

      <div class="hero-card-grid" role="group"
        aria-label="Two neighborhood examples of speculation">
        <article class="hero-card hero-card-flip">
          <h2 class="hero-card-title">Dorchester</h2>
          <p class="hero-card-body">Investors are far more likely to buy
            multi-family homes, renovate or convert them, and quickly
            resell them for profit.</p>
        </article>
        <article class="hero-card hero-card-hold">
          <h2 class="hero-card-title">Back Bay</h2>
          <p class="hero-card-body">Investors purchase expensive
            condominiums and hold them as long-term financial assets.</p>
        </article>
      </div>

      <div class="hero-text-block">
        <p class="hero-summary">These are both forms of speculation.
          But they affect neighborhoods differently, target different
          kinds of housing, and create different risks for the people
          who live there.</p>
        <p class="hero-question-lead">This project asks a simple question:</p>
        <p class="hero-question">What happens when we stop treating
          Boston's housing market as one single story?</p>
      </div>

      <div class="scroll-cue-wrap" aria-hidden="true">
        <svg class="scroll-cue-chevron" width="16" height="10"
          viewBox="0 0 16 10" fill="none">
          <path d="M1 1L8 8L15 1" stroke="currentColor"
            stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round"/>
        </svg>
      </div>
    `
  },

  /* 01 The Shift */
  {
    id: 'regime-shift',
    chapter: '01',
    label: 'The Shift',
    title: 'Not all speculation works the same way',
    theme: 'hold',
    layout: 'split',
    stepLayout: 'text',
    viz: null,
    mapState: 'gray',
    content: `
      <h3 class="s1-title">Not all speculation works the same way</h3>
      <p class="s1-intro">When people talk about housing speculation,
        they often describe it as a single phenomenon. But investors use
        very different strategies in different parts of the city. We focus
        on two recurring patterns visible across more than two decades of
        Boston home sales.</p>

      <div class="s1-pattern-grid" role="group"
        aria-label="Two recurring investor patterns">
        <article class="s1-pattern-card s1-pattern-flip">
          <div class="s1-pattern-header">
            <div class="s1-pattern-name">Flipping</div>
            <div class="s1-pattern-thesis">Fast turnover from lower-cost,
              multi-family stock.</div>
          </div>
          <div class="s1-pattern-body">
            <p>Flipping investors purchase homes with the intention of
              reselling quickly, often after renovation, conversion, or
              repositioning.</p>
            <p>These transactions concentrate in lower-cost multi-family
              housing markets and leave a distinct signature in the data.</p>
          </div>
        </article>

        <article class="s1-pattern-card s1-pattern-hold">
          <div class="s1-pattern-header">
            <div class="s1-pattern-name">Holding</div>
            <div class="s1-pattern-thesis">Long-term capital parking in
              expensive condominium markets.</div>
          </div>
          <div class="s1-pattern-body">
            <p>Holding investors purchase homes, often expensive
              condominiums, and keep them for long periods of time.</p>
            <p>The property functions less as a residence and more as a
              financial asset whose value is expected to grow.</p>
          </div>
        </article>
      </div>
    `
  },

  /* 02 The Map. Geography + classification method in one section. */
  {
    id: 'map-intro',
    chapter: '02',
    label: 'The Map',
    title: 'Two markets hiding in plain sight',
    theme: 'mixed',
    layout: 'split',
    stepLayout: 'split',
    viz: 'map',
    mapState: 'classified',
    content: `
      <h3 class="s2-title">The city splits geographically</h3>
      <p class="s2-intro">These two forms of speculation do not occur
        evenly across Boston. When we classify census tracts by their
        dominant investor behavior, a striking geographic divide
        appears.</p>
      <p class="s2-intro">Holding activity concentrates in high-cost
        neighborhoods with large condominium markets, while flipping
        activity concentrates in lower-income neighborhoods with larger
        shares of multi-family housing.</p>

      <p class="s2-method-intro">To classify this divide, each census
        tract receives two composite scores: one for holding behavior
        and one for flipping behavior.</p>

      <div class="s2-method-grid" role="group"
        aria-label="How hold and flip scores are constructed">
        <article class="s2-method-card s2-method-hold">
          <div class="s2-method-title">Holding score</div>
          <p>Built from signals such as median price, condominium share,
            and investor activity in top-decile sales.</p>
        </article>

        <article class="s2-method-card s2-method-flip">
          <div class="s2-method-title">Flipping score</div>
          <p>Built from rapid resale activity, buy-side flip behavior,
            and concentration of two-to-three-family housing.</p>
        </article>
      </div>

      <p class="s2-method-close">A tract is classified as
        holding-dominant or flipping-dominant when one score exceeds the
        other by 0.75 standard deviations; otherwise it is mixed.</p>

      <div class="s2-methodology-block">
        <button type="button"
          class="s2-method-link"
          data-method-dialog-open
          aria-haspopup="dialog">
          Learn more about classification methodology
        </button>

        <dialog class="s2-method-dialog" data-method-dialog
          aria-labelledby="s2-method-dialog-title">
          <div class="s2-method-dialog-shell">
            <div class="s2-method-dialog-head">
              <p class="s2-method-dialog-kicker">Methodology note</p>
              <button type="button" class="s2-method-dialog-close"
                data-method-dialog-close>Close</button>
            </div>
            <h4 id="s2-method-dialog-title"
              class="s2-method-dialog-title">How classification is built</h4>
            <p class="s2-method-dialog-lead">Each tract gets two
              standardized composite scores, one for <strong>holding</strong>
              and one for <strong>flipping</strong>.</p>

            <div class="s2-method-dialog-score-lines"
              aria-label="Composite score components">
              <p class="s2-method-dialog-score-line s2-method-dialog-score-line-hold">
                <span class="s2-method-dialog-score-name">Hold score</span> = z(median_price) + z(condo_share) + z(top_decile_investor_share)
              </p>
              <p class="s2-method-dialog-score-line s2-method-dialog-score-line-flip">
                <span class="s2-method-dialog-score-name">Flip score</span> = z(flip_rate) + z(buy_side_flip_rate) + z(two_three_family_share)
              </p>
            </div>

            <p class="s2-method-dialog-ruleline">A tract is classified as
              <strong>holding-dominant</strong> when its holding score is at
              least 0.75 standard deviations higher than its flipping score.
              It is classified as <strong>flipping-dominant</strong> when the
              reverse is true. Tracts that do not clear either threshold are
              labeled <strong>mixed</strong>.</p>

            <p class="s2-method-dialog-validation-title">Validation checks</p>
            <p class="s2-method-dialog-validation-line">We validated this
              0.75 SD threshold through <strong>Sensitivity analysis</strong>
              (the classification is stable from 0.5 to 1.25 SD),
              <strong>K-Means clustering</strong> (85.5% agreement with k=2),
              <strong>PCA</strong> (73% variance captured in two components),
              and <strong>Random Forest classification</strong> (F1 = 0.894 in
              5-fold cross validation).</p>
          </div>
        </dialog>
      </div>
    `
  },

  /* 03 The Wedge */
  {
    id: 'price-wedge',
    chapter: '03',
    label: 'The Wedge',
    title: 'Two fundamentally different strategies',
    theme: 'mixed',
    layout: 'split',
    stepLayout: 'split',
    viz: 'pricewedge',
    mapState: null,
    content: `
      <h3 class="s3-title">Two fundamentally different investment strategies</h3>
      <p class="s3-intro">The price wedge shows that holding and flipping
        investors do not just invest in different places. They buy with
        different logics, different risk appetites, and different timing.</p>

      <div class="s3-strategy-grid" role="group"
        aria-label="How holding and flipping investors buy differently">
        <article class="s3-strategy-card s3-strategy-hold">
          <div class="s3-strategy-head">
            <p class="s3-strategy-name">Holding</p>
          </div>
          <p class="s3-strategy-body">In holding tracts, investors
            consistently pay far above non-investors for comparable
            properties, with premiums above 80% in recent years. The
            property is treated as a long-term financial asset.</p>
        </article>

        <article class="s3-strategy-card s3-strategy-flip">
          <div class="s3-strategy-head">
            <p class="s3-strategy-name">Flipping</p>
          </div>
          <p class="s3-strategy-body">In flipping tracts, investors pay
            smaller premiums and sometimes buy below market. During the
            2008 crisis, they purchased at discounts up to 25%, targeting
            distressed assets and fast resale opportunities.</p>
        </article>
      </div>
    `
  },

  /* 04 The Policy. Different mechanisms, different tools. */
  {
    id: 'equity',
    chapter: '04',
    label: 'The Policy',
    title: 'Different mechanisms require different tools',
    theme: 'policy',
    layout: 'split',
    stepLayout: 'split',
    viz: 'map',
    mapState: 'fullViewAnnotated',
    content: `
      <h3 class="s4-title">Different mechanisms require different tools</h3>
      <p class="s4-intro">A single anti-speculation policy cannot address both housing
        markets equally well. The forces reshaping luxury condominium
        markets are not the same forces reshaping multi-family
        neighborhoods vulnerable to displacement.</p>

      <div class="s4-policy-grid" role="group"
        aria-label="Policy tools for holding and flipping markets">
        <article class="s4-policy-card s4-policy-hold">
          <div class="s4-policy-head">
            <p class="s4-policy-tag">Holding-dominant neighborhoods</p>
            <p class="s4-policy-name">Luxury transfer fee on high-value sales</p>
          </div>
          <p class="s4-policy-body">In holding-dominant neighborhoods,
            speculation is driven by the long-term accumulation of
            high-value property assets. This tool captures a portion
            of those speculative gains and redirects those funds
            toward affordable housing production.</p>
        </article>

        <article class="s4-policy-card s4-policy-flip">
          <div class="s4-policy-head">
            <p class="s4-policy-tag">Flipping-dominant neighborhoods</p>
            <p class="s4-policy-name">TOPA protections and anti-flipping fees</p>
          </div>
          <p class="s4-policy-body">In flipping-dominant neighborhoods,
            the immediate risk is rapid turnover and tenant
            displacement. TOPA (Tenant Opportunity to Purchase Act)
            gives tenants a right of first refusal before a building
            is sold to an investor. This can be paired with
            anti-flipping transfer fees on properties resold within
            two years to discourage churn.</p>
        </article>
      </div>

      <p class="s4-close">Treating these markets as identical
        risks creating policies that are too weak in some neighborhoods
        and too blunt in others.</p>
    `
  },

  /* 05 Interactive Map */
  {
    id: 'explorer',
    chapter: '05',
    label: 'Explore',
    title: 'Explore every tract',
    theme: 'mixed',
    layout: 'split',
    stepLayout: 'text',
    viz: null,
    mapState: null,
    content: `
      <h3 class="s5-title">Explore every tract</h3>
      <p class="s5-intro">Hover any tract to inspect its investor
        profile, housing mix, and comparative metrics against city
        averages.</p>
    `
  },

  /* 06 Neighborhood trajectories */
  {
    id: 'neighborhood-trajectories',
    chapter: '06',
    label: 'The Paths',
    title: 'Today’s housing landscape emerged through decades of uneven change',
    theme: 'mixed',
    layout: 'split',
    stepLayout: 'split',
    viz: 'timeline',
    mapState: null,
    content: `
      <h3 class="s6-title">Today’s housing landscape emerged through decades of uneven change.</h3>
      <p class="s6-intro">Some neighborhoods experienced steady investor
        growth over time. Others saw dramatic shifts after the 2008
        financial crisis. In some places, flipping intensified rapidly.
        In others, holding activity became dominant.</p>
      <p class="s6-intro">Compare neighborhoods to see how investor
        behavior, pricing patterns, and housing turnover evolved across
        Boston over the past two decades.</p>
    `
  },

  /* 07 Takeaways */
  {
    id: 'policy',
    chapter: '07',
    label: 'Takeaways',
    title: 'Where intervention could matter most',
    theme: 'policy',
    layout: 'split',
    stepLayout: 'text',
    viz: null,
    mapState: null,
    content: `
      <h3 class="s7-title">Where intervention could matter most</h3>
      <p class="s7-intro">Housing markets are not abstract systems.
        They shape whether families can remain in their neighborhoods,
        whether renters can absorb rising costs, and whether
        communities retain long-term stability.</p>
      <p class="s7-intro">By identifying where speculative pressure is
        strongest and what form it takes, policymakers can better
        target interventions where they may have the greatest positive
        impact.</p>
      <p class="s7-intro">The neighborhoods with the strongest overlap
        between speculative pressure and vulnerability to displacement
        are where targeted housing policy could matter most.</p>
    `
  }
];

/* The closing band sits between the explorer and the formal footer.
 * One italic line, then a quiet handoff. */
export const STORY_OUTRO = `
  <p class="story-outro-line">The data ends in 2022.
    The story is still being written.</p>
`;

export const FOOTER_CONTENT = `
  <div class="project-footer">
    <div class="footer-mapc">This project was developed with guidance
      and feedback from the
      <a href="https://www.mapc.org/" target="_blank"
         rel="noopener noreferrer">Metropolitan Area Planning
      Commission (MAPC)</a>.</div>
    <div class="footer-sources">
      <div class="footer-source-heading">Data sources</div>
      <div>MAPC Residential Sales Transactions, 2000 to 2022</div>
      <div>American Community Survey 5-Year Estimates</div>
      <div>U.S. Census 2020</div>
      <div class="footer-note">173 census tracts with 250 or more
        recorded sales each.</div>
    </div>
    <div class="footer-access">Keyboard navigable. Screen reader
      descriptions on every chart and map. Animations slow or stop
      when system motion is reduced.</div>
    <div class="footer-team">Joseph Firmansyah · Jessica Shoemaker
      · Jean-Michel Mucowintore<br>
      6.C85 Interactive Data Visualization and Society, Spring 2026</div>
  </div>
`;
