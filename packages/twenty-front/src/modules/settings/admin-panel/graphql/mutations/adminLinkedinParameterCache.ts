import { gql } from '@apollo/client';

export const DELETE_ADMIN_LINKEDIN_PARAMETER_CACHE_ENTRY = gql`
  mutation DeleteAdminLinkedinParameterCacheEntry($cacheKey: String!) {
    adminDeleteLinkedinParameterCacheEntry(cacheKey: $cacheKey)
  }
`;

export const CLEAR_ADMIN_LINKEDIN_PARAMETER_CACHE = gql`
  mutation ClearAdminLinkedinParameterCache {
    adminClearLinkedinParameterCache
  }
`;
