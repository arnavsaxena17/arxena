import * as go from 'gojs';
import type { OrgChartNodeData } from 'twenty-shared/utils';

export const ORG_CHART_CTX_MENU = {
  fill: '#ffffff',
  stroke: '#e2e8f0',
  label: '#64748b',
  text: '#0f172a',
  sep: '#e2e8f0',
  fontItem: '13px system-ui, -apple-system, "Segoe UI", sans-serif',
  fontLabel: '600 10px system-ui, -apple-system, "Segoe UI", sans-serif',
  corner: 8,
} as const;

export const DEFAULT_AVATAR =
  'https://st2.depositphotos.com/4111759/12123/v/950/depositphotos_121232442-stock-illustration-male-default-placeholder-avatar-profile.jpg';

export const DEFAULT_LOCK_ICON = '/img/lock.png';
export const DEFAULT_LINKEDIN_ICON = '/img/linkedin-icon-png-circle-2.png';
export const DEFAULT_DOWNLOAD_ICON = '/img/download-icon.png';
export const DEFAULT_SIMILAR_ITEMS_ICON = '/img/similar-items.png';

const DEFAULT_M7KQ_EMAIL_ICON_SVG = encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1e293b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
);
const DEFAULT_M7KQ_PHONE_ICON_SVG = encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1e293b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.86.3 1.7.6 2.5a2 2 0 0 1-.45 2.11L8.09 9.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.8.3 1.64.5 2.5.6A2 2 0 0 1 22 16.92z"/></svg>',
);

export const DEFAULT_M7KQ_EMAIL_ICON = `data:image/svg+xml;charset=utf-8,${DEFAULT_M7KQ_EMAIL_ICON_SVG}`;
export const DEFAULT_M7KQ_PHONE_ICON = `data:image/svg+xml;charset=utf-8,${DEFAULT_M7KQ_PHONE_ICON_SVG}`;

export const NODE_CAPABILITY_ITEMS = [
  'Fetch names & contact details',
  'Send LinkedIn connection requests',
  'Let AI connect for you',
  'Reach people on WhatsApp',
] as const;

export const NODE_CAPABILITIES_BULLETS = NODE_CAPABILITY_ITEMS.map(
  (line) => `• ${line}`,
).join('\n');

export const PREVIEW_CAPABILITIES_TOOLTIP_DURATION_MS = 2000;

export const getOrgChartDataFromToolTipObject = (
  obj: go.GraphObject,
): OrgChartNodeData | undefined => {
  let current: go.GraphObject | null = obj;
  for (let i = 0; i < 8 && current !== null; i += 1) {
    const containing: go.Part | null = current.part;
    if (containing instanceof go.Adornment) {
      const adorned = containing.adornedPart;
      if (adorned instanceof go.Node) {
        return adorned.data as OrgChartNodeData | undefined;
      }
      return undefined;
    }
    if (containing === null) return undefined;
    current = containing;
  }
  return undefined;
};

export const orgChartNodeHasM7kqMatchIds = (
  data: OrgChartNodeData | undefined,
): boolean => {
  if (!data) return false;
  const r = data as Record<string, unknown>;
  const list = r.allCandidates ?? r.candidates;
  if (!Array.isArray(list)) return false;
  return list.some((c) => {
    if (!c || typeof c !== 'object') return false;
    const id = (c as { id?: unknown }).id;
    return typeof id === 'string' && id.trim().length > 0;
  });
};

