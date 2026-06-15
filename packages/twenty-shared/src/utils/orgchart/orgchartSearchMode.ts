/**
 * Canonical org-chart LinkedIn search API `mode` values (NestJS org-chart search,
 * Python `search_data.UNIPILE_ORCHART_CONTEXT_MAP`, E2E pipeline/matrix tests).
 */
export const ORG_CHART_SEARCH_MODES = [
  'current_node',
  'leadership',
  'entire_company',
  'function_grade',
  'business_division_map',
  'selected_nodes',
  'super_impose',
] as const;

export type OrgchartSearchMode = (typeof ORG_CHART_SEARCH_MODES)[number];
