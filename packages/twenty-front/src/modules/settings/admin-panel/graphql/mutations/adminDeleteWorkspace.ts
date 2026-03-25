import { gql } from '@apollo/client';

export const ADMIN_DELETE_WORKSPACE = gql`
  mutation AdminDeleteWorkspace($workspaceId: String!) {
    adminDeleteWorkspace(workspaceId: $workspaceId)
  }
`;
