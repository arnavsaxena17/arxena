export const TESTIMONIALS = [
  {
    quote:
      "Arxena is a unique tool that I've been waiting for someone to build. In minutes you get a birds-eye view of their team structure and location. This process would take a day to do manually.",
    name: 'Aaron Lintz',
    title: 'Sr. Talent Sourcing Specialist',
    company: 'Thoughtworks',
    photo: '/img/testimonials/aaron-lintz.jpg',
  },
  {
    quote:
      'Before Arxena, I had used everything from DiscoverOrg to LucidCharts and nothing worked, locating the right decision makers took hours… now it takes me minutes, Arxena has helped close over 300k in ARR, this is by far the best sales outreach tool I have used.',
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

export const USE_CASES = [
  {
    title: 'Founders',
    description:
      'Understand competitor roles, their backgrounds for workforce planning and hiring.',
    href: '/org-chart/microsoft',
  },
  {
    title: 'Recruiters',
    description:
      'Map companies in real time, build lists, fetch contacts, engage on WhatsApp and LinkedIn.',
    href: '/org-chart/google',
  },
  {
    title: 'Sales teams',
    description:
      'Map companies in real time, build lists, fetch contacts, engage on WhatsApp and LinkedIn.',
    href: '/engage',
  },
  {
    title: 'Investors',
    description:
      'Assess team composition and leadership at portfolio companies.',
    href: '/org-chart/netflix',
  },
] as const;

export const HOW_IT_WORKS_STEPS = [
  {
    step: 1,
    title: 'Search',
    description: "Find any company's org chart.",
  },
  {
    step: 2,
    title: 'View structure',
    description:
      'Real-time org structure from LinkedIn and other data; algorithmically clustered.',
  },
  {
    step: 3,
    title: 'Build lists & contacts',
    description: 'Navigate the org, build lists, fetch contact details.',
  },
  {
    step: 4,
    title: 'Engage',
    description:
      'Reach out via WhatsApp, LinkedIn; you only talk to people who respond.',
    href: '/engage',
  },
] as const;

export const DIFFERENTIATORS = [
  {
    title: 'Real-time org charts from LinkedIn (and others)',
    description:
      'Real-time company structures from LinkedIn and other data; algorithmically built so you can navigate, build lists, and fetch contacts.',
  },
  {
    title: 'AI that speaks as you',
    description:
      'Engage in your voice on WhatsApp, LinkedIn, and email. You only talk to people who respond.',
    href: '/engage',
  },
] as const;

export const TRUST_COMPANIES = [
  'Thoughtworks',
  'Workato',
  'Triton Exec',
  'Ernst & Young',
] as const;
