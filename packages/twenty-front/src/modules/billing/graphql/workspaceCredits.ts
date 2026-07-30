import { gql } from '@apollo/client';

export const WORKSPACE_CREDITS = gql`
  query WorkspaceCredits {
    workspaceCredits {
      orgChartCredits
      revealCredits
      apiCredits
      revealCreditsAsEmailEquivalent
      revealCreditsAsPhoneEquivalent
      emailRevealCost
      phoneRevealCost
    }
  }
`;
