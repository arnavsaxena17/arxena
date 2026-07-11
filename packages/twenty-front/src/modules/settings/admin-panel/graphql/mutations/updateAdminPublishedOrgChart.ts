import { gql } from '@apollo/client';

export const UPDATE_ADMIN_PUBLISHED_ORG_CHART = gql`
  mutation UpdateAdminPublishedOrgChart(
    $input: UpdateAdminPublishedOrgChartInput!
  ) {
    updateAdminPublishedOrgChart(input: $input) {
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
