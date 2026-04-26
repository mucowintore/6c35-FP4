/*
  Narrative content for each scrollytelling section.
  Muco to import this and render each section as a scroll step.

  layout:
    'fullscreen'  fills the viewport (opening title card)
    'split'       left text + right sticky visualization
    'explorer'    full interactive map, no more scroll control

  viz:
    null          no visualization (fullscreen text only)
    'timeseries'  TimeSeriesChart component
    'map'         MapPane component
    'pricewedge'  PriceWedgeChart component
    'explorer'    MapPane in full interactive mode + SidePanel

  mapState (when viz is 'map'):
    'gray'          all tracts neutral gray
    'classified'    tracts in navy and amber (animated bloom, 700ms)
    'holdingDimmed' holding tracts at 10% opacity (400ms transition)
    'fullView'      all tracts fully visible
    'interactive'   full FP2 interaction mode
*/

export const NARRATIVE_SECTIONS = [

  /* Section 0: Opening */
  {
    id: 'opening',
    layout: 'fullscreen',
    viz: null,
    mapState: null,
    content: `
      <h1 class="scroll-headline">When Boston says "speculation,"
        whose neighborhood does it mean?</h1>
      <p class="scroll-subline">180,000 residential transactions.
        23 years. One city, two opposite markets.</p>
      <p class="scroll-byline">Joseph Firmansyah, Jessica Shoemaker,
        Jean-Michel Mucowintore</p>
      <p class="scroll-cue">Scroll to begin \u2193</p>
    `
  },

  /* Section 1: The Regime Shift */
  {
    id: 'regime-shift',
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
        of all purchases in that tier. The crisis did not merely disrupt
        the housing market. It permanently restructured who
        participates in it.</p>
    `
  },

  /* Section 2a: Map appears, neutral gray */
  {
    id: 'map-intro',
    layout: 'split',
    viz: 'map',
    mapState: 'gray',
    content: `
      <h2 class="scroll-section-title">Two markets emerge</h2>
      <p>But where is this happening? And what kind of investing
        are we actually talking about?</p>
      <p>We classified every census tract in Boston by the dominant
        investor strategy observed across two decades of recorded
        purchases. Each tract received two composite scores. One
        measures holding behavior. The other measures flipping
        behavior.</p>
    `
  },

  /* Section 2b: Map blooms into color */
  {
    id: 'map-classified',
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
      <p>We measured three signals of each strategy. For holding: median
        sale price, condominium share, and top-decile investor concentration.
        For flipping: flip rate, buy-side flip rate, and 2-3 family
        property share.</p>
      <p>Can a condo be flipped? Of course. Can a cheap home be held?
        Sure. But across 180,000 transactions, the patterns cluster. The
        tracts where investors overwhelmingly buy expensive condos and sit
        on them are simply not the same tracts where investors buy
        multi-family homes and flip them fast. We set a threshold requiring
        one score to exceed the other by at least 0.75 standard deviations.
        K-Means clustering, which knows nothing about our threshold,
        independently sorted tracts into the same two groups 85.5% of the
        time.</p>
    `
  },

  /* Section 3: The Price Wedge */
  {
    id: 'price-wedge',
    layout: 'split',
    viz: 'pricewedge',
    mapState: null,
    content: `
      <h2 class="scroll-section-title">The price wedge</h2>
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
      <p>The gap between these two lines is the visual signature of two
        fundamentally different investment strategies operating under a
        single word.</p>
    `
  },

  /* Section 4: Who Bears the Cost */
  {
    id: 'equity',
    layout: 'split',
    viz: 'map',
    mapState: 'holdingDimmed',
    content: `
      <h2 class="scroll-section-title">Who bears the cost</h2>
      <p>The geography of flipping is not random. It maps almost
        perfectly onto the geography of race and income in Boston.</p>
      <p>Flipping-dominant tracts are 87% non-white, with a median
        renter household income of $40,625. Holding-dominant tracts
        are 34% non-white, with a median renter income of $85,390.</p>
      <p>The correlation between flipping intensity and non-white
        population is 0.77. That is among the strongest relationships
        in the entire dataset.</p>
      <p>The communities least equipped to absorb speculative pressure
        are the ones absorbing the most of it.</p>
    `
  },

  /* Section 5: Policy */
  {
    id: 'policy',
    layout: 'split',
    viz: 'map',
    mapState: 'fullView',
    content: `
      <h2 class="scroll-section-title">Different problems,
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
    `
  },

  /* Section 6: Explorer */
  {
    id: 'explorer',
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

/* Footer content, rendered below the explorer */
export const FOOTER_CONTENT = `
  <div class="project-footer">
    <p>This project was developed with guidance and feedback from the
      <a href="https://www.mapc.org/" target="_blank"
         rel="noopener noreferrer">Metropolitan Area Planning
      Commission (MAPC)</a>.</p>
    <p class="footer-sources">Data: MAPC Residential Sales Transactions
      2000 to 2022; American Community Survey 5-Year Estimates;
      Census 2020. 173 census tracts with 250 or more recorded sales
      each.</p>
    <p class="footer-team">Joseph Firmansyah, Jessica Shoemaker,
      Jean-Michel Mucowintore<br>
      6.C85 Interactive Data Visualization and Society, Spring 2026</p>
  </div>
`;
