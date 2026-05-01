import type { OrgChartNodeData } from 'twenty-shared';

export type OrgChartContextAction =
  | 'current_node'
  | 'leadership'
  | 'entire_company'
  | 'delete_company_cache'
  | 'rebuild_orgchart_using_saved_people'
  | 'reload_apify_org_intelligence'
  | 'function_grade'
  | 'business_division_map'
  | 'selected_nodes'
  | 'boolean_keywords'
  | 'similar_companies'
  | 'add_to_job_and_send_invite'
  | 'add_to_job_and_invite_to_job'
  /** m7kq slug: contact match — email + phone (org chart) */
  | 'm7kq_fetch_complete'
  /** m7kq slug: contact match — phone only */
  | 'm7kq_fetch_phone'
  /** m7kq slug: contact match — email only */
  | 'm7kq_fetch_email'
  | 'outreach_linkedin_invite'
  | 'outreach_whatsapp'
  | 'outreach_google_contact'
  | 'outreach_email';

export type OrgChartDiagramIconUrls = {
  lock?: string;
  linkedin?: string;
  download?: string;
  similarItems?: string;
  /** m7kq contact strip: mail outline icon (URL or data URL). */
  email?: string;
  /** m7kq contact strip: phone outline icon (URL or data URL). */
  phone?: string;
};

/** Extra context for context-menu actions (e.g. all diagram-selected nodes for `selected_nodes`). */
export type OrgChartNodeContextPayload = {
  /** Each node contributes its own `std_function` / `std_grade` for backend scope filtering. */
  selectedNodes?: OrgChartNodeData[];
  /** Person row index 0–3 for outreach when a node shows multiple people. */
  personSlot?: number;
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
  /** When the org chart uses the m7kq channel, show contact hints and paid-plan messaging. */
  m7kqContactMode?: boolean;
  /** Clicks on greyed contact icons in m7kq mode — e.g. show upgrade snackbar. */
  onLockedContactChannelClick?: (
    node: OrgChartNodeData,
    personSlotIndex: number,
    channel: 'email' | 'phone' | 'linkedin',
  ) => void;
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
