import type { OrgChartNodeData } from 'twenty-shared';

export type OrgChartContextAction =
  | 'current_node'
  | 'leadership'
  | 'entire_company'
  | 'delete_company_cache'
  | 'function_grade'
  | 'business_division_map'
  | 'selected_nodes'
  | 'boolean_keywords'
  | 'similar_companies'
  | 'add_to_job_and_send_invite'
  | 'add_to_job_and_invite_to_job';

export type OrgChartDiagramIconUrls = {
  lock?: string;
  linkedin?: string;
  download?: string;
  similarItems?: string;
};

/** Extra context for context-menu actions (e.g. all diagram-selected nodes for `selected_nodes`). */
export type OrgChartNodeContextPayload = {
  /** Each node contributes its own `std_function` / `std_grade` for backend scope filtering. */
  selectedNodes?: OrgChartNodeData[];
};

export type OrgChartDiagramProps = {
  nodeDataArray: OrgChartNodeData[];
  iconUrls?: OrgChartDiagramIconUrls;
  /** URL for default avatar when node has no image. Use local path (e.g. /img/default-avatar.jpg) to avoid external requests from crawlers. */
  defaultAvatarUrl?: string;
  onDiagramReady?: (handle: OrgChartDiagramHandle) => void;
  onNodeContextAction?: (
    action: OrgChartContextAction,
    node: OrgChartNodeData,
    payload?: OrgChartNodeContextPayload,
  ) => void;
  onBackgroundContextAction?: (action: OrgChartContextAction) => void;
  onNodeClick?: (node: OrgChartNodeData) => void;
  onNodeDoubleClick?: (node: OrgChartNodeData) => void;
  onDownloadNode?: (node: OrgChartNodeData) => void;
  onSimilarPeople?: (node: OrgChartNodeData) => void;
  /** Experimental: show a hover tooltip on each node describing outreach capabilities. */
  showNodeCapabilitiesHoverHint?: boolean;
  /** Company name for personalized hover copy (e.g. "These are the … at Acme."). */
  nodeCapabilitiesHoverCompanyName?: string;
};

export type OrgChartDiagramHandle = {
  search: (keyword: string) => number;
  focusNextResult: () => void;
  focusPreviousResult: () => void;
  clearSearch: () => void;
  getSearchResultCount: () => number;
  zoomToFit: () => void;
  centerContent: () => void;
};
