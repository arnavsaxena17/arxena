import { gql } from '@apollo/client';

export const ADD_ADMIN_PUBLISHED_ORG_CHART_ALIAS = gql`
  mutation AddAdminPublishedOrgChartAlias(
    $input: AddAdminPublishedOrgChartAliasInput!
  ) {
    addAdminPublishedOrgChartAlias(input: $input) {
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

export const RENAME_ADMIN_PUBLISHED_ORG_CHART_SLUG = gql`
  mutation RenameAdminPublishedOrgChartSlug(
    $input: RenameAdminPublishedOrgChartSlugInput!
  ) {
    renameAdminPublishedOrgChartSlug(input: $input) {
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

export const DELETE_ADMIN_PUBLISHED_ORG_CHART_SLUG = gql`
  mutation DeleteAdminPublishedOrgChartSlug($publishSlug: String!) {
    deleteAdminPublishedOrgChartSlug(publishSlug: $publishSlug)
  }
`;
