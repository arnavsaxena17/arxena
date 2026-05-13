import { gql, useQuery } from '@apollo/client';
import { useEffect } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { findWorkspaceMemberProfiles } from 'twenty-shared';

import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';

import { orgChartLinkedinCandidateSourceState } from '@/orgchart/states/orgChartLinkedInCandidateSourceState';

import { workspaceMemberProfileUnipileFieldsState } from '../states/workspaceMemberProfileUnipileFieldsState';

export const FIND_WORKSPACE_MEMBER_PROFILES_FOR_UNIPILE = gql`
  ${findWorkspaceMemberProfiles}
`;

export const WorkspaceMemberProfileUnipileSyncEffect = () => {
  const currentWorkspaceMember = useRecoilValue(currentWorkspaceMemberState);
  const setProfileFields = useSetRecoilState(
    workspaceMemberProfileUnipileFieldsState,
  );
  const setOrgChartLinkedinCandidateSource = useSetRecoilState(
    orgChartLinkedinCandidateSourceState,
  );
  const workspaceMemberId = currentWorkspaceMember?.id;

  const { data } = useQuery(FIND_WORKSPACE_MEMBER_PROFILES_FOR_UNIPILE, {
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
