import type { SetterOrUpdater } from 'recoil';
import type { LinkedInSearchType } from 'twenty-shared';

import type { LinkedinUnipileOwnerProfileCache } from '@/orgchart/states/linkedinUnipileOwnerProfileCacheState';

export type LinkedinUnipileInferredSearchTypePayload = {
  accountId?: string | null;
  inferredSearchType?: LinkedInSearchType | null;
  salesNavigatorAvailable?: boolean;
  recruiterAvailable?: boolean;
  /** Align with Unipile refresh timestamp so downstream effects do not re-fetch users/me. */
  fetchedAt?: number;
};

export const applyInferredOrgChartLinkedinSearchType = (options: {
  payload: LinkedinUnipileInferredSearchTypePayload;
  setOrgChartLinkedInSearchType: SetterOrUpdater<LinkedInSearchType>;
  setOwnerProfileCache: SetterOrUpdater<LinkedinUnipileOwnerProfileCache | null>;
}): boolean => {
  const { payload, setOrgChartLinkedInSearchType, setOwnerProfileCache } =
    options;
  const accountId = payload.accountId?.trim();
  const inferredSearchType = payload.inferredSearchType;

  if (!accountId || !inferredSearchType) {
    return false;
  }

  const salesNavigatorAvailable = Boolean(payload.salesNavigatorAvailable);
  const recruiterAvailable = Boolean(payload.recruiterAvailable);

  let didApply = false;

  setOrgChartLinkedInSearchType((currentSearchType) => {
    if (currentSearchType === inferredSearchType) {
      return currentSearchType;
    }
    didApply = true;
    return inferredSearchType;
  });

  setOwnerProfileCache((currentCache) => {
    if (
      currentCache?.accountId === accountId &&
      currentCache.inferredSearchType === inferredSearchType &&
      currentCache.salesNavigatorAvailable === salesNavigatorAvailable &&
      currentCache.recruiterAvailable === recruiterAvailable
    ) {
      return currentCache;
    }
    didApply = true;
    return {
      accountId,
      inferredSearchType,
      salesNavigatorAvailable,
      recruiterAvailable,
      fetchedAt: payload.fetchedAt ?? Date.now(),
    };
  });

  if (didApply) {
    console.log(
      `[applyInferredOrgChartLinkedinSearchType] Applying ${inferredSearchType} for account ${accountId}`,
    );
  }

  return didApply;
};

export const ARX_UNIPILE_ACCOUNTS_REFRESHED_EVENT =
  'arx:unipile-accounts-refreshed' as const;

export const dispatchUnipileAccountsRefreshedEvent = (): void => {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent(ARX_UNIPILE_ACCOUNTS_REFRESHED_EVENT));
};
