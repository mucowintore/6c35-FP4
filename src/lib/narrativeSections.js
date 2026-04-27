/* Story content. Each split section renders one StoryStepBody copy
 * inside the text column. The viz, mapState, and theme fields drive
 * the persistent stage on the right and the page chrome on the left.
 *
 * Numbers tagged data-count-target are tweened from zero by the
 * counter system in StoryScroller. The opening uses a delay aligned
 * with the entrance choreography; Section 04 fires on first scroll
 * into view. */

export const NARRATIVE_SECTIONS = [

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
          <span class="hero-quote hero-quote-l" aria-hidden="true">&ldquo;</span><span class="hero-word">speculation</span><span class="hero-quote hero-quote-r" aria-hidden="true">&rdquo;</span>
        </div>
        <div class="hero-below">whose neighborhood does it mean?</div>
        <div class="opening-stats">
          <div class="opening-stat">
            <span class="stat-figure">
              <span class="stat-num" style="color: #6BA3D6"
                data-count-target="49" data-count-prefix="+"
                data-count-delay="1400">+0</span><span class="stat-pct" style="color: #6BA3D6">%</span>
            </span>
            <span class="opening-stat-label">What investors overpay in
              wealthy, white neighborhoods</span>
          </div>
          <div class="opening-stat">
            <span class="stat-figure">
              <span class="stat-num" style="color: var(--amber)"
                data-count-target="25" data-count-delay="1400">0</span><span class="stat-pct" style="color: var(--amber)">%</span>
            </span>
            <span class="opening-stat-label">The discount they took in
              communities of color during the crisis</span>
          </div>
        </div>
        <div class="opening-rule"></div>
        <p class="scroll-subline">180,000 sales. Two decades. One city
          that split in half and never came back together.</p>
        <p class="scroll-byline">Joseph Firmansyah · Jessica Shoemaker
          · Jean-Michel Mucowintore</p>
        <div class="scroll-cue-wrap">
          <span class="scroll-cue-text">Scroll to begin</span>
          <svg class="scroll-cue-chevron" width="16" height="10"
            viewBox="0 0 16 10" fill="none">
            <path d="M1 1L8 8L15 1" stroke="currentColor"
              stroke-width="2" stroke-linecap="round"
              stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
    `
  },

  {
    id: 'regime-shift',
    chapter: '01',
    label: 'The Shift',
    title: 'After 2008, investors never left',
    theme: 'hold',
    layout: 'split',
    viz: 'timeseries',
    mapState: null,
    background: 'dark',
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
      <p><strong style="color: var(--navy)">Navy tracts</strong> are
        holding zones. Investors here buy expensive condominiums and
        keep them as long-term financial assets.</p>
      <p><strong style="color: var(--amber)">Amber tracts</strong> are
        flipping zones. Investors here buy multi-family homes, renovate
        or convert them, and resell within months.</p>
      <p>Can a condo be flipped? Certainly. Can a cheaper home be
        held? Of course. But across 180,000 transactions, one pattern
        emerges with striking clarity: the tracts where investors
        overwhelmingly buy expensive condos and hold them are simply
        not the same tracts where investors buy multi-family homes and
        flip them. An independent K-Means clustering algorithm
        reproduces this same geographic split 85.5% of the time.</p>
    `
  },

  {
    id: 'price-wedge',
    chapter: '03',
    label: 'The Wedge',
    title: 'Investors pay differently in each market',
    theme: 'mixed',
    layout: 'split',
    viz: 'pricewedge',
    mapState: null,
    background: 'dark',
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

  {
    id: 'equity',
    chapter: '04',
    label: 'The Cost',
    title: 'The burden falls unevenly',
    theme: 'flip',
    layout: 'split',
    viz: 'map',
    mapState: 'holdingDimmed',
    background: 'amber',
    content: `
      <h2>The burden falls unevenly</h2>
      <p>The geography of flipping is not random. It maps almost
        perfectly onto the geography of race and income in Boston.</p>
      <div class="equity-stats">
        <div class="equity-stat">
          <span class="eq-num" style="color: var(--amber)"
            data-count-target="87">0</span><span class="eq-pct" style="color: var(--amber)">%</span>
          <span class="equity-label">non-white in flipping tracts</span>
        </div>
        <div class="equity-stat">
          <span class="eq-num" style="color: var(--navy)"
            data-count-target="34">0</span><span class="eq-pct" style="color: var(--navy)">%</span>
          <span class="equity-label">non-white in holding tracts</span>
        </div>
      </div>
      <p>Median renter household income in flipping tracts is $40,625.
        In holding tracts it is $85,390.</p>
      <p class="human-sentence">A family renting in Dorchester faces a
        market where every third home sale is a speculator's flip. A
        family renting in Back Bay faces a market where investors sit
        on empty condos that will never become anyone's home.</p>
      <p class="section-takeaway">The communities least equipped to
        absorb speculative pressure are the ones absorbing the most
        of it.</p>
    `
  },

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
        Select neighborhoods in the chart to compare their
        trajectories.</p>
    `
  },

  {
    id: 'policy',
    chapter: '06',
    label: 'The Policy',
    title: 'Different markets need different tools',
    theme: 'policy',
    layout: 'split',
    viz: 'map',
    mapState: 'fullViewAnnotated',
    background: 'white',
    content: `
      <h2>Different markets need different tools</h2>
      <p>A blanket anti-speculation policy will be too weak for
        $800,000 condos in the Seaport and too blunt for $300,000
        triple-deckers in Dorchester.</p>
      <div class="policy-callout policy-callout-hold">
        <strong>Transfer fee on high-value sales</strong>
        <span>Captures speculative gains and redirects them toward
          affordable housing in holding zones</span>
      </div>
      <div class="policy-callout policy-callout-flip">
        <strong>Tenant Opportunity to Purchase Act</strong>
        <span>Gives tenants first right to buy their building
          before it can be sold to an investor in flipping zones</span>
      </div>
      <p>A policy that treats Back Bay and Dorchester as the same
        market will fail both.</p>
      <p class="section-takeaway">This data is public. These tracts
        are named. The question is whether the policy will be as
        specific as the problem.</p>
    `
  },

  {
    id: 'explorer',
    chapter: '07',
    label: 'Explore',
    title: 'Explore every tract',
    theme: 'mixed',
    layout: 'explorer',
    viz: 'explorer',
    mapState: 'interactive',
    content: `
      <h2>Explore every tract</h2>
      <p>Hover to see any tract's investor profile. Click to lock
        a selection. Use the filter buttons to isolate holding or
        flipping zones, or jump to a specific neighborhood.</p>
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
    <div class="footer-team">Joseph Firmansyah · Jessica Shoemaker
      · Jean-Michel Mucowintore<br>
      6.C85 Interactive Data Visualization and Society, Spring 2026</div>
  </div>
`;
