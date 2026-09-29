import { gql } from '@apollo/client';

export const ADMIN_REQUEST_MEMBER_LINKEDIN_COOKIE_FETCH = gql`
  mutation AdminRequestMemberLinkedinCookieFetch(
    $workspaceId: String!
    $workspaceMemberId: String!
  ) {
    adminRequestMemberLinkedinCookieFetch(
      workspaceId: $workspaceId
      workspaceMemberId: $workspaceMemberId
    ) {
      status
      deadlineAt
    }
  }
`;
