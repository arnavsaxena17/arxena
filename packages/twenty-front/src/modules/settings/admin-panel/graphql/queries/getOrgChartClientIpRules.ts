import { gql } from '@apollo/client';

export const GET_ORG_CHART_CLIENT_IP_RULES = gql`
  query GetOrgChartClientIpRules {
    orgChartClientIpRules {
      id
      ipAddress
      isBlocked
      serveCachedOnly
      totalRequests
      chartsServed
      lastUserAgent
      createdAt
      updatedAt
    }
  }
`;
