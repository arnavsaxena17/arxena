import { gql } from '@apollo/client';

export const GET_ADMIN_LINKEDIN_PARAMETER_CACHE_ENTRIES = gql`
  query GetAdminLinkedinParameterCacheEntries {
    adminLinkedinParameterCacheEntries {
      cacheKey
      parameterType
      searchTerm
      linkedinId
      linkedinTitle
      notFound
    }
  }
`;
