import type { LinkedInSearchType } from '../types/CandidateSearchTypes';

export type UnipileLinkedinProductSeat = {
  contract_id?: string;
  owner_seat_id?: string;
};

/** Shape of Unipile `GET /api/v1/users/me` for LinkedIn accounts. */
export type UnipileAccountOwnerProfile = {
  public_identifier?: string;
  sales_navigator?: UnipileLinkedinProductSeat | null;
  recruiter?: UnipileLinkedinProductSeat | null;
};

/**
 * Infer which LinkedIn product to use for org-chart / people search.
 * Priority: Sales Navigator → Recruiter → Classic.
 */
export const inferLinkedInSearchTypeFromUnipileOwnerProfile = (
  profile: UnipileAccountOwnerProfile,
): LinkedInSearchType => {
  if (profile.sales_navigator != null) {
    return 'sales_navigator';
  }
  if (profile.recruiter != null) {
    return 'recruiter';
  }
  return 'classic';
};

/** Higher score = prefer keeping this Unipile account when duplicates share the same LinkedIn identity. */
export const scoreLinkedinUnipileOwnerProfileCapability = (
  profile: UnipileAccountOwnerProfile,
): number => {
  let score = 0;
  if (profile.sales_navigator != null) {
    score += 2;
  }
  if (profile.recruiter != null) {
    score += 1;
  }
  return score;
};
