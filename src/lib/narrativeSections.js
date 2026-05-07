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

  /* 04 The Cost.
   *
   * The two equity figures are now embedded inside one Bloomberg-style
   * sentence rather than two parallel cells. Reading the sentence is
   * the comparison. */
  {
    id: 'equity',
    chapter: '04',
    label: 'The Cost',
    title: 'The burden falls unevenly',
    theme: 'flip',
    layout: 'split',
    stepLayout: 'split',
    viz: 'map',
    mapState: 'holdingDimmed',
    content: `
      <h2>The burden falls unevenly</h2>
      <p>The geography of flipping is not random. It maps almost
        perfectly onto the geography of race and income in Boston.</p>

      <p class="equity-sentence" aria-label="Demographic comparison">
        <span class="eq-inline-num"
              data-count-target="87"
              data-count-suffix="%"
              data-count-duration="1600"
              style="color: var(--amber-dark)">0%</span>
        non-white in flipping tracts, against
        <span class="eq-inline-num"
              data-count-target="34"
              data-count-suffix="%"
              data-count-duration="1600"
              data-count-delay="200"
              style="color: var(--navy)">0%</span>
        in holding tracts.
      </p>

      <p>Median renter household income in flipping tracts is $40,625.
        In holding tracts it is $85,390.</p>

      <div class="human-rule" aria-hidden="true"></div>
      <p class="human-sentence">A family in Dorchester whose landlord
        flips their building before the lease ends, and a family in
        Back Bay whose investor neighbor never leaves, are both living
        with speculation. They are not living with the same one.</p>

      <p class="section-takeaway">The communities least equipped to
        absorb speculative pressure are the ones absorbing the most
        of it.</p>
    `
  },

  /* 05 The Paths */
  {
    id: 'neighborhood-trajectories',
    chapter: '05',
    label: 'The Paths',
    title: 'The same city, different paths',
    theme: 'mixed',
    layout: 'split',
    stepLayout: 'split',
    viz: 'timeline',
    mapState: null,
    content: `
      <h2>The same city, different paths</h2>
      <p>The map shows where holding and flipping dominate today. But
        it does not show how each neighborhood arrived there.</p>
      <p>Some places saw investor activity rise steadily over two
        decades. Others were transformed overnight by the 2008 crisis.
        Pick any neighborhoods in the chart to lay their trajectories
        side by side.</p>
    `
  },

  /* 06 The Policy */
  {
    id: 'policy',
    chapter: '06',
    label: 'The Policy',
    title: 'Different markets need different tools',
    theme: 'policy',
    layout: 'split',
    stepLayout: 'split',
    viz: 'map',
    mapState: 'fullViewAnnotated',
    content: `
      <h2>Different markets need different tools</h2>
      <p>A blanket anti-speculation policy will be too weak for
        $800,000 condos in the Seaport and too blunt for $300,000
        triple-deckers in Dorchester. The data does not prescribe a
        single fix. It insists on two.</p>

      <div class="policy-callout policy-callout-hold">
        <span class="policy-tag">Holding zones</span>
        <strong class="policy-name">A transfer fee on high-value sales</strong>
        <span class="policy-body">Capture speculative gains where
          investors are willing to pay 49% above market, and direct
          them back into the affordable housing fund.</span>
      </div>

      <div class="policy-callout policy-callout-flip">
        <span class="policy-tag">Flipping zones</span>
        <strong class="policy-name">A tenant opportunity to purchase act</strong>
        <span class="policy-body">Give tenants the first right to buy
          their building before it can be sold to an investor, so
          flipping cannot quietly displace the families already living
          there.</span>
      </div>

      <div class="closing-rule" aria-hidden="true"></div>
      <p class="closing-takeaway">This data is public. These tracts
        are named. A policy that treats Back Bay and Dorchester as
        the same market will fail both.</p>
      <p class="closing-footnote">A policy choice by the Commonwealth
        of Massachusetts, not a forecast.</p>
    `
  },

  /* 07 Explorer.
   *
   * The reader has just walked the entire argument. The body copy
   * here used to repeat it. One sentence is enough. */
  {
    id: 'explorer',
    chapter: '07',
    label: 'Explore',
    title: 'Now it is your turn',
    theme: 'mixed',
    layout: 'explorer',
    viz: 'explorer',
    mapState: 'interactive',
    content: `
      <h2>Now it is your turn</h2>
      <p>Hover any tract to read its full investor profile.</p>
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
