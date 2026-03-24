import { gql } from '@apollo/client';

export const GET_ADMIN_WORKSPACES_WITH_CREDITS = gql`
  query GetAdminWorkspacesWithCredits {
    adminListWorkspacesWithCredits {
      workspaceId
      workspaceCreatedAt
      workspaceName
      workspaceCreatorEmail
      orgChartCredits
      emailContactCredits
      phoneContactCredits
    }
  }
`;
