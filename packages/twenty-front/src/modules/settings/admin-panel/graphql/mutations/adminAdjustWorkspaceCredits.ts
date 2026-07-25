import { gql } from '@apollo/client';

export const ADMIN_ADJUST_WORKSPACE_CREDITS = gql`
  mutation AdminAdjustWorkspaceCredits(
    $input: AdminAdjustWorkspaceCreditsInput!
  ) {
    adminAdjustWorkspaceCredits(input: $input)
  }
`;
