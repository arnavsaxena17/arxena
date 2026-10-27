import {
  inferLinkedInSearchTypeFromUnipileOwnerProfile,
  parseWorkspaceMemberLinkedinProfile,
  type LinkedInSearchType,
} from 'twenty-shared';

export type LinkedinSearchCategory = 'people' | 'companies';

export const LINKEDIN_SEARCH_MODES: readonly LinkedInSearchType[] = [
  'classic',
  'sales_navigator',
  'recruiter',
];

// Unipile has no Recruiter company search; a Recruiter seat searches
// companies through classic.
const MODES_BY_CATEGORY: Record<
  LinkedinSearchCategory,
  readonly LinkedInSearchType[]
> = {
  people: ['classic', 'sales_navigator', 'recruiter'],
  companies: ['classic', 'sales_navigator'],
};

export type LinkedinSearchModeAvailability = {
  // false when no stored profile matches the account (a pool or another
  // member's account): every mode is allowed and the caller's choice stands
  known: boolean;
  available: LinkedInSearchType[];
  defaultMode: LinkedInSearchType;
};

export type LinkedinSearchModeResolution =
  | {
      ok: true;
      mode: LinkedInSearchType;
      availability: LinkedinSearchModeAvailability;
    }
  | {
      ok: false;
      requested: LinkedInSearchType;
      availability: LinkedinSearchModeAvailability;
    };

export const isLinkedinSearchMode = (
  value: unknown,
): value is LinkedInSearchType =>
  typeof value === 'string' &&
  (LINKEDIN_SEARCH_MODES as readonly string[]).includes(value);

export const getLinkedinSearchModeAvailability = (
  linkedinProfile: unknown,
  category: LinkedinSearchCategory,
): LinkedinSearchModeAvailability => {
  const categoryModes = MODES_BY_CATEGORY[category];
  const owner = parseWorkspaceMemberLinkedinProfile(linkedinProfile)?.me;

  if (!owner) {
    return {
      known: false,
      available: [...categoryModes],
      defaultMode: 'classic',
    };
  }

  const seats: LinkedInSearchType[] = [
    'classic',
    ...(owner.sales_navigator != null ? (['sales_navigator'] as const) : []),
    ...(owner.recruiter != null ? (['recruiter'] as const) : []),
  ];
  const available = seats.filter((mode) => categoryModes.includes(mode));
  const inferred = inferLinkedInSearchTypeFromUnipileOwnerProfile(owner);

  return {
    known: true,
    available,
    defaultMode: available.includes(inferred) ? inferred : 'classic',
  };
};

export const resolveLinkedinSearchMode = ({
  requested,
  linkedinProfile,
  category,
}: {
  requested?: LinkedInSearchType;
  linkedinProfile: unknown;
  category: LinkedinSearchCategory;
}): LinkedinSearchModeResolution => {
  const availability = getLinkedinSearchModeAvailability(
    linkedinProfile,
    category,
  );

  if (requested === undefined) {
    return { ok: true, mode: availability.defaultMode, availability };
  }

  if (!availability.available.includes(requested)) {
    return { ok: false, requested, availability };
  }

  return { ok: true, mode: requested, availability };
};

export const formatUnavailableLinkedinSearchModeMessage = (
  requested: LinkedInSearchType,
  category: LinkedinSearchCategory,
  availability: LinkedinSearchModeAvailability,
): string =>
  `searchType "${requested}" is not available for ${category} search on this LinkedIn account. ` +
  `Available: ${availability.available.join(', ')}. ` +
  `Omit searchType to use ${availability.defaultMode}.`;
