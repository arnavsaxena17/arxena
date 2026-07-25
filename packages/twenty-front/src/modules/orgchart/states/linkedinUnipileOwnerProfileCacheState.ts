import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';
import type { LinkedInSearchType } from 'twenty-shared/types';

export type LinkedinUnipileOwnerProfileCache = {
  accountId: string;
  inferredSearchType: LinkedInSearchType;
  salesNavigatorAvailable: boolean;
  recruiterAvailable: boolean;
  fetchedAt: number;
};

/** Session cache for Unipile `users/me` — cleared on full page reload. */
export const linkedinUnipileOwnerProfileCacheState =
  createAtomState<LinkedinUnipileOwnerProfileCache | null>({
    key: 'linkedinUnipileOwnerProfileCacheState',
    defaultValue: null,
  });
