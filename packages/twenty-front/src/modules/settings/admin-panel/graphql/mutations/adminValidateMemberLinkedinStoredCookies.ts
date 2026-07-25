import { gql } from '@apollo/client';

export const ADMIN_VALIDATE_MEMBER_LINKEDIN_STORED_COOKIES = gql`
  mutation AdminValidateMemberLinkedinStoredCookies(
    $workspaceId: String!
    $workspaceMemberId: String!
  ) {
    adminValidateMemberLinkedinStoredCookies(
      workspaceId: $workspaceId
      workspaceMemberId: $workspaceMemberId
    ) {
      attempted
      connected
      disconnectedAfterValidation
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
