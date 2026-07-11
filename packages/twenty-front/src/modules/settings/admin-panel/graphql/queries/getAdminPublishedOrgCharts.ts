import { gql } from '@apollo/client';

export const GET_ADMIN_PUBLISHED_ORG_CHARTS = gql`
  query GetAdminPublishedOrgCharts {
    adminPublishedOrgCharts {
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
