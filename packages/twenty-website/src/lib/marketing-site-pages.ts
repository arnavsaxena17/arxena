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
    segmentsNote:
      'The starting point for executive search, enterprise sales, in-house TA, corporate strategy, and PE/VC workflows.',
  },
  {
    slug: 'function-maps',
    title: 'Function Maps',
    headline: 'See who runs what—and who reports to whom',
    metaDescription:
      'Function-level org views: span of control, budget ownership, and authority—before outreach, sourcing, or diligence.',
    lead: 'See who runs each function—so outreach targets, candidate pools, and diligence questions are built on real ownership, not job titles in isolation.',
    bullets: [
      'Compare span of control and depth across functions without building manual spreadsheets.',
      'Spot structural gaps—no CFO, thin bench, interim role—before a pitch, brief, or diligence meeting.',
      'Align outreach to the right economic buyer vs. influencer inside each function.',
      'Benchmark structure against peer companies when combined with timeline and industry data.',
    ],
    segmentsNote:
      'Core input for account planning, pre-call preparation, workforce planning, and deal benchmarking.',
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
      'Surface succession risk, interim roles, and hiring velocity as buying signals, search triggers, or diligence inputs.',
      'Back up BD and recruiting narratives with structural history, not guesswork.',
      'Set alerts when key roles change at companies you are tracking.',
    ],
    segmentsNote:
      'Core for executive search BD, account-based sales, corporate strategy, and investor pre-call preparation.',
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
      'Works alongside the Engagement Layer to turn warm-path insight into actual conversation.',
    ],
    segmentsNote:
      'Used by revenue teams and senior recruiters who live and win in networked markets.',
  },
  {
    slug: 'engagement-layer',
    title: 'Engagement Layer',
    headline: 'Act on org intelligence—with context and measurement',
    metaDescription:
      'Reach stakeholders on LinkedIn, WhatsApp, and email with context from the org graph—and measure what converts.',
    lead: 'The org is mapped, the plan is set. Now engage with precision—and track every touch so you know what converted and why.',
    bullets: [
      'Orchestrate multi-channel outreach from a single workflow tied to the live org map.',
      'Draft in your voice while you approve—and step in only when replies arrive.',
      'Track every touch across LinkedIn, WhatsApp, and email so nothing falls through the cracks.',
      'Measure effectiveness by persona, function, and sequence—refine the playbook with every cycle.',
      'Keep champions and economic buyers in sync across long sales or search cycles.',
    ],
    segmentsNote:
      'See also the dedicated Engage product area for positioning and pricing.',
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
      'Built for data engineering, RevOps, and enterprise teams with compliance and integration requirements.',
  },
];

export const SOLUTION_PAGES: MarketingDetailPage[] = [
  {
    slug: 'executive-search',
    title: 'Executive search',
    headline: 'Org intelligence before the mandate forms',
    metaDescription:
      'Map the target function and surface candidates while the mandate is still forming—structure before competing firms are briefed.',
    lead: 'Walk into the mandate conversation with names and structural gaps already mapped. When the brief was shaped without a stakeholder map—or the role reports to a different power centre than the org chart suggested—six weeks of shortlisting becomes expensive guesswork. Map the function before the brief lands.',
    bullets: [
      'Pre-brief longlist: Surface strong fits 1–2 levels below the role before competing firms are briefed—enter with names, not questions.',
      'Stakeholder map: Know who actually has a say in the hire before you present a shortlist.',
      'Retained positioning: Reference structural gaps—thin bench, interim role, succession risk—with org data behind the story.',
      'Placement protection: Alerts when roles change around a placed candidate so you know before the client calls.',
    ],
    bulletsTitle: 'In practice',
  },
  {
    slug: 'pe-vc',
    title: 'PE & VC',
    headline: 'Queryable structure before the first management call',
    metaDescription:
      'Org intelligence before management meetings—IC memos, CIMs, and LP updates grounded in real structure.',
    lead: 'The first management call is where credibility is made or lost—not the data room. Three CFO changes in two years should shape your thesis before you are committed; management decks are curated. Arxena is what you query before the deck—so you know the room and ask questions that show you did the work.',
    bullets: [
      'Pre-call intelligence: Assess CFO, CTO, COO tenure and structure before the meeting.',
      'Key person risk: Surface thin bench, interim roles, and rapid leadership turnover before they become post-close problems.',
      'Diligence materials: IC memos, CIMs, and LP updates grounded in org timelines and peer benchmarks.',
      'Portfolio monitoring: Track function-level org evolution at holdings over time.',
    ],
    bulletsTitle: 'In practice',
  },
  {
    slug: 'sales-abm',
    title: 'Sales & ABM',
    headline: 'Map the buying committee from the org graph',
    metaDescription:
      'Multi-threaded outreach planned on live structure—budget owners, champions, and blockers before the first message.',
    lead: 'Plan the committee on the org graph before outreach—not one contact at a time under deal-clock pressure. Sequential discovery burns quarters when rapport was built with someone who cannot sign.',
    bullets: [
      'Multithreading from day one: Map budget owner, champion, influencer, and blocker before you commit to a single thread.',
      'Find the economic buyer first: Separate budget from influence so you do not spend a quarter on the wrong champion.',
      'Expansion: See adjacent teams and buyers once you are inside an account.',
      'Displacement: Find the function your competitor does not yet control and who leads it.',
    ],
    bulletsTitle: 'In practice',
  },
  {
    slug: 'corporate-strategy',
    title: 'Corporate strategy',
    headline: 'Peer org structure as a live benchmark',
    metaDescription:
      'Benchmark how peers structure functions and invest headcount—before reorgs, big bets, or M&A.',
    lead: 'Analyst reports lag. See how peers actually invest headcount and structure functions—before you decide how you will organize or compete.',
    bullets: [
      'Pre-reorg benchmarking: Function depth and span of control vs. a live peer set.',
      'Digital and AI build-out: Track competitor investment in technology functions over time.',
      'Headcount ratios: Sales vs. engineering, GTM vs. product—against companies you actually compete with.',
      'M&A integration: Enter with a before-and-after org view for both sides.',
    ],
    bulletsTitle: 'In practice',
  },
  {
    slug: 'talent-acquisition',
    title: 'Talent acquisition',
    headline: 'Pipeline built on how competitors are structured',
    metaDescription:
      'Competitor function maps, passive pipelines, and JD calibration from live org structure—not guesswork.',
    lead: 'Every search starting from scratch creates agency dependency. Map competitor functions passively so you enter each role with names already in hand.',
    bullets: [
      'Passive pipeline: Build by function, level, and geography before headcount is approved.',
      'JD calibration: Benchmark against real peer org structures—not internal guesswork.',
      'Competitive intel: Know how a competitor restructured before it hits the press.',
      'Time-to-fill: Enter director+ searches with a shortlist, not a blank page.',
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
