// Curated rung-2 equivalents for the roles this product sees most, used when
// the job-title taxonomy service is unreachable. It is a fallback, not a second
// taxonomy: it only widens the words a role is searched and matched with, and
// it never removes the role the user typed.
export type TitleFamilyFallback = {
  id: string;
  // Matched against the role as typed, lowercased
  match: RegExp;
  // Rung-2 equivalents: the same function at the same grade
  equivalents: string[];
};

export const TITLE_FAMILY_FALLBACKS: readonly TitleFamilyFallback[] = [
  {
    id: 'engineering-leadership',
    match: /\b(engineer(ing)?|technology|technical|cto)\b/,
    equivalents: [
      'VP Engineering',
      'Vice President Engineering',
      'Head of Engineering',
      'Engineering Head',
      'Director of Engineering',
      'Chief Technology Officer',
      'CTO',
    ],
  },
  {
    id: 'plant-head',
    match: /\b(plant|factory|works|unit head|site head|manufacturing)\b/,
    equivalents: [
      'Plant Head',
      'Plant Manager',
      'Factory Manager',
      'Works Manager',
      'Unit Head',
      'Site Head',
      'Manufacturing Head',
      'General Manager Operations',
    ],
  },
  {
    id: 'operations-leadership',
    match: /\b(coo|chief operating|operations|business head)\b/,
    equivalents: [
      'COO',
      'Chief Operating Officer',
      'President Operations',
      'VP Operations',
      'Head of Operations',
      'Business Head',
      'General Manager Operations',
    ],
  },
  {
    id: 'supply-chain',
    match: /\b(supply chain|scm|logistics|warehouse|distribution)\b/,
    equivalents: [
      'Head of Supply Chain',
      'Supply Chain Head',
      'VP Supply Chain',
      'Director Supply Chain',
      'Chief Supply Chain Officer',
      'SCM Head',
      'Head of Logistics',
      'General Manager Supply Chain',
    ],
  },
  {
    id: 'human-resources',
    match: /\b(hr|human resources?|people|chro)\b/,
    equivalents: [
      'CHRO',
      'Chief Human Resources Officer',
      'Head of HR',
      'HR Head',
      'VP HR',
      'Director HR',
      'Head of People',
    ],
  },
  {
    id: 'finance',
    match: /\b(cfo|finance|financial|accounts|controller)\b/,
    equivalents: [
      'CFO',
      'Chief Financial Officer',
      'Head of Finance',
      'Finance Head',
      'VP Finance',
      'Director Finance',
      'Financial Controller',
    ],
  },
  {
    id: 'sales-leadership',
    match: /\b(sales|revenue|cro|commercial)\b/,
    equivalents: [
      'Head of Sales',
      'Sales Head',
      'VP Sales',
      'Sales Director',
      'National Sales Head',
      'Chief Revenue Officer',
      'CRO',
    ],
  },
];

const MAX_EQUIVALENTS_PER_ROLE = 8;

const LEADERSHIP_WORD =
  /\b(vp|vice president|head|director|chief|president|general manager|gm|manager|lead|leader|coo|cfo|cto|chro|cro)\b/;
const LEADERSHIP_ACRONYMS = new Set(['coo', 'cfo', 'cto', 'chro', 'cro']);

// The synonyms one role picks up from its family, with the typed role first
export const expandRoleWithFamilyFallback = (role: string): string[] => {
  const lowered = role.trim().toLowerCase();
  const family = TITLE_FAMILY_FALLBACKS.find((entry) =>
    entry.match.test(lowered),
  );

  if (family === undefined) {
    return [role];
  }

  // A bare function word ("operations", "finance") is not a leadership role
  if (!LEADERSHIP_WORD.test(lowered) && !LEADERSHIP_ACRONYMS.has(lowered)) {
    return [role];
  }

  return [role, ...family.equivalents.slice(0, MAX_EQUIVALENTS_PER_ROLE)];
};

// Every family equivalent for a list of roles, in order, without duplicates
export const titleFamilyFallbackTitles = (roles: string[]): string[] => {
  const seen = new Set<string>();

  for (const role of roles) {
    for (const title of expandRoleWithFamilyFallback(role)) {
      seen.add(title);
    }
  }

  return [...seen];
};
