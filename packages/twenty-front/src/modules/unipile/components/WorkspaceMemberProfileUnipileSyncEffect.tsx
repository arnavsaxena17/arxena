import { gql, useQuery } from '@apollo/client';
import { useEffect } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { findWorkspaceMemberProfiles } from 'twenty-shared';

import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';

import { workspaceMemberProfileUnipileFieldsState } from '../states/workspaceMemberProfileUnipileFieldsState';

const FIND_WORKSPACE_MEMBER_PROFILES_FOR_UNIPILE = gql`
  ${findWorkspaceMemberProfiles}
`;

export const WorkspaceMemberProfileUnipileSyncEffect = () => {
  const currentWorkspaceMember = useRecoilValue(currentWorkspaceMemberState);
  const setProfileFields = useSetRecoilState(
    workspaceMemberProfileUnipileFieldsState,
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
  }, [data, setProfileFields]);

  return null;
};
