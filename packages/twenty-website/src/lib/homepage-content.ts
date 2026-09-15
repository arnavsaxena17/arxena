import { SECTION_SUBTITLES } from '@/lib/brand-content';

type Testimonial = {
  quote: string;
  name: string;
  title: string;
  company: string;
  photo?: string;
};

export const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "Arxena is a unique tool that I've been waiting for someone to build. In minutes you get a birds-eye view of any company's team structure and location. This process would take a day to do manually — and that's before you've even sent a single message.",
    name: 'Aaron Lintz',
    title: 'Sr. Talent Sourcing Specialist',
    company: 'Thoughtworks',
    // No asset: workflows never shipped aaron-lintz.jpg (legacy lintz.jpg missing/gitignored)
  },
  {
    quote:
      'Before Arxena, I had used everything from ZoomInfo to Rocketreach and no one gave me the niche functions I was looking for - EHS and Logistics Teams, locating the right decision makers took hours… now it takes me minutes, Arxena has helped close over 300k in ARR, this is by far the best sales outreach tool I have used.',
    name: 'Craig Rajpal',
    title: 'Enterprise Sales Director',
    company: 'Workato',
  },
  {
    quote:
      'Arxena helps me map in minutes large F100 accounts saving me hours of manual work for resourcing projects.',
    name: 'John Calvani',
    title: 'Sr. Resourcing Associate',
    company: 'Triton Exec',
  },
  {
    quote:
      'Arxena helps me map with large F100 accounts saving me hours of manual work for resourcing projects.',
    name: 'Mannan Pacha',
    title: 'Manager - Consulting',
    company: 'Ernst & Young',
    photo: '/img/testimonials/mannan-pacha.webp',
  },
];

export const USE_CASES_SECTION_SUBTITLE = SECTION_SUBTITLES.useCases;

export const USE_CASES = [
  {
    title: 'Sales',
    description:
      'Map the buying committee from the live org graph—budget owners, champions, and influencers—then reach them on LinkedIn and email.',
    href: '/solutions/sales',
  },
  {
    title: 'Recruiting',
    description:
      'Map the target function, surface candidates from live structure, and run LinkedIn and email outreach from the same graph.',
    href: '/solutions/recruiting',
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
    title: 'LinkedIn and email outreach',
    description:
      'Reach with context from the org graph—enriched contacts and sequences in your voice on LinkedIn and email, not generic spray-and-pray.',
  },
  {
    step: 4,
    title: 'Measure what works',
    description:
      'Every touch tracked across LinkedIn, email, and WhatsApp. See what converts by persona and sequence—each cycle sharper than the last.',
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
      'Outreach and shortlists land on the right person for the right reason—because you see who runs what and who answers to whom.',
    href: '/products/function-maps',
  },
  {
    title: 'Act on intelligence in one place',
    description:
      'Map, plan, reach, and measure from the same org graph—LinkedIn and email outreach tied to live structure.',
    href: '/engage',
  },
] as const;

export const TRUST_COMPANIES = [
  'Thoughtworks',
  'Workato',
  'Triton Exec',
  'Ernst & Young',
] as const;
