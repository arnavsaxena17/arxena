import { gql } from '@apollo/client';

export const WORKSPACE_CREDITS = gql`
  query WorkspaceCredits {
    workspaceCredits {
      orgChartCredits
      revealCredits
      revealCreditsAsEmailEquivalent
      revealCreditsAsPhoneEquivalent
      emailRevealCost
      phoneRevealCost
    }
  }
`;
