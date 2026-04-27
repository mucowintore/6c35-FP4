/* The narrative spine. Every section the reader passes through is
 * defined here. The fields drive layout, the active visualization
 * layer in StoryStage, and the state of the persistent map.
 *
 * Counter elements use data-count-target plus optional prefix, suffix,
 * duration, and delay attributes. StoryScroller animates them. */

export const NARRATIVE_SECTIONS = [

  /* 00 Opening. Dark cinematic full-bleed.
   *
   * The hero is one composed sentence with two embedded display
   * numbers. Reading left to right forces the comparison: the +49 and
   * the 25 sit inside one thought rather than in parallel cells. The
   * counter delays are deliberately past the parent fade-in so the
   * tween is never running while the element is invisible. */
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
      <div class="hero-stack">
        <div class="hero-above">When Boston says</div>
        <div class="hero-row">
          <span class="hero-quote hero-quote-l" aria-hidden="true">“</span>
          <span class="hero-word">speculation</span>
          <span class="hero-quote hero-quote-r" aria-hidden="true">,”</span>
        </div>
        <div class="hero-below">whose neighborhood does it mean?</div>
      </div>

      <div class="opening-thesis" aria-label="Headline finding">
        <span class="thesis-lead">Investors overpay by</span>
        <span class="thesis-num thesis-num-hold">
          <span class="thesis-digits"
            data-count-target="49"
            data-count-prefix="+"
            data-count-duration="1100"
            data-count-delay="200">0</span><span class="thesis-pct">%</span>
        </span>
        <span class="thesis-bridge">in white neighborhoods, and pay</span>
        <span class="thesis-num thesis-num-flip">
          <span class="thesis-digits"
            data-count-target="25"
            data-count-duration="1100"
            data-count-delay="500">0</span><span class="thesis-pct">%</span>
          <span class="thesis-bridge thesis-bridge-tight">less</span>
        </span>
        <span class="thesis-tail">in communities of color.</span>
      </div>

      <div class="opening-attribution" aria-hidden="true">
        180,000 transactions  ·  173 census tracts  ·  2000–2022
      </div>

      <div class="opening-rule" aria-hidden="true"></div>

      <div class="film-credits">
        <div class="film-credit-row">
          <span class="film-credit-tag">A project by</span>
          <span class="film-credit-names">Joseph Firmansyah   Jessica Shoemaker   Jean-Michel Mucowintore</span>
        </div>
        <div class="film-credit-row film-credit-meta">
          6.C85 Interactive Data Visualization &amp; Society  ·  MIT  ·  Spring 2026
        </div>
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
    title: 'After 2008, investors never left',
    theme: 'hold',
    layout: 'split',
    viz: 'timeseries',
    mapState: null,
    content: `
      <h2>After 2008, investors never left</h2>
      <p>Before the financial crisis, roughly one in six Boston home
        purchases was made by an investor. Not a family looking for
        a place to live, but an LLC, a trust, a bank, or a business
        entity buying property as a financial instrument.</p>
      <p>After the crisis, that figure jumped to nearly one in three.
        It never came back down.</p>
      <p class="section-takeaway">The crisis did not merely disrupt
        the housing market. It permanently restructured who
        participates in it.</p>
    `
  },

  /* 02 The Map. Two states, gray then classified, on consecutive scrolls. */
  {
    id: 'map-intro',
    chapter: '02',
    label: 'The Map',
    title: 'Two markets hiding in plain sight',
    theme: 'mixed',
    layout: 'split',
    viz: 'map',
    mapState: 'gray',
    content: `
      <h2>Two markets hiding in plain sight</h2>
      <p>But where is this happening? And what kind of investing
        are we actually talking about?</p>
      <p>We classified every census tract in Boston by the dominant
        investor strategy observed across two decades of recorded
        purchases. Each tract received two composite scores. One
        measures holding behavior. The other measures flipping
        behavior.</p>
      <p class="story-cue">Scroll.</p>
    `
  },

  {
    id: 'map-classified',
    chapter: '02',
    label: 'The Map',
    title: 'Two markets hiding in plain sight',
    theme: 'mixed',
    layout: 'split',
    viz: 'map',
    mapState: 'classified',
    content: `
      <p>The map splits in two.</p>
      <p><span class="zone-chip zone-chip-hold"><span class="zone-chip-dot" aria-hidden="true"></span>Navy tracts</span>
        are <strong>holding zones</strong>. Investors here buy
        expensive condominiums and keep them as long-term financial
        assets.</p>
      <p><span class="zone-chip zone-chip-flip"><span class="zone-chip-dot" aria-hidden="true"></span>Amber tracts</span>
        are <strong>flipping zones</strong>. Investors here buy
        multi-family homes, renovate or convert them, and resell
        within months.</p>
      <p>Can a condo be flipped? Certainly. Can a cheaper home be
        held? Of course. But across 180,000 transactions, one pattern
        emerges with striking clarity: the tracts where investors
        overwhelmingly buy expensive condos and hold them are simply
        not the same tracts where investors buy multi-family homes
        and flip them. An independent K-Means clustering algorithm
        reproduces this same geographic split 85.5% of the time.</p>
    `
  },

  /* 03 The Wedge */
  {
    id: 'price-wedge',
    chapter: '03',
    label: 'The Wedge',
    title: 'Investors pay differently in each market',
    theme: 'mixed',
    layout: 'split',
    viz: 'pricewedge',
    mapState: null,
    content: `
      <h2>Investors pay differently in each market</h2>
      <p>In holding zones, investors consistently pay well above what
        non-investors pay for comparable properties. That premium has
        climbed past 80% in recent years. The property is not a home
        to live in. It is a long-term financial asset, and overpaying
        is the cost of entry.</p>
      <p>In flipping zones, investors pay a much smaller premium.
        During the 2008 crisis, they bought at discounts of up to 25%,
        targeting distressed properties while holding-zone investors
        kept overpaying on the other side of the city.</p>
      <p class="section-takeaway">The gap between these two lines is
        the visual signature of two fundamentally different investment
        strategies operating under a single word.</p>
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
