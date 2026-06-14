import { tokenPairState } from '@/auth/states/tokenPairState';
import { linkedinUnipileAccountsState } from '@/linkedin-unipile/states/linkedinUnipileAccountsState';
import { linkedinUnipileOwnerProfileCacheState } from '@/orgchart/states/linkedinUnipileOwnerProfileCacheState';
import { orgChartLinkedinCandidateSourceState } from '@/orgchart/states/orgChartLinkedInCandidateSourceState';
import { orgChartLinkedInSearchTypeState } from '@/orgchart/states/orgChartLinkedInSearchTypeState';
import { workspaceMemberProfileUnipileFieldsState } from '@/unipile/states/workspaceMemberProfileUnipileFieldsState';
import { useEffect, useRef } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import {
    inferLinkedInSearchTypeFromUnipileOwnerProfile,
    resolveLinkedinUnipileAccountIdForWorkspaceMember,
    type LinkedInSearchType,
    type UnipileAccountOwnerProfile,
} from 'twenty-shared';

import { getLinkedinService } from '~/pages/settings/linkedin/services/linkedin-backend.service';

import { useUnipile } from '../contexts/UnipileContext';

/**
 * When org chart data source is LinkedIn (Unipile), fetches `users/me` once per
 * account id per session and auto-sets LinkedIn search type. User overrides in
 * the jobs menu apply for the rest of the session only; a full reload re-detects.
 */
export const OrgChartLinkedinSearchTypeSyncEffect = () => {
  const tokenPair = useRecoilValue(tokenPairState);
  const accessToken = tokenPair?.accessToken?.token ?? '';
  const orgChartLinkedinCandidateSource = useRecoilValue(
    orgChartLinkedinCandidateSourceState,
  );
  const workspaceMemberProfileUnipileFields = useRecoilValue(
    workspaceMemberProfileUnipileFieldsState,
  );
  const linkedinUnipileAccounts = useRecoilValue(linkedinUnipileAccountsState);
  const ownerProfileCache = useRecoilValue(linkedinUnipileOwnerProfileCacheState);
  const setOrgChartLinkedInSearchType = useSetRecoilState(
    orgChartLinkedInSearchTypeState,
  );
  const setOwnerProfileCache = useSetRecoilState(
    linkedinUnipileOwnerProfileCacheState,
  );
  const { lastUpdated } = useUnipile();
  const inFlightAccountIdRef = useRef<string | null>(null);
  const lastAutoAppliedAccountIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (orgChartLinkedinCandidateSource !== 'unipile') {
      return;
    }
    if (!accessToken) {
      return;
    }

    const accountId = resolveLinkedinUnipileAccountIdForWorkspaceMember(
      workspaceMemberProfileUnipileFields,
      linkedinUnipileAccounts,
    );
    if (!accountId) {
      console.log(
        '[OrgChartLinkedinSearchTypeSyncEffect] No LinkedIn Unipile account id; skipping users/me',
      );
      return;
    }

    const applyInferredSearchType = (inferredSearchType: LinkedInSearchType) => {
      setOrgChartLinkedInSearchType(inferredSearchType);
      lastAutoAppliedAccountIdRef.current = accountId;
    };

    if (lastAutoAppliedAccountIdRef.current === accountId) {
      return;
    }

    if (
      ownerProfileCache?.accountId === accountId &&
      ownerProfileCache.inferredSearchType
    ) {
      applyInferredSearchType(ownerProfileCache.inferredSearchType);
      return;
    }

    if (inFlightAccountIdRef.current === accountId) {
      return;
    }

    inFlightAccountIdRef.current = accountId;
    const linkedinService = getLinkedinService();

    void (async () => {
      try {
        console.log(
          `[OrgChartLinkedinSearchTypeSyncEffect] Fetching users/me for account ${accountId}`,
        );
        const profile = (await linkedinService.getOwnProfile(
          accountId,
          accessToken,
        )) as UnipileAccountOwnerProfile;
        const inferredSearchType =
          inferLinkedInSearchTypeFromUnipileOwnerProfile(profile);
        const nextCache = {
          accountId,
          inferredSearchType,
          salesNavigatorAvailable: profile.sales_navigator != null,
          recruiterAvailable: profile.recruiter != null,
          fetchedAt: Date.now(),
        };
        console.log(
          `[OrgChartLinkedinSearchTypeSyncEffect] Inferred search type: ${inferredSearchType}`,
          nextCache,
        );
        setOwnerProfileCache(nextCache);
        applyInferredSearchType(inferredSearchType);
      } catch (error) {
        console.error(
          '[OrgChartLinkedinSearchTypeSyncEffect] Failed to fetch users/me:',
          error,
        );
      } finally {
        if (inFlightAccountIdRef.current === accountId) {
          inFlightAccountIdRef.current = null;
        }
      }
    })();
  }, [
    accessToken,
    lastUpdated,
    linkedinUnipileAccounts,
    orgChartLinkedinCandidateSource,
    ownerProfileCache,
    setOrgChartLinkedInSearchType,
    setOwnerProfileCache,
    workspaceMemberProfileUnipileFields,
  ]);

  return null;
};
