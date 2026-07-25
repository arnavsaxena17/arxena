import { tokenPairState } from '@/auth/states/tokenPairState';
import { linkedinUnipileAccountsState } from '@/linkedin-unipile/states/linkedinUnipileAccountsState';
import { linkedinUnipileOwnerProfileCacheState } from '@/orgchart/states/linkedinUnipileOwnerProfileCacheState';
import { orgChartLinkedinCandidateSourceState } from '@/orgchart/states/orgChartLinkedInCandidateSourceState';
import { orgChartLinkedInSearchTypeState } from '@/orgchart/states/orgChartLinkedInSearchTypeState';
import { workspaceMemberProfileUnipileFieldsState } from '@/unipile/states/workspaceMemberProfileUnipileFieldsState';
import { useEffect, useRef } from 'react';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { inferLinkedInSearchTypeFromUnipileOwnerProfile, resolveLinkedinUnipileAccountIdForWorkspaceMember, type UnipileAccountOwnerProfile } from 'twenty-shared/utils';

import { getLinkedinService } from '~/pages/settings/linkedin/services/linkedin-backend.service';

import { applyInferredOrgChartLinkedinSearchType } from '../utils/applyInferredOrgChartLinkedinSearchType';

/**
 * Fallback when org chart source is Unipile and connection-status did not return
 * inferred search type. UnipileContext normally populates the owner profile cache
 * from connection-status (no extra users/me).
 */
export const OrgChartLinkedinSearchTypeSyncEffect = () => {
  const tokenPair = useAtomStateValue(tokenPairState);
  const accessToken = tokenPair?.accessOrWorkspaceAgnosticToken?.token ?? '';
  const orgChartLinkedinCandidateSource = useAtomStateValue(
    orgChartLinkedinCandidateSourceState,
  );
  const workspaceMemberProfileUnipileFields = useAtomStateValue(
    workspaceMemberProfileUnipileFieldsState,
  );
  const linkedinUnipileAccounts = useAtomStateValue(linkedinUnipileAccountsState);
  const ownerProfileCache = useAtomStateValue(linkedinUnipileOwnerProfileCacheState);
  const setOrgChartLinkedInSearchType = useSetAtomState(
    orgChartLinkedInSearchTypeState,
  );
  const setOwnerProfileCache = useSetAtomState(
    linkedinUnipileOwnerProfileCacheState,
  );
  const inFlightAccountIdRef = useRef<string | null>(null);

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
      return;
    }

    const cacheHasInferredType =
      ownerProfileCache?.accountId === accountId &&
      Boolean(ownerProfileCache.inferredSearchType);

    if (cacheHasInferredType && ownerProfileCache?.inferredSearchType) {
      applyInferredOrgChartLinkedinSearchType({
        payload: {
          accountId,
          inferredSearchType: ownerProfileCache.inferredSearchType,
          salesNavigatorAvailable: ownerProfileCache.salesNavigatorAvailable,
          recruiterAvailable: ownerProfileCache.recruiterAvailable,
          fetchedAt: ownerProfileCache.fetchedAt,
        },
        setOrgChartLinkedInSearchType,
        setOwnerProfileCache,
      });
      return;
    }

    if (inFlightAccountIdRef.current === accountId) {
      return;
    }

    inFlightAccountIdRef.current = accountId;
    const linkedinService = getLinkedinService();

    void (async () => {
      try {
        const profile = (await linkedinService.getOwnProfile(
          accountId,
          accessToken,
        )) as UnipileAccountOwnerProfile;
        const inferredSearchType =
          inferLinkedInSearchTypeFromUnipileOwnerProfile(profile);
        applyInferredOrgChartLinkedinSearchType({
          payload: {
            accountId,
            inferredSearchType,
            salesNavigatorAvailable: profile.sales_navigator != null,
            recruiterAvailable: profile.recruiter != null,
          },
          setOrgChartLinkedInSearchType,
          setOwnerProfileCache,
        });
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
    linkedinUnipileAccounts,
    orgChartLinkedinCandidateSource,
    ownerProfileCache,
    setOrgChartLinkedInSearchType,
    setOwnerProfileCache,
    workspaceMemberProfileUnipileFields,
  ]);

  return null;
};
