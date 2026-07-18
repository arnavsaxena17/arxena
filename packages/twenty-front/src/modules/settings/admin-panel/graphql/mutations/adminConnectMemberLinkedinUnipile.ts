import { gql } from '@apollo/client';

export const ADMIN_CONNECT_MEMBER_LINKEDIN_UNIPILE = gql`
  mutation AdminConnectMemberLinkedinUnipile(
    $workspaceId: String!
    $workspaceMemberId: String!
  ) {
    adminConnectMemberLinkedinUnipile(
      workspaceId: $workspaceId
      workspaceMemberId: $workspaceMemberId
    ) {
      attempted
      connected
      keepConnected
      hasLiAt
      hasLiA
      lastSyncedAt
      lastValidatedAt
      message
      errorCode
      reconnectAttempted
      reconnectSucceeded
      accountId
      accountStatus
    }
  }
`;
