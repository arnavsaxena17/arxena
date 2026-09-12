import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { useEffect } from 'react';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { findWorkspaceMembersForArx } from 'twenty-shared/graphql';
import {
  parseWorkspaceMemberUnipileFields,
  workspaceMemberFilterById,
  type WorkspaceMembersApolloData,
} from 'twenty-shared/utils';

import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';

import { orgChartLinkedinCandidateSourceState } from '@/orgchart/states/orgChartLinkedInCandidateSourceState';

import { workspaceMemberUnipileFieldsState } from '../states/workspaceMemberUnipileFieldsState';
import { ARX_UNIPILE_ACCOUNTS_REFRESHED_EVENT } from '../utils/applyInferredOrgChartLinkedinSearchType';

export const FIND_WORKSPACE_MEMBERS_FOR_UNIPILE = gql`
  ${findWorkspaceMembersForArx}
`;

export const WorkspaceMemberUnipileSyncEffect = () => {
  const apolloCoreClient = useApolloCoreClient();
  const currentWorkspaceMember = useAtomStateValue(currentWorkspaceMemberState);
  const setWorkspaceMemberUnipileFields = useSetAtomState(
    workspaceMemberUnipileFieldsState,
  );
  const setOrgChartLinkedinCandidateSource = useSetAtomState(
    orgChartLinkedinCandidateSourceState,
  );
  const workspaceMemberId = currentWorkspaceMember?.id;

  const { data, refetch } = useQuery<WorkspaceMembersApolloData>(
    FIND_WORKSPACE_MEMBERS_FOR_UNIPILE,
    {
    client: apolloCoreClient,
    variables: workspaceMemberId
      ? workspaceMemberFilterById(workspaceMemberId)
      : { limit: 1 },
    skip: !workspaceMemberId,
    fetchPolicy: 'cache-and-network',
    },
  );

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
      setWorkspaceMemberUnipileFields(null);
    }
  }, [workspaceMemberId, setWorkspaceMemberUnipileFields]);

  useEffect(() => {
    const node = data?.workspaceMembers?.edges?.[0]?.node;
    setWorkspaceMemberUnipileFields(
      parseWorkspaceMemberUnipileFields(node ?? null),
    );
    const linkedinUnipileId = node?.linkedinUnipileAccountId?.trim() ?? '';
    console.log('Not setting org chart source to unipile');
    // if (linkedinUnipileId !== '') {
    //   setOrgChartLinkedinCandidateSource('unipile');
    // }
  }, [
    data,
    setOrgChartLinkedinCandidateSource,
    setWorkspaceMemberUnipileFields,
  ]);

  return null;
};
