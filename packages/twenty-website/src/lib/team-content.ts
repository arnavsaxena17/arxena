export type TeamMember = {
  name: string;
  role: string;
  bio: string;
  showDP?: boolean;
  photo?: string;
  linkedin?: string;
  twitter?: string;
};

export const TEAM_MEMBERS: TeamMember[] = [
  {
    name: 'Arnav Saxena',
    role: 'Founder',
    bio: 'Building Arxena—the org graph layer for org intelligence. Making organizational structure queryable in real time so teams can find, understand, and engage with precision. Previously in product and engineering at startups.',
    showDP: true,
    photo: '/images/team/arnav-saxena.png',
    linkedin: 'https://www.linkedin.com/in/arnavsaxena',
  },
];
