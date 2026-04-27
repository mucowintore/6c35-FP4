export const NARRATIVE_SECTIONS = [

  /* opening: dark cinematic title card */
  {
    id: 'opening',
    chapter: '00',
    title: '',
    theme: 'mixed',
    layout: 'fullscreen',
    viz: null,
    mapState: null,
    content: `
      <h1 class="scroll-headline">When Boston says
        <em>"speculation,"</em> whose neighborhood does it mean?</h1>
      <div class="opening-stats">
        <div class="opening-stat opening-stat-hold">
          <span class="opening-stat-number">+49%</span>
          <span class="opening-stat-label">What investors overpay
            in wealthy, white neighborhoods</span>
        </div>
        <div class="opening-stat opening-stat-flip">
          <span class="opening-stat-number">25%</span>
          <span class="opening-stat-label">The discount they took in
            communities of color during the crisis</span>
        </div>
      </div>
      <div class="opening-rule"></div>
      <p class="scroll-subline">180,000 residential transactions.
        23 years. One city, pulled apart.</p>
      <p class="scroll-byline">Joseph Firmansyah \u00b7 Jessica Shoemaker
        \u00b7 Jean-Michel Mucowintore</p>
      <div class="scroll-cue-wrap">
        <span class="scroll-cue-text">Scroll to begin</span>
        <svg class="scroll-cue-chevron" width="16" height="10"
          viewBox="0 0 16 10" fill="none">
          <path d="M1 1L8 8L15 1" stroke="currentColor"
            stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round"/>
        </svg>
      </div>
    `
  },

  /* 01: the permanent shift in investor participation */
  {
    id: 'regime-shift',
    chapter: '01',
    title: 'After 2008, investors never left',
    theme: 'hold',
    layout: 'split',
    viz: 'timeseries',
    mapState: null,
    content: `
      <h2 class="scroll-section-title">After 2008, investors never left</h2>
      <p>Before the financial crisis, roughly one in six Boston home
        purchases was made by an investor. Not a family looking for
        a place to live, but an LLC, a trust, a bank, or a business
        entity buying property as a financial instrument.</p>
      <p>After the crisis, that figure jumped to nearly one in three.
        It never came back down.</p>
      <p>In the most expensive tenth of the market, the transformation
        is even more striking. Investors now account for roughly 70%
        of all purchases in that tier.</p>
      <p class="section-takeaway">The crisis did not merely disrupt
        the housing market. It permanently restructured who
        participates in it.</p>
    `
  },

  /* 02a: map appears in neutral gray */
  {
    id: 'map-intro',
    chapter: '02',
    title: 'Two markets hiding in plain sight',
    theme: 'mixed',
    layout: 'split',
    viz: 'map',
    mapState: 'gray',
    content: `
      <h2 class="scroll-section-title">Two markets hiding in plain sight</h2>
      <p>But where is this happening? And what kind of investing
        are we actually talking about?</p>
      <p>We classified every census tract in Boston by the dominant
        investor strategy observed across two decades of recorded
        purchases. Each tract received two composite scores. One
        measures holding behavior. The other measures flipping
        behavior.</p>
    `
  },

  /* 02b: the bloom, tracts color into navy and amber */
  {
    id: 'map-classified',
    chapter: '02',
    title: 'Two markets hiding in plain sight',
    theme: 'mixed',
    layout: 'split',
    viz: 'map',
    mapState: 'classified',
    content: `
      <p>The map splits in two.</p>
      <p><strong style="color: var(--navy)">Navy tracts</strong> are
        holding zones. Investors here buy expensive condominiums and
        keep them as long-term financial assets. Darker navy means
        more intense holding activity.</p>
      <p><strong style="color: var(--amber)">Amber tracts</strong> are
        flipping zones. Investors here buy multi-family homes, renovate
        or convert them, and resell within months. Darker amber means
        more flipping.</p>
      <p>We measured three signals of each strategy. For holding:
        median sale price, condominium share, and top-decile investor
        concentration. For flipping: flip rate, buy-side flip rate,
        and 2-3 family property share.</p>
      <p>Can a condo be flipped? Of course. Can a cheaper home be
        held? Certainly. But across 180,000 transactions, one pattern
        emerges with striking clarity: the tracts where investors
        overwhelmingly buy expensive condos and hold them are simply
        not the same tracts where investors buy multi-family homes and
        flip them. An independent K-Means clustering algorithm, which
        knows nothing about our scoring threshold, reproduces this
        same geographic split 85.5% of the time.</p>
    `
  },

  /* 03: the price wedge between holding and flipping */
  {
    id: 'price-wedge',
    chapter: '03',
    title: 'Investors pay differently in each market',
    theme: 'mixed',
    layout: 'split',
    viz: 'pricewedge',
    mapState: null,
    content: `
      <h2 class="scroll-section-title">Investors pay differently
        in each market</h2>
      <p>The two strategies differ not just in geography but in how
        investors actually behave when they show up to buy.</p>
      <p>In holding zones, investors consistently pay well above what
        non-investors pay for comparable properties. That premium has
        climbed past 80% in recent years. The property is not a home
        to live in. It is a long-term financial asset, and overpaying
        is the cost of entry.</p>
      <p>In flipping zones, investors pay a much smaller premium.
        During the 2008 crisis, they bought at discounts of up to 25%,
        targeting distressed properties in distressed neighborhoods
        while holding-zone investors kept overpaying on the other side
        of the city.</p>
      <p class="section-takeaway">The gap between these two lines is
        the visual signature of two fundamentally different investment
        strategies operating under a single word.</p>
    `
  },

  /* 04: the racial and economic geography of flipping */
  {
    id: 'equity',
    chapter: '04',
    title: 'The burden falls unevenly',
    theme: 'flip',
    layout: 'split',
    viz: 'map',
    mapState: 'holdingDimmed',
    content: `
      <h2 class="scroll-section-title">The burden falls unevenly</h2>
      <p>The geography of flipping is not random. It maps almost
        perfectly onto the geography of race and income in Boston.</p>
      <div class="equity-stats">
        <div class="equity-stat">
          <span class="equity-number" style="color: var(--amber)">87%</span>
          <span class="equity-label">non-white in flipping tracts</span>
        </div>
        <div class="equity-stat">
          <span class="equity-number" style="color: var(--navy)">34%</span>
          <span class="equity-label">non-white in holding tracts</span>
        </div>
      </div>
      <p>Median renter household income in flipping tracts is $40,625.
        In holding tracts it is $85,390. The correlation between
        flipping intensity and non-white population is 0.77, among
        the strongest relationships in the entire dataset.</p>
      <p class="section-takeaway">The communities least equipped to
        absorb speculative pressure are the ones absorbing the most
        of it.</p>
    `
  },

  /* 05: neighborhood trajectories over time (Jessica's chart) */
  {
    id: 'neighborhood-trajectories',
    chapter: '05',
    title: 'The same city, different paths',
    theme: 'mixed',
    layout: 'split',
    viz: 'timeline',
    mapState: null,
    content: `
      <h2 class="scroll-section-title">The same city, different paths</h2>
      <p>The map shows where holding and flipping dominate today. But
        it does not show how each neighborhood arrived there.</p>
      <p>Some places saw investor activity rise steadily over two
        decades. Others were transformed overnight by the 2008 crisis.
        In some neighborhoods, flipping intensified year after year.
        In others, it appeared briefly during moments of distress and
        then receded.</p>
      <p>Select neighborhoods in the chart to compare how investor
        share, flipping activity, and pricing behavior evolved over
        time. Watch where trajectories align and where they split
        apart.</p>
    `
  },

  /* 06: policy recommendations grounded in the data */
  {
    id: 'policy',
    chapter: '06',
    title: 'Different markets need different tools',
    theme: 'policy',
    layout: 'split',
    viz: 'map',
    mapState: 'fullView',
    content: `
      <h2 class="scroll-section-title">Different markets need
        different tools</h2>
      <p>A blanket anti-speculation policy will be too weak for
        $800,000 condos in the Seaport and too blunt for $300,000
        triple-deckers in Dorchester. The policy has to match the
        mechanism.</p>
      <p>In holding zones, a <strong>transfer fee on high-value
        condominium sales</strong> captures a portion of speculative
        gains and redirects them toward affordable housing production
        in the neighborhoods that need it most.</p>
      <p>In flipping zones, the <strong>Tenant Opportunity to Purchase
        Act</strong> gives tenants in multi-family rental buildings the
        right of first refusal when their building is sold. These are
        the 2-3 family homes that make up the primary housing stock in
        these neighborhoods, and they are the main target of rapid
        investor turnover. Combined with an anti-flip transfer fee on
        properties resold within two years, these measures can slow the
        displacement cycle before it takes hold.</p>
      <p class="section-takeaway">The data does not prescribe a single
        solution. But it does insist on precision. A policy that treats
        Back Bay and Dorchester as the same market will fail both.</p>
    `
  },

  /* 07: full interactive explorer, the culmination */
  {
    id: 'explorer',
    chapter: '07',
    title: 'Explore every tract',
    theme: 'mixed',
    layout: 'explorer',
    viz: 'explorer',
    mapState: 'interactive',
    content: `
      <h2 class="scroll-section-title">Explore every tract</h2>
      <p>The story above is the city's story. Now explore the story
        of any individual census tract. Hover to see its investor
        profile. Click to lock a selection. Use the filter buttons
        to isolate holding or flipping zones, or jump to a specific
        neighborhood.</p>
    `
  }
];

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
      descriptions on all charts and maps.</div>
    <div class="footer-team">Joseph Firmansyah \u00b7 Jessica Shoemaker
      \u00b7 Jean-Michel Mucowintore<br>
      6.C85 Interactive Data Visualization and Society, Spring 2026</div>
  </div>
`;
