export const BRAND = {
  name: 'Arxena',
  category: 'Org Intelligence',
  northStar: 'The org graph layer',
  wedge: 'Enterprise sales and executive search',
  mission:
    'To make the hidden structure of organizations visible — so sales and recruiting teams can have more of the right meetings, with the right people, for the same time and budget.',
  vision:
    "A world where every company's organizational structure — every function, every level, every move — is queryable in real time, so the meetings you book are with the people who actually decide.",
} as const;

export const DEFAULT_OG_TITLE = `${BRAND.name} — ${BRAND.category} Platform`;

export const DEFAULT_SITE_DESCRIPTION =
  "More targeted meetings, same budget. Arxena maps any company's live org structure so enterprise sales and executive search teams reach the right decision-makers — not just more contacts.";

export const HOMEPAGE_HERO = {
  title: 'Org Intelligence',
  lead: 'View & power through any company\'s org structure — hack growth via relevant, contexual meetings.',
  stats:
    '10M+ live, real-time company org charts · 800M+ people profiles, contact info & engagement',
  exampleStripTitle: 'Explore a live org graph',
  clarifyNotLabel: 'Not this',
  clarifyNotText:
    "A tool that helps you draw or document your own company's org chart.",
  clarifyIsLabel: 'This',
  clarifyIsText:
    'The live, queryable org graph of any company you sell into or recruit from — so every meeting you book is with someone who can actually say yes.',
} as const;

export const SECTION_SUBTITLES = {
  useCases: 'Built for teams who get paid on meetings, not activity',
  howItWorks: 'From org graph to a calendar full of the right meetings',
  differentiators: 'Why the org graph layer',
  builtFor: 'Built for',
} as const;

export const STORY_PAGE = {
  headline: 'Same effort, more of the right meetings',
  subheadline: BRAND.vision,
  paragraph1:
    "Every rep and every recruiter has a quota of effort — calls, messages, sequences — per week. Most of that effort is spent finding out who to talk to, then talking to the wrong person anyway. Arxena flips the ratio: spend the effort on the conversation, not the org chart.",
  paragraph2:
    'We fetch live org data from LinkedIn and other sources so structure, seniority, and ownership are visible before you write the first message. Map any target company, identify the actual decision-maker or hiring stakeholder, enrich their contact details, and engage on LinkedIn, WhatsApp, and email — all from one workflow.',
  scenarioExample:
    "Two reps send 50 messages each. One sent them to whoever had the right job title. The other sent them to the person who actually owns the budget, mapped from the live org chart. Same volume, same week — very different number of meetings booked.",
} as const;

export const TEAM_PAGE = {
  headline: 'Meet the team',
  subheadline:
    'Building the infrastructure for queryable organizational structure.',
} as const;

export const ENGAGE_PAGE = {
  headline: 'Turn the org chart into meetings on your calendar',
  subheadline:
    'The right person is identified. Now reach them with context — in your voice, on LinkedIn, WhatsApp, and email — and track every touch so you know which sequences turn into meetings.',
} as const;

export const PRODUCTS_INDEX = {
  title: 'Products',
  sub: 'Everything you need to turn a target account into a booked meeting with the right person: explorer, function maps, timeline, connection intelligence, engagement, and API.',
} as const;

export const SOLUTIONS_INDEX = {
  title: 'Solutions',
  sub: 'Enterprise sales and executive search start here. Know exactly who to talk to before you spend a single message on them.',
} as const;

export const RESOURCES_INDEX = {
  headline: 'Resources',
  sub: 'Guides, research, and tools for turning org intelligence into more meetings — editorial, gated reports, and segment ROI models.',
  cards: {
    blog: 'Editorial on org intelligence, targeting, and how teams turn structure into meetings.',
    reports:
      "Research and benchmarks on leadership and functions — built on Arxena's org intelligence dataset.",
    calculators:
      'Calculate how many extra meetings the org graph adds at your current outreach volume.',
  },
  blogParagraphs: [
    'Long-form stories and practical guides on org intelligence — from enterprise sales and executive search to corporate strategy and diligence.',
    'New articles ship on a regular cadence. Subscribe to updates or talk to us about topics you want covered.',
  ],
  reportsParagraphs: [
    "Deep dives into how companies structure leadership and functions — built on Arxena's org intelligence dataset. Reports are released as PDFs and are typically gated for qualified teams.",
    'Request access to upcoming releases or ask us about custom cuts for your sector or geography.',
  ],
  calculatorsParagraphs: [
    'Interactive calculators showing how many additional qualified meetings the org graph adds per 100 outreach attempts — by segment and workflow.',
    'We are rolling out calculators progressively. Book a conversation to walk through assumptions with your team or get early access.',
  ],
} as const;

export const PRICING_PAGE_DESCRIPTION =
  'Access the org graph — credits to map any target company and reach the right person first. Plans for enterprise sales, executive search, investors, and corporate strategy.';

export const CONTACT_PAGE_SUB =
  'Talk to us about getting more of the right meetings for your team — email, WhatsApp, live chat, and office locations.';

export const CHROME_EXTENSION_PAGE = {
  headline: 'Arxena Chrome extension',
  subheadline:
    'Org intelligence where you already work on LinkedIn — see who actually owns the function, not just who has the title, and act from the live org graph.',
} as const;

export const STRUCTURED_DATA = {
  siteDescription:
    'Org intelligence platform: queryable organizational structure for any company. 10M+ companies, 800M+ professionals. Helps sales and recruiting teams book more meetings with the right people for the same effort.',
  nav: {
    pricing: 'Access the org graph — credits for mapping any target company',
    story: 'Why more targeted meetings beat more volume',
    engage: 'Turn org intelligence into booked meetings',
    app: 'Sign in to Arxena',
  },
} as const;