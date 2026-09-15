export type MarketingDetailPage = {
  slug: string;
  title: string;
  headline: string;
  metaDescription: string;
  lead: string;
  bullets: string[];
  bulletsTitle?: string;
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
    headline: 'Manage LinkedIn and email outreach from the org graph',
    metaDescription:
      'Run LinkedIn and email sequences tied to the live org map—approve sends, handle replies, and measure what converts.',
    lead: 'The org is mapped, the plan is set. Reach the right people on LinkedIn and email—with WhatsApp when it fits—and track every touch so you know what booked the meeting.',
    bullets: [
      'Orchestrate LinkedIn and email outreach from a single workflow tied to the live org map.',
      'Draft in your voice while you approve—and step in only when replies arrive.',
      'Track every touch across LinkedIn, email, and WhatsApp so nothing falls through the cracks.',
      'Measure effectiveness by persona, function, and sequence—refine the playbook with every cycle.',
      'Keep champions, hiring managers, and candidates in sync across long sales or search cycles.',
    ],
    segmentsNote:
      'See also /engage for the full Outreach product story. Built for Sales and Recruiting.',
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
    headline: 'Map the buying committee from the org graph',
    metaDescription:
      'Multi-threaded Sales outreach on live structure—budget owners, champions, and blockers before the first LinkedIn or email message.',
    lead: 'Plan the committee on the org graph before outreach—not one contact at a time under deal-clock pressure. Sequential discovery burns quarters when rapport was built with someone who cannot sign. Then run LinkedIn and email sequences from the same map.',
    bullets: [
      'Multithreading from day one: Map budget owner, champion, influencer, and blocker before you commit to a single thread.',
      'Find the economic buyer first: Separate budget from influence so you do not spend a quarter on the wrong champion.',
      'Outreach that lands: Reach the right people on LinkedIn and email with context from the live org chart—see Outreach.',
      'Expansion and displacement: See adjacent teams and who leads the function your competitor does not yet control.',
    ],
    bulletsTitle: 'In practice',
  },
  {
    slug: 'recruiting',
    title: 'Recruiting',
    headline: 'Structure before the shortlist—candidates before the scramble',
    metaDescription:
      'Org intelligence for Recruiting: map the target function, build pipelines from live structure, and reach candidates on LinkedIn and email.',
    lead: 'Whether you are running retained search or in-house talent acquisition, start with how the org is actually built. Map the function, surface fits, calibrate the brief against peer structure—then outreach on LinkedIn and email from the same graph.',
    bullets: [
      'Pre-brief longlist: Surface strong fits 1–2 levels below the role while the mandate is still forming—enter with names, not questions.',
      'Stakeholder map: Know who actually has a say in the hire before you present a shortlist.',
      'Passive pipeline: Build by function, level, and geography from competitor org maps before headcount is approved.',
      'Candidate outreach: Reach on LinkedIn and email with org context—approve sends, track replies, and keep the search moving.',
    ],
    bulletsTitle: 'In practice',
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
