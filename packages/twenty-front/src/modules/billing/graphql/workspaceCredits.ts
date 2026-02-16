import { gql } from '@apollo/client';

export const WORKSPACE_CREDITS = gql`
  query WorkspaceCredits {
    workspaceCredits {
      credits
    }
  }
`;
