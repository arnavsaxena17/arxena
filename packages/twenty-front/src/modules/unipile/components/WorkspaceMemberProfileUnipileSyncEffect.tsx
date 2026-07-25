import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { useEffect } from 'react';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { findWorkspaceMemberProfiles } from 'twenty-shared/graphql';

import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';

import { orgChartLinkedinCandidateSourceState } from '@/orgchart/states/orgChartLinkedInCandidateSourceState';

import { workspaceMemberProfileUnipileFieldsState } from '../states/workspaceMemberProfileUnipileFieldsState';
import { ARX_UNIPILE_ACCOUNTS_REFRESHED_EVENT } from '../utils/applyInferredOrgChartLinkedinSearchType';

export const FIND_WORKSPACE_MEMBER_PROFILES_FOR_UNIPILE = gql`
  ${findWorkspaceMemberProfiles}
`;

export const WorkspaceMemberProfileUnipileSyncEffect = () => {
  const apolloCoreClient = useApolloCoreClient();
  const currentWorkspaceMember = useAtomStateValue(currentWorkspaceMemberState);
  const setProfileFields = useSetAtomState(
    workspaceMemberProfileUnipileFieldsState,
  );
  const setOrgChartLinkedinCandidateSource = useSetAtomState(
    orgChartLinkedinCandidateSourceState,
  );
  const workspaceMemberId = currentWorkspaceMember?.id;

  // Workspace object records are on /graphql, not the default /metadata client
  const { data, refetch } = useQuery(FIND_WORKSPACE_MEMBER_PROFILES_FOR_UNIPILE, {
    client: apolloCoreClient,
    variables: {
      filter: workspaceMemberId
        ? { workspaceMemberId: { eq: workspaceMemberId } }
        : {},
      limit: 1,
    },
    skip: !workspaceMemberId,
    fetchPolicy: 'cache-and-network',
  });

  useEffect(() => {
    const onAccountsRefreshed = () => {
      if (!workspaceMemberId) {
        return;
      }
      void refetch();
    };

    window.addEventListener(
      ARX_UNIPILE_ACCOUNTS_REFRESHED_EVENT,
      onAccountsRefreshed,
    );
    return () => {
      window.removeEventListener(
        ARX_UNIPILE_ACCOUNTS_REFRESHED_EVENT,
        onAccountsRefreshed,
      );
    };
  }, [refetch, workspaceMemberId]);

  useEffect(() => {
    if (!workspaceMemberId) {
      setProfileFields(null);
    }
  }, [workspaceMemberId, setProfileFields]);

  useEffect(() => {
    const node = data?.workspaceMemberProfiles?.edges?.[0]?.node;
    if (!node) {
      setProfileFields(null);
      return;
    }
    setProfileFields({
      phoneNumber: node.phoneNumber ?? null,
      linkedinUrl: node.linkedinUrl ?? null,
      whatsappUnipileAccountId: node.whatsappUnipileAccountId ?? null,
      linkedinUnipileAccountId: node.linkedinUnipileAccountId ?? null,
    });
    const linkedinUnipileId = node.linkedinUnipileAccountId?.trim() ?? '';
    console.log('Not setting org chart source to unipile')
    // if (linkedinUnipileId !== '') {
    //   setOrgChartLinkedinCandidateSource('unipile');
    // }
  }, [data, setOrgChartLinkedinCandidateSource, setProfileFields]);

  return null;
};
