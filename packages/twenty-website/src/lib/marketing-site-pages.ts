export type MarketingDetailSection = {
  title: string;
  bullets: string[];
};

export type MarketingDetailPage = {
  slug: string;
  title: string;
  headline: string;
  metaDescription: string;
  lead: string;
  bullets: string[];
  bulletsTitle?: string;
  // When set, rendered as titled blocks instead of a single bullets list
  sections?: MarketingDetailSection[];
  segmentsNote?: string;
};

export const PRODUCT_PAGES: MarketingDetailPage[] = [
  {
    slug: 'org-chart-explorer',
    title: 'Org Chart Explorer',
    headline: "Query any company's live org structure",
    metaDescription:
      'Search any company and navigate the live org graph—leadership, functions, and reporting depth in seconds.',
    lead: 'Search a company, land on the live hierarchy, drill down. Know who owns what before the call, the brief, or the first message.',
    bullets: [
      'Jump to any role or leader in seconds instead of piecing LinkedIn together by hand.',
      'See reporting depth beyond the public leadership layer when your plan unlocks it.',
      'Export or share views so your team runs one workflow from the same live map.',
      'Pair with Function Maps and Org Timeline for how the org is shaped and how it has changed.',
    ],
    segmentsNote: 'The starting point for Sales and Recruiting workflows.',
  },
  {
    slug: 'function-maps',
    title: 'Function Maps',
    headline: 'See who runs what—and who reports to whom',
    metaDescription:
      'Function-level org views: span of control, budget ownership, and authority—before outreach or sourcing.',
    lead: 'See who runs each function—so outreach targets and candidate pools are built on real ownership, not job titles in isolation.',
    bullets: [
      'Compare span of control and depth across functions without building manual spreadsheets.',
      'Spot structural gaps—no CFO, thin bench, interim role—before a pitch or search brief.',
      'Align outreach to the right economic buyer vs. influencer inside each function.',
      'Benchmark structure against peer companies when combined with timeline and industry data.',
    ],
    segmentsNote:
      'Core input for Sales account planning and Recruiting pipeline design.',
  },
  {
    slug: 'org-timeline',
    title: 'Org Timeline',
    headline: 'Every function, every level, every move—over time',
    metaDescription:
      'Historical org evolution: leadership changes, function build-outs, and structural shifts—queryable over time.',
    lead: 'Who joined, left, or was promoted—month by month. The signal layer that turns org data into timing and context.',
    bullets: [
      'See leadership and function changes month by month instead of relying on storytelling.',
      'Surface succession risk, interim roles, and hiring velocity as buying signals or search triggers.',
      'Back up BD and recruiting narratives with structural history, not guesswork.',
      'Set alerts when key roles change at companies you are tracking.',
    ],
    segmentsNote:
      'Core for Sales timing and Recruiting BD—when structure shifts, opportunity opens.',
  },
  {
    slug: 'connection-intelligence',
    title: 'Connection Intelligence',
    headline: 'Warm paths through the org graph',
    metaDescription:
      'Map the shortest warm path through any organization—so outreach is intro-led, not cold volume.',
    lead: 'Find the shortest warm path to any decision-maker—so the first move is an introduction, not a cold open.',
    bullets: [
      'Identify introducers and mutual touchpoints before sending a generic opening message.',
      'Multi-thread accounts with a plan instead of betting everything on one champion.',
      'Prioritize accounts where a path already exists—and reduce cold volume everywhere else.',
      'Works alongside Outreach to turn warm-path insight into actual conversation.',
    ],
    segmentsNote:
      'Used by Sales and Recruiting teams who win in networked markets.',
  },
  {
    slug: 'engagement-layer',
    title: 'Outreach',
    headline: 'Multi-week sequences across LinkedIn, email, and WhatsApp',
    metaDescription:
      'Run multi-touch outreach sequences—LinkedIn posts, comments, connects, messages, InMail, email, and WhatsApp—tied to the live org map.',
    lead: 'The org is mapped, the plan is set. Orchestrate timed touch points over weeks—profile views, posts, comments, connection requests, DMs, InMail, email, and WhatsApp—and track every touch so you know what booked the meeting.',
    bullets: [
      'Multi-week cadences with many touch points—not a one-shot cold message.',
      'Mix LinkedIn posts, comments, connects, messages, and InMail with email and WhatsApp in one workflow.',
      'Draft in your voice while you approve—and step in only when replies arrive.',
      'Track every touch against the live org map so multithreaded accounts stay in sync.',
      'Measure effectiveness by persona, function, and sequence—refine the playbook with every cycle.',
    ],
    segmentsNote:
      'See also the Outreach product page for positioning and pricing. Built for Sales and Recruiting.',
  },
  {
    slug: 'api',
    title: 'API',
    headline: 'Org graph layer in your stack',
    metaDescription:
      'Enterprise API access to org structure, history, and enrichment for your CRM, data warehouse, or custom workflows.',
    lead: 'Bring org and people intelligence into the tools your team already runs—CRM, data warehouse, or internal tooling—without adding another point solution.',
    bullets: [
      'Integrate company and leadership structure into Salesforce, HubSpot, or internal tools.',
      'Pipe historical org changes into your data lake for models, alerts, and workflow triggers.',
      'Give technical and business buyers a single source of structural truth.',
      'Custom contracts for volume, security review, and solution design—talk to us.',
    ],
    segmentsNote:
      'Built for Sales and Recruiting teams with RevOps or data-engineering requirements.',
  },
];

export const SOLUTION_PAGES: MarketingDetailPage[] = [
  {
    slug: 'sales',
    title: 'Sales',
    headline:
      'Map the buying committee—then run multi-week, multichannel, multi touch follow up sequences',
    metaDescription:
      'Sales on Arxena: map budget owners, champions, and blockers from the live org graph, then run multi-touch sequences across LinkedIn, email, and WhatsApp.',
    lead: 'Sequential discovery burns quarters when rapport was built with someone who cannot sign. Arxena connects two steps into one workflow: map the real buying committee from live org structure, then engage those people over weeks—LinkedIn posts, comments, connects, messages, InMail, email, and WhatsApp—with approve-before-send and reply tracking.',
    bullets: [],
    sections: [
      {
        title: '1. Map',
        bullets: [
          'Multithreading from day one: Map budget owner, champion, influencer, and blocker before you commit to a single thread.',
          'Find the economic buyer first: Separate budget from influence so you do not spend a quarter on the wrong champion.',
          'See the full committee: Function maps and reporting lines show who actually owns the decision—not just who has the right title.',
          'Expansion and displacement: Spot adjacent teams and who leads the function your competitor does not yet control.',
        ],
      },
      {
        title: '2. Engage',
        bullets: [
          'Multi-week sequences with many touch points—not a single cold open.',
          'LinkedIn posts, comments, connection requests, messages, and InMail, plus email and WhatsApp, timed in one cadence.',
          'Draft in your voice, approve before send, and step in when someone replies.',
          'Track every touch so multithreaded accounts stay in sync—and measure what converts by persona and playbook.',
        ],
      },
    ],
    segmentsNote:
      'Map with Org Chart Explorer and Function Maps. Engage with Outreach—multi-touch sequences from the same graph.',
  },
  {
    slug: 'recruiting',
    title: 'Recruiting',
    headline:
      'Map the function—then nurture candidates over multi-week sequences',
    metaDescription:
      'Recruiting on Arxena: map the target function from live org structure, then nurture candidates with multi-touch LinkedIn, email, and WhatsApp sequences.',
    lead: 'Whether you run retained search or in-house recruiting, start with how the org is actually built. Arxena connects mapping and engagement: surface the right people from live structure, then warm them over weeks across LinkedIn posts, comments, connects, messages, InMail, email, and WhatsApp.',
    bullets: [],
    sections: [
      {
        title: '1. Map',
        bullets: [
          'Pre-brief longlist: Surface strong fits 1–2 levels below the role while the mandate is still forming—enter with names, not questions.',
          'Stakeholder map: Know who actually has a say in the hire before you present a shortlist.',
          'Passive pipeline: Build by function, level, and geography from competitor org maps before headcount is approved.',
          'Calibrate the brief: Benchmark against real peer structures—not internal guesswork.',
        ],
      },
      {
        title: '2. Engage',
        bullets: [
          'Multi-week candidate cadences—many touch points, not one cold InMail.',
          'Mix LinkedIn engagement (posts, comments, connects, messages, InMail) with email and WhatsApp.',
          'Draft in your voice, approve before send, and step in when someone replies.',
          'Track every touch so long searches stay coordinated across the team.',
        ],
      },
    ],
    segmentsNote:
      'Map with Org Chart Explorer and Function Maps. Engage with Outreach—multi-touch sequences from the same graph.',
  },
  {
    slug: 'mcp-server',
    title: 'MCP server',
    headline: 'Connect Arxena to Cursor, Claude, and ChatGPT',
    metaDescription:
      'Use the Arxena remote MCP server to query org charts, candidates, and outreach from your AI client—with your workspace API key.',
    lead: 'Expose your workspace recruitment data to authorized AI clients via the Model Context Protocol—remote HTTP at mcp.arxena.com or local stdio for Claude Desktop.',
    bullets: [
      'Cursor: remote MCP with url + X-API-KEY header at mcp.arxena.com.',
      'Claude Desktop: mcp-remote bridge in claude_desktop_config.json.',
      'OAuth 2.1 for Claude and ChatGPT Connectors / app directories.',
      'Org charts, candidates, jobs, LinkedIn search, and messaging tools.',
    ],
    bulletsTitle: 'In practice',
  },
  {
    slug: 'org-chart-embed',
    title: 'Org chart embed',
    headline: 'Drop live org charts on any website',
    metaDescription:
      'Embed Arxena org charts on your careers page or portal with a JavaScript snippet and origin-secured embed key.',
    lead: 'Create an embed key, allow your domain, and paste one snippet. Charts load in real time from Arxena with the branded ARXENA loader.',
    bullets: [
      'iframe embed by default—small loader, full interactive chart.',
      'Live domain lookup or published snapshot modes.',
      'Origin allowlist and per-key rate limits.',
      'Snippet generator in Settings → Developers.',
    ],
    bulletsTitle: 'In practice',
  },
];

const productBySlug = new Map(PRODUCT_PAGES.map((page) => [page.slug, page]));

const solutionBySlug = new Map(SOLUTION_PAGES.map((page) => [page.slug, page]));

export const PRODUCT_SLUGS = PRODUCT_PAGES.map((p) => p.slug);

export const SOLUTION_SLUGS = SOLUTION_PAGES.map((p) => p.slug);

export function getProductBySlug(
  slug: string,
): MarketingDetailPage | undefined {
  return productBySlug.get(slug);
}

export function getSolutionBySlug(
  slug: string,
): MarketingDetailPage | undefined {
  return solutionBySlug.get(slug);
}
