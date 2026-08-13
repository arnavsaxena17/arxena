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
  const linkedinUnipileOwnerProfileCache = useAtomStateValue(linkedinUnipileOwnerProfileCacheState);
  const setOrgChartLinkedInSearchType = useSetAtomState(
    orgChartLinkedInSearchTypeState,
  );
  const setLinkedinUnipileOwnerProfileCache = useSetAtomState(
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
      linkedinUnipileOwnerProfileCache?.accountId === accountId &&
      Boolean(linkedinUnipileOwnerProfileCache.inferredSearchType);

    if (cacheHasInferredType && linkedinUnipileOwnerProfileCache?.inferredSearchType) {
      applyInferredOrgChartLinkedinSearchType({
        payload: {
          accountId,
          inferredSearchType: linkedinUnipileOwnerProfileCache.inferredSearchType,
          salesNavigatorAvailable: linkedinUnipileOwnerProfileCache.salesNavigatorAvailable,
          recruiterAvailable: linkedinUnipileOwnerProfileCache.recruiterAvailable,
          fetchedAt: linkedinUnipileOwnerProfileCache.fetchedAt,
        },
        setOrgChartLinkedInSearchType,
        setOwnerProfileCache: setLinkedinUnipileOwnerProfileCache,
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
          setOwnerProfileCache: setLinkedinUnipileOwnerProfileCache,
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
    linkedinUnipileOwnerProfileCache,
    setOrgChartLinkedInSearchType,
    setLinkedinUnipileOwnerProfileCache,
    workspaceMemberProfileUnipileFields,
  ]);

  return null;
};
