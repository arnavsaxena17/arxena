import { gql } from '@apollo/client';

export const ADMIN_GRANT_ORG_CHART_TO_WORKSPACE = gql`
  mutation AdminGrantOrgChartToWorkspace(
    $input: AdminGrantOrgChartToWorkspaceInput!
  ) {
    adminGrantOrgChartToWorkspace(input: $input) {
      workspaceId
      companyId
      orgChartS3RelativePath
      alreadyHadAccess
      accessGranted
      chargedCredits
      orgChartRecordId
      projectName
      projectCreated
      itemCount
      companyName
    }
  }
`;
