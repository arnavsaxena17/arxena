import { createState } from 'twenty-ui';

import { LinkedInSearchType } from 'twenty-shared';

export type LinkedinUnipileOwnerProfileCache = {
  accountId: string;
  inferredSearchType: LinkedInSearchType;
  salesNavigatorAvailable: boolean;
  recruiterAvailable: boolean;
  fetchedAt: number;
};

/** Session cache for Unipile `users/me` — cleared on full page reload. */
export const linkedinUnipileOwnerProfileCacheState =
  createState<LinkedinUnipileOwnerProfileCache | null>({
    key: 'linkedinUnipileOwnerProfileCacheState',
    defaultValue: null,
  });
