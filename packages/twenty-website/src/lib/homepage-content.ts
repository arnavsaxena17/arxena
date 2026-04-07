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
      'Before Arxena, I had used everything from DiscoverOrg to Rocketreach and no one gave me the niche functions I was looking for - EHS and Logistics Teams, locating the right decision makers took hours… now it takes me minutes, Arxena has helped close over 300k in ARR, this is by far the best sales outreach tool I have used.',
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

export const USE_CASES_SECTION_SUBTITLE =
  'The teams that live and die by who they can reach';

export const USE_CASES = [
  {
    title: 'Sales teams',
    description:
      'Map your target accounts, identify champions and blockers, and let AI open conversations at scale. No more mass-blasting cold emails.',
    href: '/engage',
  },
  {
    title: 'Recruiters',
    description:
      'Find passive candidates by role, level, and company in real time. Reach them on WhatsApp and LinkedIn — where they actually respond.',
    href: '/org-chart/google',
  },
  {
    title: 'Investors & PE/VC',
    description:
      'Assess team depth, leadership quality, and org structure at portfolio companies or acquisition targets — before a single call.',
    href: '/org-chart/netflix',
  },
  {
    title: 'Founders',
    description:
      "Understand how competitors are structured, who they're hiring, and which executives you should be talking to at your next enterprise prospect.",
    href: '/org-chart/microsoft',
  },
] as const;

export const HOW_IT_WORKS_SECTION_SUBTITLE =
  'From company name to booked meeting — in four steps';

export const HOW_IT_WORKS_STEPS = [
  {
    step: 1,
    title: 'Search any company',
    description:
      'Type a company name. Arxena fetches their real-time org chart from LinkedIn and other sources — roles, seniority, reporting lines, locations — algorithmically clustered so you can navigate it instantly.',
  },
  {
    step: 2,
    title: 'Map the structure',
    description:
      'See who leads which team, who reports to whom, and which roles are relevant to your goal. Filter by function, seniority, or geography. Understand team composition at a glance.',
  },
  {
    step: 3,
    title: 'Build your list and get contacts',
    description:
      'Select the people you want to reach. Arxena enriches each profile with verified email, LinkedIn, and WhatsApp contact details — ready to act on immediately.',
  },
  {
    step: 4,
    title: 'AI engages for you',
    description:
      "Arxena's AI sends personalized messages on WhatsApp, LinkedIn, and email — written in your voice, with context from the org chart. You step in only when someone has already replied. No more cold silence.",
    href: '/engage',
  },
] as const;

export const DIFFERENTIATORS = [
  {
    title: 'Any company. Real-time.',
    description:
      "Not a static database. Arxena fetches live org data from LinkedIn and other sources, so you see who's actually there today — not who was listed six months ago.",
  },
  {
    title: 'AI that engages — not just lists',
    description:
      'Most tools stop at "here\'s a contact." Arxena goes further: AI reaches out in your voice, with personalized context, across WhatsApp, LinkedIn, and email. You only respond to warm replies.',
    href: '/engage',
  },
  {
    title: 'Org structure, not just names',
    description:
      "See reporting lines, team clusters, seniority layers. Understand who has budget authority, who's the gatekeeper, and who's the champion — before your first message.",
  },
  {
    title: 'One workflow, start to finish',
    description:
      'Search → map → list → contact → engage. No stitching together six tools. Arxena covers the entire journey from company name to booked meeting.',
  },
] as const;

export const TRUST_COMPANIES = [
  'Thoughtworks',
  'Workato',
  'Triton Exec',
  'Ernst & Young',
] as const;
