export const BRAND = {
  name: 'Arxena',
  category: 'Org Intelligence',
  northStar: 'The org graph layer',
  wedge: 'Org intelligence for teams who book meetings from structure',
  mission:
    'To make the hidden structure of organizations visible — so teams can have more of the right meetings, with the right people, for the same time and budget.',
  vision:
    "A world where every company's organizational structure — every function, every level, every move — is queryable in real time, so the meetings you book are with the people who actually decide.",
} as const;

export const DEFAULT_OG_TITLE = `${BRAND.name} — ${BRAND.category} Platform`;

export const DEFAULT_SITE_DESCRIPTION =
  "More targeted meetings, same budget. Arxena maps any company's live org structure so teams reach the right decision-makers — not just more contacts.";

export const HOMEPAGE_HERO = {
  title: 'Org Intelligence',
  lead: "Build & power through any company's org structure.",
  stats:
    '10M+ live, real-time company org charts · 800M+ people profiles, contact info & engagement',
  exampleStripTitle: 'Explore a live org chart: Click on any company below',
  clarifyNotLabel: 'Not this',
  clarifyNotText:
    "A tool that helps you draw or document your own company's org chart.",
  clarifyIsLabel: 'This',
  clarifyIsText:
    'The live, queryable org graph of any target company — so every meeting you book is with someone who can actually say yes.',
} as const;

export const SECTION_SUBTITLES = {
  useCases: 'Built for Sales and Recruiting teams who get paid on meetings',
  howItWorks:
    'From org graph to multi-week sequences that book the right meetings',
  differentiators: 'Why the org graph layer',
  builtFor: 'Built for',
} as const;

export const STORY_PAGE = {
  headline: 'Same effort, more of the right meetings',
  subheadline: BRAND.vision,
  paragraph1:
    'Every team has a quota of effort — calls, messages, sequences — per week. Most of that effort is spent finding out who to talk to, then talking to the wrong person anyway. Arxena flips the ratio: spend the effort on the conversation, not the org chart.',
  paragraph2:
    'We fetch live org data from LinkedIn and other sources so structure, seniority, and ownership are visible before you write the first message. Map any target company, identify the actual decision-maker, enrich their contact details, then run multi-week sequences across LinkedIn posts, comments, connection requests, messages, InMail, email, and WhatsApp — all from one workflow.',
  scenarioExample:
    'Two people send 50 messages each. One sent them to whoever had the right job title. The other sent them to the person who actually owns the decision, mapped from the live org chart. Same volume, same week — very different number of meetings booked.',
} as const;

export const TEAM_PAGE = {
  headline: 'Meet the team',
  subheadline:
    'Building the infrastructure for queryable organizational structure.',
} as const;

export const ENGAGE_PAGE = {
  headline:
    'Multi-week, multichannel, multi touch follow up sequences from the live org graph',
  subheadline:
    'For Sales and Recruiting: timed multi-touch cadences across LinkedIn posts, comments, connection requests, messages, InMail, email, and WhatsApp—approve every send, handle replies, and book the meeting.',
  sections: {
    whatYouCanDoTitle: 'What you can do',
    whatYouCanDo: [
      'Sales: multi-thread buying committees with multi-week sequences from the org map',
      'Recruiting: nurture candidates with the same multi-touch playbook',
      'Draft in your voice; approve, edit, or reject on WhatsApp before anything sends',
      'Mix LinkedIn posts, comments, connects, DMs, and InMail with email and WhatsApp',
      'Step in when someone replies—keep the rest of the cadence on rails',
    ],
    howItTiesTitle: 'From org chart to outreach',
    howItTies: [
      'Map the company and pick the right people from live structure',
      'Enroll them into multi-touch sequences from the same graph',
      'Approve drafts via WhatsApp (Yes / No / Modify) before send',
      'See replies and outcomes across LinkedIn, email, and WhatsApp in one place',
    ],
    productsLinkLabel: 'Product details: Outreach →',
    productsLinkHref: '/products/engagement-layer',
    salesLinkLabel: 'Sales solution →',
    salesLinkHref: '/solutions/sales',
    recruitingLinkLabel: 'Recruiting solution →',
    recruitingLinkHref: '/solutions/recruiting',
  },
} as const;

export const PRODUCTS_INDEX = {
  title: 'Products',
  sub: 'Everything Sales and Recruiting need to turn a target account into a booked meeting: explorer, function maps, timeline, connection intelligence, Outreach, and API.',
} as const;

export const SOLUTIONS_INDEX = {
  title: 'Solutions',
  sub: 'Start with the org graph. Built for Sales and Recruiting—know exactly who to talk to before you spend a single message.',
} as const;

export const RESOURCES_INDEX = {
  headline: 'Resources',
  sub: 'Guides, research, and tools for turning org intelligence into more meetings — editorial, gated reports, and ROI models for Sales and Recruiting.',
  cards: {
    blog: 'Editorial on org intelligence, targeting, and how teams turn structure into meetings.',
    reports:
      "Research and benchmarks on leadership and functions — built on Arxena's org intelligence dataset.",
    calculators:
      'Calculate how many extra meetings the org graph adds at your current outreach volume.',
  },
  blogParagraphs: [
    'Long-form stories and practical guides on org intelligence — from outreach and mapping to Sales and Recruiting workflows.',
    'New articles ship on a regular cadence. Subscribe to updates or talk to us about topics you want covered.',
  ],
  reportsParagraphs: [
    "Deep dives into how companies structure leadership and functions — built on Arxena's org intelligence dataset. Reports are released as PDFs and are typically gated for qualified teams.",
    'Request access to upcoming releases or ask us about custom cuts for your sector or geography.',
  ],
  calculatorsParagraphs: [
    'Interactive calculators showing how many additional qualified meetings the org graph adds per 100 outreach attempts — for Sales and Recruiting workflows.',
    'We are rolling out calculators progressively. Book a conversation to walk through assumptions with your team or get early access.',
  ],
} as const;

export const PRICING_PAGE_DESCRIPTION =
  'Free to Enterprise plans for org intelligence and multi-week, multichannel, multi touch follow up sequences. Priced per seat for Sales and Recruiting teams.';

export const CONTACT_PAGE_SUB =
  'Talk to us about getting more of the right meetings for your team — email, WhatsApp, live chat, and office locations.';

export const CHROME_EXTENSION_PAGE = {
  headline: 'Arxena Chrome extension',
  subheadline:
    'Org intelligence where you already work on LinkedIn — see who actually owns the function, not just who has the title, and act from the live org graph.',
} as const;

export const STRUCTURED_DATA = {
  siteDescription:
    'Org intelligence platform: queryable organizational structure for any company. 10M+ companies, 800M+ professionals. Helps Sales and Recruiting teams book more meetings with the right people for the same effort.',
  nav: {
    pricing:
      'Free to Enterprise — org intelligence and multi-week, multichannel, multi touch follow up sequences, priced per seat',
    story: 'Why more targeted meetings beat more volume',
    engage: 'Manage LinkedIn and email outreach from the org graph',
    app: 'Sign in to Arxena',
  },
} as const;
