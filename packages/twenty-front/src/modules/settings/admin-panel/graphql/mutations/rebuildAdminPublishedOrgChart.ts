import { gql } from '@apollo/client';

export const REBUILD_ADMIN_PUBLISHED_ORG_CHART = gql`
  mutation RebuildAdminPublishedOrgChart(
    $input: RebuildAdminPublishedOrgChartInput!
  ) {
    rebuildAdminPublishedOrgChart(input: $input) {
      publishSlug
      companyId
      companyName
      companyLinkedinUrl
      companyWebsite
      industry
      country
      countOrg
      publishedAt
      workspaceId
      hasOrgChartInS3
      s3RelativePath
    }
  }
`;
