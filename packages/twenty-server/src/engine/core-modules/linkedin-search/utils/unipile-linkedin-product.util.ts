import {
  inferLinkedInSearchTypeFromUnipileOwnerProfile,
  parseWorkspaceMemberLinkedinProfile,
} from 'twenty-shared';

export type UnipileLinkedinProduct = 'classic' | 'sales_navigator' | 'recruiter';

export const inferUnipileLinkedinProduct = (
  linkedinProfile: unknown,
): UnipileLinkedinProduct => {
  const stored = parseWorkspaceMemberLinkedinProfile(linkedinProfile);

  if (!stored?.me) {
    return 'classic';
  }

  return inferLinkedInSearchTypeFromUnipileOwnerProfile(stored.me);
};
