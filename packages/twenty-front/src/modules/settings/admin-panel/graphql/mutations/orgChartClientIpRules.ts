import { gql } from '@apollo/client';

export const UPSERT_ORG_CHART_CLIENT_IP_RULE = gql`
  mutation UpsertOrgChartClientIpRule($input: UpsertOrgChartClientIpRuleInput!) {
    upsertOrgChartClientIpRule(input: $input) {
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

export const DELETE_ORG_CHART_CLIENT_IP_RULE = gql`
  mutation DeleteOrgChartClientIpRule($id: String!) {
    deleteOrgChartClientIpRule(id: $id)
  }
`;

export const RESET_ORG_CHART_CLIENT_IP_RULE_COUNTERS = gql`
  mutation ResetOrgChartClientIpRuleCounters($id: String!) {
    resetOrgChartClientIpRuleCounters(id: $id)
  }
`;
