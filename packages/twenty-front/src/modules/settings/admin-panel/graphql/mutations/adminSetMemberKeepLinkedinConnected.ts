import { gql } from '@apollo/client';

export const ADMIN_SET_MEMBER_KEEP_LINKEDIN_CONNECTED = gql`
  mutation AdminSetMemberKeepLinkedinConnected(
    $workspaceId: String!
    $workspaceMemberId: String!
    $keepLinkedinConnected: Boolean!
  ) {
    adminSetMemberKeepLinkedinConnected(
      workspaceId: $workspaceId
      workspaceMemberId: $workspaceMemberId
      keepLinkedinConnected: $keepLinkedinConnected
    )
  }
`;
