export const BRAND = {
  name: 'Arxena',
  category: 'Org Intelligence',
  northStar: 'The org graph layer',
  wedge: 'Executive search and PE/VC',
  mission:
    'To make the hidden structure of organizations visible — so the people and teams that shape the world can be found, understood, and engaged with precision.',
  vision:
    "A world where every company's organizational structure — every function, every level, every move — is queryable in real time, and acting on that intelligence requires no research team, no manual effort, and no guesswork.",
} as const;

export const DEFAULT_OG_TITLE = `${BRAND.name} — ${BRAND.category} Platform`;

export const DEFAULT_SITE_DESCRIPTION =
  'Make every company\'s organizational structures visible and queryable in real time. The org graph layer for executive search, investors, sales, and corporate strategy — map, plan, engage, and measure.';

export const HOMEPAGE_HERO = {
  title: 'Org Intelligence',
  lead: 'Make the hidden structure of any organization visible—queryable in real time - in seconds.',
  stats:
    '10M+ live, real time company org charts · 800M+ people profiles, contact info & engagement',
  exampleStripTitle: 'Explore a live org graph',
  clarifyNotLabel: 'Not this',
  clarifyNotText:
    "A tool that helps you draw or document your own company's org chart.",
  clarifyIsLabel: 'This',
  clarifyIsText:
    'Org intelligence infrastructure—the live, queryable org graph of any company you target for search, sales, investing, or strategy.',
} as const;

export const SECTION_SUBTITLES = {
  useCases: 'Org intelligence for teams who decide on structure',
  howItWorks: 'From org graph to conversation—in one place',
  differentiators: 'Why the org graph layer',
  builtFor: 'Built for',
} as const;

export const STORY_PAGE = {
  headline: 'Making organizational structures visible',
  subheadline: BRAND.vision,
  paragraph1:
    'Every company has an org chart on paper. The real map—who leads what, who reports to whom, who actually holds budget—does not exist anywhere in a structured, queryable form. Arxena is building the org graph layer: org intelligence infrastructure, not another contact database.',
  paragraph2:
    'We fetch live org data from LinkedIn and other sources so structure, seniority, and moves are visible in real time. Map any target company, plan your move on the graph, enrich contacts, and engage with precision on WhatsApp, LinkedIn, and email—for executive search, PE/VC, enterprise sales, corporate strategy, and competitive research.',
  scenarioExample:
    'When a peer restructures its cloud function or loses a CFO, the signal is in the org graph—not in a press release weeks later.',
} as const;

export const TEAM_PAGE = {
  headline: 'Meet the team',
  subheadline:
    'Building the infrastructure for queryable organizational structure.',
} as const;

export const ENGAGE_PAGE = {
  headline: 'Act on org intelligence',
  subheadline:
    'Engage with precision on top of the org graph—personalized outreach in your voice, with structure and context in every message. You step in when someone has already replied.',
} as const;

export const PRODUCTS_INDEX = {
  title: 'Products',
  sub: 'The org graph layer—explorer, function maps, timeline, connection intelligence, engagement, and API.',
} as const;

export const SOLUTIONS_INDEX = {
  title: 'Solutions',
  sub: 'Executive search and investors start here. Map structure before the mandate, the management call, or the first outreach.',
} as const;

export const RESOURCES_INDEX = {
  headline: 'Resources',
  sub: 'Guides, research, and tools for turning org intelligence into decisions—editorial, gated reports, and segment ROI models.',
  cards: {
    blog: 'Editorial on org intelligence, structure, and how teams act on the org graph.',
    reports:
      "Research and benchmarks on leadership and functions—built on Arxena's org intelligence dataset.",
    calculators:
      'ROI models for teams who run on org intelligence—by segment and workflow.',
  },
  blogParagraphs: [
    'Long-form stories and practical guides on org intelligence—from executive search and enterprise sales to strategy and diligence.',
    'New articles ship on a regular cadence. Subscribe to updates or talk to us about topics you want covered.',
  ],
  reportsParagraphs: [
    "Deep dives into how companies structure leadership and functions—built on Arxena's org intelligence dataset. Reports are released as PDFs and are typically gated for qualified teams.",
    'Request access to upcoming releases or ask us about custom cuts for your sector or geography.',
  ],
  calculatorsParagraphs: [
    'Interactive ROI calculators tuned by buyer segment—executive search, sales, talent, strategy, and PE/VC—so you can quantify time saved on the org graph or diligence efficiency.',
    'We are rolling out calculators progressively. Book a conversation to walk through assumptions with your team or get early access.',
  ],
} as const;

export const PRICING_PAGE_DESCRIPTION =
  'Access the org graph—credits to map any target company. Plans for executive search, investors, sales, and corporate strategy.';

export const CONTACT_PAGE_SUB =
  'Talk to us about org intelligence for your team—email, WhatsApp, live chat, and office locations.';

export const CHROME_EXTENSION_PAGE = {
  headline: 'Arxena Chrome extension',
  subheadline:
    'Org intelligence where you work on LinkedIn—connect your account, view profiles in context, and act from the live org graph.',
} as const;

export const STRUCTURED_DATA = {
  siteDescription:
    'Org intelligence platform: queryable organizational structure for any company. 10M+ companies, 800M+ professionals. Map, plan, engage, and measure from the live org graph.',
  nav: {
    pricing: 'Access the org graph—credits for mapping any target company',
    story: 'Mission, vision, and why we built org intelligence',
    engage: 'Act on org intelligence—outreach with context from the org graph',
    app: 'Sign in to Arxena',
  },
} as const;
