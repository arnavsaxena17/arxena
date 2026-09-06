import { gql } from '@apollo/client';

export const GET_ADMIN_ORG_CHART_ARTIFACT = gql`
  query GetAdminOrgChartArtifact($companyId: String!) {
    adminOrgChartArtifact(companyId: $companyId) {
      companyId
      orgChartS3RelativePath
      hasOrgChartInS3
      companyName
      itemCount
    }
  }
`;
