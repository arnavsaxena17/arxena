export type TeamMember = {
  name: string;
  role: string;
  bio: string;
  photo?: string;
  linkedin?: string;
  twitter?: string;
};

export const TEAM_MEMBERS: TeamMember[] = [
  {
    name: 'Arnav Saxena',
    role: 'Founder',
    bio: 'Building Arxena to make org charts and people discovery as easy as finding a place on a map. Previously in product and engineering at startups.',
    linkedin: 'https://www.linkedin.com/in/arnavsaxena',
  },
];
