import { SECTION_SUBTITLES } from '@/lib/brand-content';

export const TESTIMONIALS = [
  {
    quote:
      "Arxena is a unique tool that I've been waiting for someone to build. In minutes you get a birds-eye view of any company's team structure and location. This process would take a day to do manually — and that's before you've even sent a single message.",
    name: 'Aaron Lintz',
    title: 'Sr. Talent Sourcing Specialist',
    company: 'Thoughtworks',
    photo: '/img/testimonials/aaron-lintz.jpg',
  },
  {
    quote:
      'Before Arxena, I had used everything from ZoomInfo to Rocketreach and no one gave me the niche functions I was looking for - EHS and Logistics Teams, locating the right decision makers took hours… now it takes me minutes, Arxena has helped close over 300k in ARR, this is by far the best sales outreach tool I have used.',
    name: 'Craig Rajpal',
    title: 'Enterprise Sales Director',
    company: 'Workato',
    photo: '/img/testimonials/craig-rajpal.jpg',
  },
  {
    quote:
      'Arxena helps me map in minutes large F100 accounts saving me hours of manual work for resourcing projects.',
    name: 'John Calvani',
    title: 'Sr. Resourcing Associate',
    company: 'Triton Exec',
    photo: '/img/testimonials/john-calvani.jpg',
  },
  {
    quote:
      'Arxena helps me map with large F100 accounts saving me hours of manual work for resourcing projects.',
    name: 'Mannan Pacha',
    title: 'Manager - Consulting',
    company: 'Ernst & Young',
    photo: '/img/testimonials/mannan-pacha.webp',
  },
] as const;

export const USE_CASES_SECTION_SUBTITLE = SECTION_SUBTITLES.useCases;

export const USE_CASES = [
  {
    title: 'Executive Search',
    description:
      'Map the target function and surface candidates while the mandate is still forming—structure before the brief, stakeholders before the shortlist.',
    href: '/solutions/executive-search',
  },
  {
    title: 'Investors & PE/VC',
    description:
      'Queryable org structure before the management call—leadership tenure, bench depth, and function evolution as diligence inputs.',
    href: '/solutions/pe-vc',
  },
  {
    title: 'Sales & ABM',
    description:
      'Map the buying committee from the live org graph—budget owners, champions, and influencers before the first message.',
    href: '/solutions/sales-abm',
  },
  {
    title: 'Corporate Strategy',
    description:
      'Peer org structure as live intelligence—how competitors invest headcount and structure functions before reorgs or big bets.',
    href: '/solutions/corporate-strategy',
  },
] as const;

export const HOW_IT_WORKS_SECTION_SUBTITLE = SECTION_SUBTITLES.howItWorks;

export const HOW_IT_WORKS_STEPS = [
  {
    step: 1,
    title: 'Query the org graph',
    description:
      'Search any company. Arxena builds a live, navigable view—roles, functions, reporting lines—from LinkedIn and other sources in seconds.',
  },
  {
    step: 2,
    title: 'Plan your move',
    description:
      'Assess the bench before the call. Map stakeholders before the brief. See the committee before outreach. Structure becomes the plan.',
  },
  {
    step: 3,
    title: 'Engage with precision',
    description:
      'Reach with context from the org graph—enriched contacts and outreach in your voice, not generic sequences.',
  },
  {
    step: 4,
    title: 'Measure what works',
    description:
      'Every touch tracked across LinkedIn, WhatsApp, and email. See what converts by persona and sequence—each cycle sharper than the last.',
    href: '/engage',
  },
] as const;

export const DIFFERENTIATORS = [
  {
    title: 'Live org graph, not static lists',
    description:
      'Reporting lines, budget owners, decision-makers, and gatekeepers—structure you can query in real time, not names scraped into a spreadsheet.',
  },
  {
    title: 'Every function, every level, every move',
    description:
      'Org timeline surfaces leadership changes, build-outs, and structural shifts—so timing and context come from the graph, not guesswork.',
    href: '/products/org-timeline',
  },
  {
    title: 'Structure—not just contacts',
    description:
      'Outreach, shortlists, and diligence land on the right person for the right reason—because you see who runs what and who answers to whom.',
    href: '/products/function-maps',
  },
  {
    title: 'Act on intelligence in one place',
    description:
      'Map, plan, reach, and measure from the same org graph—LinkedIn, WhatsApp, and email tied to live structure.',
    href: '/engage',
  },
] as const;

export const TRUST_COMPANIES = [
  'Thoughtworks',
  'Workato',
  'Triton Exec',
  'Ernst & Young',
] as const;
