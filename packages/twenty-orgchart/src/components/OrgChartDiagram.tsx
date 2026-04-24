import styled from '@emotion/styled';
import * as go from 'gojs';
import { ReactDiagram } from 'gojs-react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import '../gojs-runtime-patch';

import {
  isValidLinkedInProfileUrl,
  orgChartFirstSlotWithEmail,
  orgChartFirstSlotWithLinkedin,
  orgChartFirstSlotWithPhone,
  orgChartFirstSlotWithPhoneAndEmail,
  orgChartNodeHasGoogleContactFields,
  orgChartNodeHasOutreachEmail,
  orgChartNodeHasOutreachLinkedin,
  orgChartNodeHasOutreachPhone,
  type OrgChartNodeData,
} from 'twenty-shared';

import type {
  OrgChartDiagramHandle,
  OrgChartDiagramProps
} from './OrgChartDiagram.types';

const orgChartNodeHasM7kqMatchIds = (
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

/** GoJS context menus are canvas-drawn; these tokens match the rest of the app (slate borders, clear type). */
const ORG_CHART_CTX_MENU = {
  fill: '#ffffff',
  stroke: '#e2e8f0',
  label: '#64748b',
  text: '#0f172a',
  sep: '#e2e8f0',
  fontItem: '13px system-ui, -apple-system, "Segoe UI", sans-serif',
  fontLabel: '600 10px system-ui, -apple-system, "Segoe UI", sans-serif',
  corner: 8,
} as const;

type OrgChartGraphObjectMake = typeof go.GraphObject.make;

const orgChartContextNodeData = (
  obj: go.GraphObject,
): OrgChartNodeData | undefined => {
  const part = (obj.part ?? null) as go.Node | null;
  return part?.data as OrgChartNodeData | undefined;
};

const orgChartContextItemText = (
  $: OrgChartGraphObjectMake,
  text: string,
): go.TextBlock =>
  $(
    go.TextBlock,
    {
      text,
      stroke: ORG_CHART_CTX_MENU.text,
      font: ORG_CHART_CTX_MENU.fontItem,
    },
  );

const orgChartContextSectionLabel = (
  $: OrgChartGraphObjectMake,
  title: string,
): go.TextBlock =>
  $(
    go.TextBlock,
    {
      text: title.toUpperCase(),
      stroke: ORG_CHART_CTX_MENU.label,
      font: ORG_CHART_CTX_MENU.fontLabel,
      margin: new go.Margin(6, 12, 4, 12),
    },
  );

const orgChartContextColumnSeparator = (
  $: OrgChartGraphObjectMake,
): go.Shape =>
  $(
    go.Shape,
    'Rectangle',
    {
      width: 1,
      stretch: go.GraphObject.Vertical,
      minSize: new go.Size(1, 48),
      fill: ORG_CHART_CTX_MENU.sep,
      stroke: null,
      margin: new go.Margin(6, 0, 6, 0),
    },
  );

/** One menu column. Use Panel, not the built-in "ContextMenu" Adornment, which cannot nest inside Horizontal panels. */
const orgChartContextMenuColumn = (
  $: OrgChartGraphObjectMake,
  ...children: go.GraphObject[]
): go.Panel =>
  $(
    go.Panel,
    'Vertical',
    {
      defaultAlignment: go.Spot.Left,
      background: 'rgba(0,0,0,0)',
    },
    ...children,
  );

/** Rounded, shadowed shell with one or more {@link orgChartContextMenuColumn} panels (two-level / staged layout). */
const orgChartContextMenuShell = (
  $: OrgChartGraphObjectMake,
  ...columns: go.GraphObject[]
): go.Adornment =>
  $(
    go.Adornment,
    'Spot',
    {
      isShadowed: true,
      shadowBlur: 16,
      shadowColor: 'rgba(15, 23, 42, 0.12)',
      shadowOffset: new go.Point(0, 4),
    },
    $(
      go.Panel,
      'Auto',
      $(
        go.Shape,
        'RoundedRectangle',
        {
          fill: ORG_CHART_CTX_MENU.fill,
          stroke: ORG_CHART_CTX_MENU.stroke,
          strokeWidth: 1,
          parameter1: ORG_CHART_CTX_MENU.corner,
        },
      ),
      $(
        go.Panel,
        'Horizontal',
        {
          alignment: go.Spot.TopLeft,
          // Top-align columns so shorter ones don't vertically center.
          defaultAlignment: go.Spot.Top,
          padding: 4,
        },
        ...columns,
      ),
    ),
  );

const buildOrgChartNodeContextMenu = (
  $: OrgChartGraphObjectMake,
  onNodeContextAction: NonNullable<
    OrgChartDiagramProps['onNodeContextAction']
  >,
  m7kqContactMode: boolean,
  onLockedContactChannelClick?: OrgChartDiagramProps['onLockedContactChannelClick'],
): go.Adornment => {
  const lockedContactClick =
    (channel: 'email' | 'phone' | 'linkedin') =>
    (_e: go.InputEvent, obj: go.GraphObject) => {
      if (!onLockedContactChannelClick) return;
      const data = orgChartContextNodeData(obj);
      if (!data) return;
      onLockedContactChannelClick(data, 0, channel);
    };

  const colPosition = orgChartContextMenuColumn(
    $,
    orgChartContextSectionLabel($, 'Position'),
    $(
      'ContextMenuButton',
      orgChartContextItemText($, 'Get people in this position'),
      {
        click: (_: go.InputEvent, obj: go.GraphObject) => {
          const data = orgChartContextNodeData(obj);
          if (data) onNodeContextAction('current_node', data);
        },
      },
    ),
    ...(m7kqContactMode
      ? [
          $(
            'ContextMenuButton',
            orgChartContextItemText($, 'Fetch email + phone'),
            {
              click: (_e: go.InputEvent, obj: go.GraphObject) => {
                const data = orgChartContextNodeData(obj);
                if (data && orgChartNodeHasM7kqMatchIds(data)) {
                  onNodeContextAction('m7kq_fetch_complete', data);
                }
              },
            },
          ),
          $(
            'ContextMenuButton',
            orgChartContextItemText($, 'Fetch phone'),
            {
              click: (_e: go.InputEvent, obj: go.GraphObject) => {
                const data = orgChartContextNodeData(obj);
                if (data && orgChartNodeHasM7kqMatchIds(data)) {
                  onNodeContextAction('m7kq_fetch_phone', data);
                }
              },
            },
          ),
          $(
            'ContextMenuButton',
            orgChartContextItemText($, 'Fetch email'),
            {
              click: (_e: go.InputEvent, obj: go.GraphObject) => {
                const data = orgChartContextNodeData(obj);
                if (data && orgChartNodeHasM7kqMatchIds(data)) {
                  onNodeContextAction('m7kq_fetch_email', data);
                }
              },
            },
          ),
        ]
      : []),
    $(
      'ContextMenuButton',
      orgChartContextItemText($, 'Get all selected positions'),
      {
        click: (_: go.InputEvent, obj: go.GraphObject) => {
          const data = orgChartContextNodeData(obj);
          if (!data) return;
          const dg = obj.diagram;
          const selectedNodes: OrgChartNodeData[] = [];
          if (dg) {
            dg.selection.each((p: go.Part) => {
              if (p instanceof go.Node && p.data) {
                selectedNodes.push(p.data as OrgChartNodeData);
              }
            });
          }
          const effectiveSelected =
            selectedNodes.length > 0 ? selectedNodes : [data];
          onNodeContextAction('selected_nodes', data, {
            selectedNodes: effectiveSelected,
          });
        },
      },
    ),
  );

  const colLists = orgChartContextMenuColumn(
    $,
    orgChartContextSectionLabel($, 'Lists & search'),
    $(
      'ContextMenuButton',
      orgChartContextItemText($, 'Get boolean keywords string'),
      {
        click: (_: go.InputEvent, obj: go.GraphObject) => {
          const data = orgChartContextNodeData(obj);
          if (data) onNodeContextAction('boolean_keywords', data);
        },
      },
    ),
    $(
      'ContextMenuButton',
      orgChartContextItemText($, 'Get all leadership in this company'),
      {
        click: (_: go.InputEvent, obj: go.GraphObject) => {
          const data = orgChartContextNodeData(obj);
          if (data) onNodeContextAction('leadership', data);
        },
      },
    ),
    $(
      'ContextMenuButton',
      orgChartContextItemText($, 'Get all names in this company'),
      {
        click: (_: go.InputEvent, obj: go.GraphObject) => {
          const data = orgChartContextNodeData(obj);
          if (data) onNodeContextAction('entire_company', data);
        },
      },
    ),
    $(
      'ContextMenuButton',
      orgChartContextItemText($, 'Get all names in this function'),
      {
        click: (_: go.InputEvent, obj: go.GraphObject) => {
          const data = orgChartContextNodeData(obj);
          if (data) onNodeContextAction('function_grade', data);
        },
      },
    ),
    $(
      'ContextMenuButton',
      orgChartContextItemText($, 'Get similar names in similar companies'),
      {
        click: (_: go.InputEvent, obj: go.GraphObject) => {
          const data = orgChartContextNodeData(obj);
          if (data) onNodeContextAction('similar_companies', data);
        },
      },
    ),
  );

  const colJob = orgChartContextMenuColumn(
    $,
    orgChartContextSectionLabel($, 'Add to job'),
    $(
      'ContextMenuButton',
      orgChartContextItemText($, 'Add to job and send invite'),
      {
        click: (_: go.InputEvent, obj: go.GraphObject) => {
          const data = orgChartContextNodeData(obj);
          if (data) onNodeContextAction('add_to_job_and_send_invite', data);
        },
      },
    ),
    $(
      'ContextMenuButton',
      orgChartContextItemText($, 'Add to job and invite to job'),
      {
        click: (_: go.InputEvent, obj: go.GraphObject) => {
          const data = orgChartContextNodeData(obj);
          if (data) onNodeContextAction('add_to_job_and_invite_to_job', data);
        },
      },
    ),
  );

  const colOutreach = orgChartContextMenuColumn(
    $,
    orgChartContextSectionLabel($, 'Outreach'),
    $(
      'ContextMenuButton',
      orgChartContextItemText($, 'LinkedIn: connection request'),
      {
        click: (_: go.InputEvent, obj: go.GraphObject) => {
          const data = orgChartContextNodeData(obj);
          if (data) {
            onNodeContextAction('outreach_linkedin_invite', data, {
              personSlot: orgChartFirstSlotWithLinkedin(data),
            });
          }
        },
      },
      new go.Binding('visible', '', (d: OrgChartNodeData | null) =>
        !!d && d.nodeState === 'active' && orgChartNodeHasOutreachLinkedin(d),
      ),
    ),
    $(
      'ContextMenuButton',
      orgChartContextItemText($, 'LinkedIn: connection request (locked)'),
      { click: lockedContactClick('linkedin') },
      new go.Binding('visible', '', (d: OrgChartNodeData | null) => !!d && d.nodeState === 'lock'),
    ),
    $(
      'ContextMenuButton',
      orgChartContextItemText($, 'Send WhatsApp message'),
      {
        click: (_: go.InputEvent, obj: go.GraphObject) => {
          const data = orgChartContextNodeData(obj);
          if (data) {
            onNodeContextAction('outreach_whatsapp', data, {
              personSlot: orgChartFirstSlotWithPhone(data),
            });
          }
        },
      },
      new go.Binding('visible', '', (d: OrgChartNodeData | null) =>
        !!d && d.nodeState === 'active' && orgChartNodeHasOutreachPhone(d),
      ),
    ),
    $(
      'ContextMenuButton',
      orgChartContextItemText($, 'Send WhatsApp message (locked)'),
      { click: lockedContactClick('phone') },
      new go.Binding('visible', '', (d: OrgChartNodeData | null) => !!d && d.nodeState === 'lock'),
    ),
    $(
      'ContextMenuButton',
      orgChartContextItemText($, 'Add to Google Contacts'),
      {
        click: (_: go.InputEvent, obj: go.GraphObject) => {
          const data = orgChartContextNodeData(obj);
          if (data) {
            onNodeContextAction('outreach_google_contact', data, {
              personSlot: orgChartFirstSlotWithPhoneAndEmail(data),
            });
          }
        },
      },
      new go.Binding('visible', '', (d: OrgChartNodeData | null) =>
        !!d && d.nodeState === 'active' && orgChartNodeHasGoogleContactFields(d),
      ),
    ),
    $(
      'ContextMenuButton',
      orgChartContextItemText($, 'Add to Google Contacts (locked)'),
      { click: lockedContactClick('email') },
      new go.Binding('visible', '', (d: OrgChartNodeData | null) => !!d && d.nodeState === 'lock'),
    ),
    $(
      'ContextMenuButton',
      orgChartContextItemText($, 'Send email'),
      {
        click: (_: go.InputEvent, obj: go.GraphObject) => {
          const data = orgChartContextNodeData(obj);
          if (data) {
            onNodeContextAction('outreach_email', data, {
              personSlot: orgChartFirstSlotWithEmail(data),
            });
          }
        },
      },
      new go.Binding('visible', '', (d: OrgChartNodeData | null) =>
        !!d && d.nodeState === 'active' && orgChartNodeHasOutreachEmail(d),
      ),
    ),
    $(
      'ContextMenuButton',
      orgChartContextItemText($, 'Send email (locked)'),
      { click: lockedContactClick('email') },
      new go.Binding('visible', '', (d: OrgChartNodeData | null) => !!d && d.nodeState === 'lock'),
    ),
  );

  return orgChartContextMenuShell(
    $,
    colPosition,
    orgChartContextColumnSeparator($),
    colLists,
    orgChartContextColumnSeparator($),
    colJob,
    orgChartContextColumnSeparator($),
    colOutreach,
  );
};

const buildOrgChartBackgroundContextMenu = (
  $: OrgChartGraphObjectMake,
  onBackgroundContextAction: NonNullable<
    OrgChartDiagramProps['onBackgroundContextAction']
  >,
): go.Adornment =>
  orgChartContextMenuShell(
    $,
    orgChartContextMenuColumn(
      $,
      orgChartContextSectionLabel($, 'Company'),
      $(
        'ContextMenuButton',
        orgChartContextItemText($, 'Get all names in this company'),
        { click: () => onBackgroundContextAction('entire_company') },
      ),
      $(
        'ContextMenuButton',
        orgChartContextItemText($, 'Get all leadership in this company'),
        { click: () => onBackgroundContextAction('leadership') },
      ),
    ),
    orgChartContextColumnSeparator($),
    orgChartContextMenuColumn(
      $,
      orgChartContextSectionLabel($, 'Org chart data'),
      $(
        'ContextMenuButton',
        orgChartContextItemText($, 'Delete saved org chart cache'),
        { click: () => onBackgroundContextAction('delete_company_cache') },
      ),
    ),
  );

export type {
  OrgChartContextAction,
  OrgChartDiagramHandle,
  OrgChartDiagramIconUrls,
  OrgChartDiagramProps,
  OrgChartNodeContextPayload
} from './OrgChartDiagram.types';

const DEFAULT_AVATAR =
  'https://st2.depositphotos.com/4111759/12123/v/950/depositphotos_121232442-stock-illustration-male-default-placeholder-avatar-profile.jpg';

// const DEFAULT_LOCK_ICON = '/img/lock.svg';
// const DEFAULT_LINKEDIN_ICON = '/img/linkedin-icon.svg';
// const DEFAULT_DOWNLOAD_ICON = '/img/download-icon.svg';
// const DEFAULT_SIMILAR_ITEMS_ICON = '/img/similar-items.svg';



const DEFAULT_LOCK_ICON = '/img/lock.png';
const DEFAULT_LINKEDIN_ICON = '/img/linkedin-icon-png-circle-2.png';
const DEFAULT_DOWNLOAD_ICON = '/img/download-icon.png';
const DEFAULT_SIMILAR_ITEMS_ICON = '/img/similar-items.png';

/** Lucide-style outline icons for m7kq contact hints (self-contained, no /img). */
const DEFAULT_M7KQ_EMAIL_ICON_SVG = encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1e293b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
);
const DEFAULT_M7KQ_PHONE_ICON_SVG = encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1e293b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.86.3 1.7.6 2.5a2 2 0 0 1-.45 2.11L8.09 9.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.8.3 1.64.5 2.5.6A2 2 0 0 1 22 16.92z"/></svg>',
);
const DEFAULT_M7KQ_EMAIL_ICON = `data:image/svg+xml;charset=utf-8,${DEFAULT_M7KQ_EMAIL_ICON_SVG}`;
const DEFAULT_M7KQ_PHONE_ICON = `data:image/svg+xml;charset=utf-8,${DEFAULT_M7KQ_PHONE_ICON_SVG}`;

const NODE_CAPABILITY_ITEMS = [
  'Fetch names & contact details',
  'Send LinkedIn connection requests',
  'Let AI connect for you',
  'Reach people on WhatsApp',
] as const;

const NODE_CAPABILITIES_BULLETS = NODE_CAPABILITY_ITEMS.map(
  (line) => `• ${line}`,
).join('\n');

/** How long preview-node capability tooltips stay visible (GoJS ToolManager). */
const PREVIEW_CAPABILITIES_TOOLTIP_DURATION_MS = 2000;

/** Walk up from a GraphObject inside a tooltip to the hovered node's data. */
const getOrgChartDataFromToolTipObject = (
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

const normStr = (v: unknown): string =>
  typeof v === 'string' ? v.trim().toLowerCase() : '';

const parentKeyOnData = (d: go.ObjectData): go.Key | undefined => {
  const p = d.parent;
  if (p === undefined || p === null) return undefined;
  return p as go.Key;
};

const isRootNodeData = (model: go.TreeModel, d: go.ObjectData): boolean => {
  const pk = parentKeyOnData(d);
  if (pk === undefined) return true;
  return model.findNodeDataForKey(pk) === null;
};

const countSubtreeNodes = (model: go.TreeModel, rootKey: go.Key): number => {
  const childrenByParent = new Map<go.Key, go.Key[]>();
  for (const d of model.nodeDataArray) {
    const k = d.key as go.Key;
    const pk = parentKeyOnData(d);
    if (pk === undefined) continue;
    if (model.findNodeDataForKey(pk) === null) continue;
    const list = childrenByParent.get(pk) ?? [];
    list.push(k);
    childrenByParent.set(pk, list);
  }
  let n = 0;
  const stack: go.Key[] = [rootKey];
  const seen = new Set<go.Key>();
  while (stack.length > 0) {
    const k = stack.pop()!;
    if (seen.has(k)) continue;
    seen.add(k);
    n += 1;
    const ch = childrenByParent.get(k);
    if (ch) {
      for (let i = 0; i < ch.length; i += 1) stack.push(ch[i]!);
    }
  }
  return n;
};

/** CEO / main tree root when the model is a forest — not `findTreeRoots().first()`. */
const pickOrgChartRootData = (model: go.TreeModel): go.ObjectData | null => {
  const roots = model.nodeDataArray.filter((d) => isRootNodeData(model, d));
  if (roots.length === 0) return null;
  if (roots.length === 1) return roots[0]!;

  const ceoByStd = roots.find(
    (d) => normStr(d.std_function) === 'ceo' && normStr(d.std_grade) === 'ceo',
  );
  if (ceoByStd) return ceoByStd;

  const ceoByHeadline = roots.find((d) => {
    const h = normStr(d.headline);
    return (
      /\bceo\b/u.test(h) ||
      h.includes('chief executive') ||
      h.includes('ceo leadership')
    );
  });
  if (ceoByHeadline) return ceoByHeadline;

  let best = roots[0]!;
  let bestCount = countSubtreeNodes(model, best.key as go.Key);
  for (let i = 1; i < roots.length; i += 1) {
    const r = roots[i]!;
    const c = countSubtreeNodes(model, r.key as go.Key);
    if (c > bestCount) {
      best = r;
      bestCount = c;
    }
  }
  return best;
};

const getOrgChartRootNode = (diagram: go.Diagram): go.Node | null => {
  const { model } = diagram;
  if (model instanceof go.TreeModel) {
    const data = pickOrgChartRootData(model);
    if (data !== null) {
      const node = diagram.findNodeForKey(data.key as go.Key);
      if (node) return node;
    }
  }
  const fromTree = diagram.findTreeRoots().first();
  if (fromTree) return fromTree;
  return diagram.nodes.first();
};

/**
 * Zoom around a node (CEO). Avoid `decreaseZoom(0.3)` — in GoJS that multiplies scale by 0.3.
 * Retry when bounds are not ready yet (first paint / async layout).
 */
const applyZoomAroundNode = (diagram: go.Diagram, node: go.Node): boolean => {
  const key = node.data?.key as go.Key | undefined;
  const part =
    key !== undefined ? diagram.findNodeForKey(key) : node;
  if (!part || !(part instanceof go.Node)) return false;

  const raw = part.actualBounds;
  if (raw.width < 4 || raw.height < 4) return false;

  const padded = raw.copy().inflate(140, 140);
  diagram.zoomToRect(padded, go.AutoScale.Uniform);
  diagram.centerRect(part.actualBounds);

  const lo = diagram.minScale;
  const hi = diagram.maxScale;
  // Slightly more zoom-out than before (~18%) so the root isn’t edge-to-edge in the viewport.
  const nextScale = Math.max(lo, Math.min(hi, diagram.scale * 0.5));
  diagram.scale = nextScale;
  diagram.centerRect(part.actualBounds);
  diagram.commandHandler.scrollToPart(part);

  // Shift framing so content sits higher in the viewport (~30% of visible height in doc space).
  const vb = diagram.viewportBounds;
  if (vb.height > 0 && Number.isFinite(vb.height)) {
    const nudgeY = vb.height * 0.3;
    const pos = diagram.position;
    diagram.position = new go.Point(pos.x, pos.y + nudgeY);
  }

  return true;
};

const StyledDiagramWrapper = styled.div`
  width: 100%;
  height: 100%;
  min-height: 400px;
  background: ${({ theme }) => theme.background.secondary};
  position: relative;

  & .orgchart-diagram {
    width: 100%;
    height: 100%;
    min-height: 400px;
  }
`;

const StyledOverviewContainer = styled.div`
  position: absolute;
  top: ${({ theme }) => theme.spacing(2)};
  left: ${({ theme }) => theme.spacing(2)};
  width: 180px;
  height: 120px;
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  background-color: ${({ theme }) => theme.background.primary};
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);
  z-index: 10;
`;

export const OrgChartDiagram = forwardRef<OrgChartDiagramHandle, OrgChartDiagramProps>(
  (
    {
      nodeDataArray,
      iconUrls,
      defaultAvatarUrl = DEFAULT_AVATAR,
      onDiagramReady,
      onNodeContextAction,
      onBackgroundContextAction,
      onNodeClick,
      onNodeDoubleClick,
      onDownloadNode,
      onSimilarPeople,
      showNodeCapabilitiesHoverHint = false,
      nodeCapabilitiesHoverCompanyName,
      m7kqContactMode = false,
      onLockedContactChannelClick,
    },
    ref,
  ) => {
    const LOCK_ICON_URL = iconUrls?.lock ?? DEFAULT_LOCK_ICON;
    const LINKEDIN_ICON_URL = iconUrls?.linkedin ?? DEFAULT_LINKEDIN_ICON;
    const DOWNLOAD_ICON_URL = iconUrls?.download ?? DEFAULT_DOWNLOAD_ICON;
    const SIMILAR_ITEMS_ICON_URL = iconUrls?.similarItems ?? DEFAULT_SIMILAR_ITEMS_ICON;
    const M7KQ_EMAIL_ICON_URL = iconUrls?.email ?? DEFAULT_M7KQ_EMAIL_ICON;
    const M7KQ_PHONE_ICON_URL = iconUrls?.phone ?? DEFAULT_M7KQ_PHONE_ICON;
    const diagramRef = useRef<ReactDiagram>(null);
    const overviewDivRef = useRef<HTMLDivElement | null>(null);
    const overviewRef = useRef<go.Overview | null>(null);
    const hasCenteredRef = useRef(false);
    const searchResultsKeysRef = useRef<go.Key[]>([]);
    const currentResultIndexRef = useRef(0);

    const handleModelChange = useCallback(() => {}, []);

    const capabilitiesHoverCompanyLabel =
      (nodeCapabilitiesHoverCompanyName ?? '').trim() || 'this company';

    const createNodeTemplate = useCallback((): go.Node => {
      const $ = go.GraphObject.make;

      const buildCapabilitiesHoverIntro = (
        data: OrgChartNodeData | undefined,
      ): string => {
        const role =
          typeof data?.headline === 'string' && data.headline.trim()
            ? data.headline.trim()
            : 'people in this role';
        return `These are the ${role} teams at ${capabilitiesHoverCompanyLabel}.`;
      };

      const findSize = (size: unknown): number => {
        const n =
          typeof size === 'number' ? size : parseInt(String(size ?? 0), 10);
        return Number.isNaN(n) ? 0 : n;
      };

      const textSeeMore = (total: unknown): string => {
        const count =
          typeof total === 'number' ? total : parseInt(String(total ?? 0), 10);
        const num = Number.isNaN(count) ? 0 : count;
        return num === 1 ? '1 executive' : `${num} executives`;
      };

      const getLabelFromNodeState = (s: unknown): string => {
        if (s === 'active') return 'Active';
        if (s === 'preview') return 'Preview';
        if (s === 'lock') return 'Locked';
        return '';
      };

      const showLabelContainer = (s: unknown): number => {
        const label = getLabelFromNodeState(s);
        return ['Preview', 'Active', 'Locked'].includes(label) ? 20 : 0;
      };

      const showLabelContainerTable = (s: unknown): number => {
        const label = getLabelFromNodeState(s);
        return ['Preview', 'Active', 'Locked'].includes(label) ? 40 : 20;
      };

      const textLabel = (s: unknown): string => getLabelFromNodeState(s);

      const colorLabel = (s: unknown): string => {
        if (s === 'active') return 'PaleGreen';
        if (s === 'lock') return '#64748b';
        return 'rgb(36,116,204)';
      };

      const findIconSource = (nodeState: unknown): string =>
        nodeState === 'active' ? LINKEDIN_ICON_URL : LOCK_ICON_URL;

      const lockedNodeToolTip = $(
        'ToolTip',
        {
          isShadowed: true,
          shadowOffset: new go.Point(0, 3),
          'Border.fill': '#ffffff',
          'Border.stroke': '#e2e8f0',
          'Border.strokeWidth': 1,
        },
        $(
          go.TextBlock,
          {
            margin: new go.Margin(10, 12, 10, 12),
            font: '11pt system-ui, Segoe UI, sans-serif',
            stroke: '#334155',
            wrap: go.TextBlock.WrapFit,
            maxSize: new go.Size(280, NaN),
            textAlign: 'left',
          },
          {
            text: 'Locked — limited preview. Upgrade to a paid plan to access full profiles, verified emails, and phone numbers.',
          },
        ),
      );

      const makeM7kqChannelToolTip = (content: go.GraphObject) =>
        $(
          'ToolTip',
          {
            isShadowed: true,
            shadowOffset: new go.Point(0, 3),
            'Border.fill': '#ffffff',
            'Border.stroke': '#cbd5e1',
            'Border.strokeWidth': 1,
          },
          content,
        );

      // Fixed height per candidate row: name (1 line) + title (2 lines max) + padding. Avoids empty gaps.

      const CANDIDATE_ROW_HEIGHT = 52;





      // In M7KQ contact mode the node content table is 238px wide.
      // Keep candidate rows within bounds so long titles don't push the contact icons outside.
      const nameColWidth = m7kqContactMode ? 120 : 150;

      const getOrgChartNodeDataFromObject = (
        start: go.GraphObject | null,
      ): OrgChartNodeData | undefined => {
        let o: go.GraphObject | null = start;
        for (let i = 0; i < 12 && o !== null; i += 1) {
          if (o instanceof go.Node) {
            return o.data as OrgChartNodeData;
          }
          o = o.part;
        }
        return undefined;
      };

      const m7kqChannelClick = (slotIdx: number, channel: 'email' | 'phone' | 'linkedin') => {
        return (_e: go.InputEvent, obj: go.GraphObject) => {
          if (!onLockedContactChannelClick) return;
          const data = getOrgChartNodeDataFromObject(obj);
          if (data) {
            onLockedContactChannelClick(data, slotIdx, channel);
          }
        };
      };

      const createCandidateRow = (idx: number, rowIndex: number) => {
        const slotEmail = (d: Record<string, unknown> | undefined): string => {
          if (!d) return '';
          const v = d[`email_${idx}`];
          return typeof v === 'string' ? v.trim() : '';
        };
        const slotPhone = (d: Record<string, unknown> | undefined): string => {
          if (!d) return '';
          const v = d[`phone_${idx}`];
          return typeof v === 'string' ? v.trim() : '';
        };
        const slotLinkedInUrl = (d: Record<string, unknown> | undefined): string => {
          if (!d) return '';
          const v = d[`linkedin_url_${idx}`];
          return typeof v === 'string' ? v.trim() : '';
        };
        const nodeStateOf = (d: Record<string, unknown> | undefined): string =>
          typeof d?.nodeState === 'string' ? d.nodeState : '';

        const m7kqEmailToolTipText = (d: Record<string, unknown> | undefined): string => {
          if (!d) return 'Email: not indicated';
          const ev = slotEmail(d);
          if (ev) return ev;
          const ns = nodeStateOf(d);
          const h = d[`has_email_${idx}`];
          if (ns === 'active') {
            if (h === true) return 'Email available — click the icon to fetch';
            if (h === false) return 'No email in directory';
            return 'Email: not indicated';
          }
          if (h === true) return 'Email: on file (unlock with a paid plan)';
          if (h === false) return 'No email';
          return 'Email: not indicated';
        };

        const m7kqPhoneToolTipText = (d: Record<string, unknown> | undefined): string => {
          if (!d) return 'Phone: not indicated';
          const pv = slotPhone(d);
          if (pv) return pv;
          const ns = nodeStateOf(d);
          const dir =
            d[`has_direct_phone_${idx}`] === true ||
            d[`has_org_phone_${idx}`] === true;
          const none =
            d[`has_direct_phone_${idx}`] === false &&
            d[`has_org_phone_${idx}`] === false;
          if (ns === 'active') {
            if (dir) return 'Phone may be available — click the icon to fetch';
            if (none) return 'No phone in directory';
            return 'Phone: not indicated';
          }
          if (dir) return 'Phone: on file (unlock with a paid plan)';
          if (none) return 'No phone';
          return 'Phone: not indicated';
        };

        const m7kqLinkedInToolTipText = (d: Record<string, unknown> | undefined): string => {
          if (!d) return 'LinkedIn: not indicated';
          const url = slotLinkedInUrl(d);
          if (isValidLinkedInProfileUrl(url)) return 'Click to go to LinkedIn profile';
          const ns = nodeStateOf(d);
          if (ns === 'active') {
            return 'LinkedIn profile not loaded — click the icon to fetch';
          }
          return 'LinkedIn: profile in directory (unlock full access on a paid plan)';
        };

        const m7kqEmailStatusDot = (
          d: Record<string, unknown> | undefined,
        ): { text: string; stroke: string } => {
          if (!d) return { text: '·', stroke: '#e2e8f0' };
          const ev = slotEmail(d);
          if (ev) return { text: '●', stroke: '#22c55e' };
          const h = d[`has_email_${idx}`];
          if (h === true) return { text: '●', stroke: '#f97316' };
          if (h === false) return { text: '◦', stroke: '#cbd5e1' };
          return { text: '·', stroke: '#e2e8f0' };
        };

        const m7kqPhoneStatusDot = (
          d: Record<string, unknown> | undefined,
        ): { text: string; stroke: string } => {
          if (!d) return { text: '·', stroke: '#e2e8f0' };
          const pv = slotPhone(d);
          if (pv) return { text: '●', stroke: '#22c55e' };
          if (
            d[`has_direct_phone_${idx}`] === true ||
            d[`has_org_phone_${idx}`] === true
          ) {
            return { text: '●', stroke: '#cbd5e1' };
          }
          if (
            d[`has_direct_phone_${idx}`] === false &&
            d[`has_org_phone_${idx}`] === false
          ) {
            return { text: '◦', stroke: '#cbd5e1' };
          }
          return { text: '·', stroke: '#e2e8f0' };
        };

        const m7kqLinkedInStatusDot = (
          d: Record<string, unknown> | undefined,
        ): { text: string; stroke: string } => {
          if (!d) return { text: '·', stroke: '#e2e8f0' };
          const url = slotLinkedInUrl(d);
          if (isValidLinkedInProfileUrl(url)) return { text: '●', stroke: '#22c55e' };
          return { text: '◦', stroke: '#cbd5e1' };
        };

        const m7kqLinkedInClick = (_e: go.InputEvent, obj: go.GraphObject) => {
          const data = getOrgChartNodeDataFromObject(obj);
          if (!data) return;
          const r = data as Record<string, unknown>;
          const urlRaw = r[`linkedin_url_${idx}`];
          const url = typeof urlRaw === 'string' ? urlRaw.trim() : '';
          if (isValidLinkedInProfileUrl(url)) {
            window.open(url.startsWith('http') ? url : `https://${url}`, '_blank');
            return;
          }
          m7kqChannelClick(idx, 'linkedin')(_e, obj);
        };

        const m7kqContactStrip = $(
          go.Panel,
          'Vertical',
          {
            row: 0,
            column: 2,
            rowSpan: 2,
            alignment: go.Spot.Right,
            margin: new go.Margin(2, 0, 2, 0),
          },
          new go.Binding('visible', `height_${idx}` as const, (h) => findSize(h) > 0),
          $(
            go.Panel,
            'Horizontal',
            { defaultAlignment: go.Spot.Center },
            $(
              go.Panel,
              'Vertical',
              {
                margin: new go.Margin(0, 2, 0, 0),
                cursor: 'pointer',
                click: m7kqChannelClick(idx, 'email'),
                toolTip: makeM7kqChannelToolTip(
                  $(
                    go.TextBlock,
                    {
                      margin: new go.Margin(8, 10, 8, 10),
                      font: '11pt system-ui, Segoe UI, sans-serif',
                      stroke: '#0f172a',
                      wrap: go.TextBlock.WrapFit,
                      maxSize: new go.Size(300, NaN),
                      textAlign: 'left',
                    },
                    new go.Binding(
                      'text',
                      `email_${idx}` as const,
                      (_: unknown, obj: go.GraphObject) =>
                        m7kqEmailToolTipText(
                          getOrgChartDataFromToolTipObject(obj) as
                            | Record<string, unknown>
                            | undefined,
                        ),
                    ),
                    new go.Binding(
                      'text',
                      `has_email_${idx}` as const,
                      (_: unknown, obj: go.GraphObject) =>
                        m7kqEmailToolTipText(
                          getOrgChartDataFromToolTipObject(obj) as
                            | Record<string, unknown>
                            | undefined,
                        ),
                    ),
                    new go.Binding(
                      'text',
                      'nodeState',
                      (_: unknown, obj: go.GraphObject) =>
                        m7kqEmailToolTipText(
                          getOrgChartDataFromToolTipObject(obj) as
                            | Record<string, unknown>
                            | undefined,
                        ),
                    ),
                  ),
                ),
              },
              new go.Binding('visible', 'nodeState', (s: unknown) => s !== 'preview'),
              $(
                go.Picture,
                {
                  source: M7KQ_EMAIL_ICON_URL,
                  desiredSize: new go.Size(16, 16),
                  imageStretch: go.GraphObject.Uniform,
                },
              ),
              $(
                go.TextBlock,
                {
                  font: '6pt system-ui,Segoe UI,sans-serif',
                  margin: new go.Margin(0, 0, 0, 0),
                  textAlign: 'center',
                },
                new go.Binding('text', `email_${idx}` as const, (_: unknown, obj: go.GraphObject) =>
                  m7kqEmailStatusDot(obj.part?.data as Record<string, unknown> | undefined).text,
                ),
                new go.Binding('text', `has_email_${idx}` as const, (_: unknown, obj: go.GraphObject) =>
                  m7kqEmailStatusDot(obj.part?.data as Record<string, unknown> | undefined).text,
                ),
                new go.Binding('stroke', `email_${idx}` as const, (_: unknown, obj: go.GraphObject) =>
                  m7kqEmailStatusDot(obj.part?.data as Record<string, unknown> | undefined).stroke,
                ),
                new go.Binding('stroke', `has_email_${idx}` as const, (_: unknown, obj: go.GraphObject) =>
                  m7kqEmailStatusDot(obj.part?.data as Record<string, unknown> | undefined).stroke,
                ),
              ),
            ),
            $(
              go.Panel,
              'Vertical',
              {
                margin: new go.Margin(0, 2, 0, 0),
                cursor: 'pointer',
                click: m7kqChannelClick(idx, 'phone'),
                toolTip: makeM7kqChannelToolTip(
                  $(
                    go.TextBlock,
                    {
                      margin: new go.Margin(8, 10, 8, 10),
                      font: '11pt system-ui, Segoe UI, sans-serif',
                      stroke: '#0f172a',
                      wrap: go.TextBlock.WrapFit,
                      maxSize: new go.Size(300, NaN),
                      textAlign: 'left',
                    },
                    new go.Binding(
                      'text',
                      `phone_${idx}` as const,
                      (_: unknown, obj: go.GraphObject) =>
                        m7kqPhoneToolTipText(
                          getOrgChartDataFromToolTipObject(obj) as
                            | Record<string, unknown>
                            | undefined,
                        ),
                    ),
                    new go.Binding(
                      'text',
                      `has_direct_phone_${idx}` as const,
                      (_: unknown, obj: go.GraphObject) =>
                        m7kqPhoneToolTipText(
                          getOrgChartDataFromToolTipObject(obj) as
                            | Record<string, unknown>
                            | undefined,
                        ),
                    ),
                    new go.Binding(
                      'text',
                      `has_org_phone_${idx}` as const,
                      (_: unknown, obj: go.GraphObject) =>
                        m7kqPhoneToolTipText(
                          getOrgChartDataFromToolTipObject(obj) as
                            | Record<string, unknown>
                            | undefined,
                        ),
                    ),
                    new go.Binding(
                      'text',
                      'nodeState',
                      (_: unknown, obj: go.GraphObject) =>
                        m7kqPhoneToolTipText(
                          getOrgChartDataFromToolTipObject(obj) as
                            | Record<string, unknown>
                            | undefined,
                        ),
                    ),
                  ),
                ),
              },
              new go.Binding('visible', 'nodeState', (s: unknown) => s !== 'preview'),
              $(
                go.Picture,
                {
                  source: M7KQ_PHONE_ICON_URL,
                  desiredSize: new go.Size(16, 16),
                  imageStretch: go.GraphObject.Uniform,
                },
              ),
              $(
                go.TextBlock,
                {
                  font: '6pt system-ui,Segoe UI,sans-serif',
                  textAlign: 'center',
                },
                new go.Binding(
                  'text',
                  `phone_${idx}` as const,
                  (_: unknown, obj: go.GraphObject) =>
                    m7kqPhoneStatusDot(obj.part?.data as Record<string, unknown> | undefined).text,
                ),
                new go.Binding(
                  'text',
                  `has_direct_phone_${idx}` as const,
                  (_: unknown, obj: go.GraphObject) =>
                    m7kqPhoneStatusDot(obj.part?.data as Record<string, unknown> | undefined).text,
                ),
                new go.Binding(
                  'text',
                  `has_org_phone_${idx}` as const,
                  (_: unknown, obj: go.GraphObject) =>
                    m7kqPhoneStatusDot(obj.part?.data as Record<string, unknown> | undefined).text,
                ),
                new go.Binding(
                  'stroke',
                  `phone_${idx}` as const,
                  (_: unknown, obj: go.GraphObject) =>
                    m7kqPhoneStatusDot(obj.part?.data as Record<string, unknown> | undefined).stroke,
                ),
                new go.Binding(
                  'stroke',
                  `has_direct_phone_${idx}` as const,
                  (_: unknown, obj: go.GraphObject) =>
                    m7kqPhoneStatusDot(obj.part?.data as Record<string, unknown> | undefined).stroke,
                ),
                new go.Binding(
                  'stroke',
                  `has_org_phone_${idx}` as const,
                  (_: unknown, obj: go.GraphObject) =>
                    m7kqPhoneStatusDot(obj.part?.data as Record<string, unknown> | undefined).stroke,
                ),
              ),
            ),
            $(
              go.Panel,
              'Vertical',
              {
                margin: new go.Margin(0, 0, 0, 0),
                cursor: 'pointer',
                click: m7kqLinkedInClick,
                toolTip: makeM7kqChannelToolTip(
                  $(
                    go.TextBlock,
                    {
                      margin: new go.Margin(8, 10, 8, 10),
                      font: '11pt system-ui, Segoe UI, sans-serif',
                      stroke: '#0f172a',
                      wrap: go.TextBlock.WrapFit,
                      maxSize: new go.Size(300, NaN),
                      textAlign: 'left',
                    },
                    new go.Binding(
                      'text',
                      `linkedin_url_${idx}` as const,
                      (_: unknown, obj: go.GraphObject) =>
                        m7kqLinkedInToolTipText(
                          getOrgChartDataFromToolTipObject(obj) as
                            | Record<string, unknown>
                            | undefined,
                        ),
                    ),
                    new go.Binding(
                      'text',
                      'nodeState',
                      (_: unknown, obj: go.GraphObject) =>
                        m7kqLinkedInToolTipText(
                          getOrgChartDataFromToolTipObject(obj) as
                            | Record<string, unknown>
                            | undefined,
                        ),
                    ),
                  ),
                ),
              },
              $(
                go.Picture,
                {
                  source: LINKEDIN_ICON_URL,
                  desiredSize: new go.Size(14, 14),
                  imageStretch: go.GraphObject.UniformToFill,
                  opacity: 0.88,
                },
              ),
              $(
                go.TextBlock,
                {
                  font: '6pt system-ui,Segoe UI,sans-serif',
                  textAlign: 'center',
                },
                new go.Binding(
                  'text',
                  `linkedin_url_${idx}` as const,
                  (_: unknown, obj: go.GraphObject) =>
                    m7kqLinkedInStatusDot(obj.part?.data as Record<string, unknown> | undefined).text,
                ),
                new go.Binding(
                  'stroke',
                  `linkedin_url_${idx}` as const,
                  (_: unknown, obj: go.GraphObject) =>
                    m7kqLinkedInStatusDot(obj.part?.data as Record<string, unknown> | undefined).stroke,
                ),
              ),
            ),
          ),
        );

        const classicLinkedInCell = $(
          go.Panel,
          'Spot',
          {
            row: 1,
            column: 2,
            isClipping: true,
            alignment: go.Spot.Center,
            margin: new go.Margin(0, 4, 0, 0),
            cursor: 'pointer',
            width: 10,
            click: (_e: go.InputEvent, obj: go.GraphObject) => {
              const node = obj.part as go.Node | undefined;
              const data = node?.data as OrgChartNodeData | undefined;
              if (!data) return;
              const url = data[`linkedin_url_${idx}`];
              if (typeof url === 'string' && isValidLinkedInProfileUrl(url)) {
                window.open(
                  url.startsWith('http') ? url : `https://${url}`,
                  '_blank',
                );
              }
            },
          },
          new go.Binding('visible', `linkedin_url_${idx}` as const, (url) =>
            isValidLinkedInProfileUrl(typeof url === 'string' ? url : undefined),
          ),
          $(go.Shape, 'Circle', { width: 10, height: 10, strokeWidth: 0, fill: 'white' }),
          $(
            go.Picture,
            {
              desiredSize: new go.Size(12, 12),
              imageStretch: go.GraphObject.UniformToFill,
            },
            new go.Binding('source', 'nodeState', findIconSource),
          ),
        );

        return $(
          go.Panel,
          'Table',
          {
            row: rowIndex,
            column: 0,
            stretch: go.Stretch.Horizontal,
            defaultAlignment: go.Spot.Left,
          },
          new go.Binding('height', `height_${idx}` as const, findSize),
          $(go.RowColumnDefinition, { column: 0, width: m7kqContactMode ? 44 : 50 }),
          $(go.RowColumnDefinition, { column: 1 }),
          $(go.RowColumnDefinition, { column: 2, width: m7kqContactMode ? 64 : 18 }),
          $(
            go.Panel,
            'Spot',
            {
              row: 0,
              column: 0,
              rowSpan: 2,
              isClipping: true,
              scale: 1,
              margin: new go.Margin(6, 6, 6, 8),
            },
            $(go.Shape, 'Circle', { width: 30, strokeWidth: 0 }),
            $(
              go.Picture,
              {
                desiredSize: new go.Size(30, 30),
                imageStretch: go.GraphObject.UniformToFill,
                errorFunction: () => defaultAvatarUrl,
              },
              new go.Binding('source', `image_${idx}` as const, (src) => src || defaultAvatarUrl),
            ),
          ),
          $(
            go.TextBlock,
            {
              row: 0,
              column: 1,
              font: '12pt Segoe UI,sans-serif',
              wrap: go.TextBlock.WrapFit,
              isMultiline: true,
              maxLines: 1,
              overflow: go.TextBlock.OverflowEllipsis,
              editable: false,
              minSize: new go.Size(5, 16),
              width: nameColWidth,
            },
            new go.Binding('text', `name_${idx}` as const, (n) => n || ''),
          ),
          $(
            go.TextBlock,
            {
              row: 1,
              column: 1,
              font: '9pt Segoe UI,sans-serif',
              wrap: go.TextBlock.WrapFit,
              maxLines: 2,
              overflow: go.TextBlock.OverflowEllipsis,
              editable: false,
              isMultiline: true,
              stroke: 'rgb(150,150,150)',
              minSize: new go.Size(10, 14),
              margin: new go.Margin(0, 0, 0, 0),
              width: nameColWidth,
            },
            new go.Binding('text', `title_${idx}` as const, (t) => t || ''),
          ),
          m7kqContactMode ? m7kqContactStrip : classicLinkedInCell,
        );
      };

      const capabilitiesIntroBinding = new go.Binding(
        'text',
        '',
        (_val: unknown, obj: go.GraphObject) =>
          buildCapabilitiesHoverIntro(getOrgChartDataFromToolTipObject(obj)),
      ).ofObject();

      const nodeHoverToolTip = showNodeCapabilitiesHoverHint
        ? $(
            'ToolTip',
            {
              isShadowed: true,
              shadowOffset: new go.Point(0, 3),
              'Border.fill': '#ffffff',
              'Border.stroke': '#e2e8f0',
              'Border.strokeWidth': 1,
            },
            $(
              go.Panel,
              'Horizontal',
              { stretch: go.Stretch.Horizontal },
              $(
                go.Shape,
                'Rectangle',
                {
                  width: 4,
                  stretch: go.Stretch.Vertical,
                  fill: '#00a4a4',
                  strokeWidth: 0,
                },
              ),
              $(
                go.Panel,
                'Vertical',
                {
                  margin: new go.Margin(12, 14, 14, 12),
                  defaultAlignment: go.Spot.Left,
                  stretch: go.Stretch.Horizontal,
                },
                $(
                  go.TextBlock,
                  {
                    font: '600 12.5pt system-ui, Segoe UI, sans-serif',
                    stroke: '#0f172a',
                    wrap: go.TextBlock.WrapFit,
                    maxSize: new go.Size(292, NaN),
                    textAlign: 'left',
                  },
                  capabilitiesIntroBinding,
                ),
                $(
                  go.Shape,
                  'Rectangle',
                  {
                    height: 1,
                    stretch: go.Stretch.Horizontal,
                    fill: '#e2e8f0',
                    strokeWidth: 0,
                    margin: new go.Margin(12, 0, 10, 0),
                  },
                ),
                $(
                  go.TextBlock,
                  {
                    text: 'With Arxena you can',
                    font: '600 9.5pt system-ui, Segoe UI, sans-serif',
                    stroke: '#64748b',
                    margin: new go.Margin(0, 0, 6, 0),
                  },
                ),
                $(
                  go.TextBlock,
                  {
                    text: NODE_CAPABILITIES_BULLETS,
                    font: '10.5pt system-ui, Segoe UI, sans-serif',
                    stroke: '#334155',
                    wrap: go.TextBlock.WrapFit,
                    maxSize: new go.Size(292, NaN),
                    textAlign: 'left',
                  },
                ),
              ),
            ),
          )
        : undefined;

      const node = $(
        go.Node,
        'Auto',
        {
          cursor: 'pointer',
          fromSpot: go.Spot.Bottom,
          toSpot: go.Spot.Top,
          click: (_e: go.InputEvent, obj: go.GraphObject) => {
            if (!onNodeClick) return;
            const part = (obj.part ?? null) as go.Node | null;
            const data = part?.data as OrgChartNodeData | undefined;
            if (data) onNodeClick(data);
          },
          doubleClick: (_e: go.InputEvent, obj: go.GraphObject) => {
            if (!onNodeDoubleClick) return;
            const part = (obj.part ?? null) as go.Node | null;
            const data = part?.data as OrgChartNodeData | undefined;
            if (data) {
              // eslint-disable-next-line no-console
              console.log('[orgchart/OrgChartDiagram/doubleClick]', {
                headline: data.headline,
                key: data.key,
                totalPeople: data.total_people,
                allCandidatesLength: Array.isArray(
                  (data as Record<string, unknown>).allCandidates,
                )
                  ? (
                      (data as Record<string, unknown>).allCandidates as unknown[]
                    ).length
                  : null,
              });
              onNodeDoubleClick(data);
            }
          },
        },
        new go.Binding('toolTip', 'nodeState', (state: unknown) => {
          if (state === 'lock') {
            return lockedNodeToolTip;
          }
          if (
            state === 'preview' &&
            showNodeCapabilitiesHoverHint &&
            nodeHoverToolTip !== undefined
          ) {
            return nodeHoverToolTip;
          }
          return null;
        }),
        $(
          go.Panel,
          'Auto',
          $(
            go.Shape,
            'RoundedRectangle',
            {
              name: 'SHAPE',
              fill: 'white',
              strokeWidth: 1,
              stroke: 'rgb(150,150,150)',
              cursor: 'pointer',
              width: m7kqContactMode ? 248 : 230,
              portId: '',
              fromLinkable: true,
              toLinkable: true,
            },
            new go.Binding('stroke', 'isHighlighted', (h: boolean) =>
              h ? 'blue' : 'rgb(150,150,150)',
            ).ofObject(),
            new go.Binding('strokeWidth', 'isHighlighted', (h: boolean) =>
              h ? 5 : 1,
            ).ofObject(),
            new go.Binding('fill', 'special_color'),
          ),
          $(
            go.Panel,
            'Table',
            { width: m7kqContactMode ? 238 : 220 },
            new go.Binding(
              'padding',
              'nodeState',
              (s: string) =>
                s === 'preview' || s === 'lock'
                  ? new go.Margin(0, 0, 14, 0)
                  : new go.Margin(0, 0, 8, 0),
            ),
            $(go.RowColumnDefinition, { column: 1, width: 4 }),
            $(
              go.Shape,
              'RoundedRectangle',
              {
                name: 'LABEL',
                height: 20,
                width: 60,
                stroke: 'rgba(255,255,255,0)',
                margin: new go.Margin(0, -90, 0, 0),
              },
              new go.Binding('height', 'nodeState', showLabelContainer),
              new go.Binding('fill', 'nodeState', colorLabel),
            ),
            $(
              go.Panel,
              'Table',
              {
                height: 30,
                margin: new go.Margin(0, -90, 0, 0),
              },
              new go.Binding('height', 'nodeState', showLabelContainerTable),
              $(
                go.TextBlock,
                {
                  row: 0,
                  column: 0,
                  font: 'bold 11pt Segoe UI,sans-serif',
                  editable: false,
                  isMultiline: false,
                  textAlign: 'center',
                  stroke: 'white',
                },
                new go.Binding('text', 'nodeState', textLabel),
              ),
            ),
            $(
              go.TextBlock,
              {
                row: 2,
                column: 0,
                font: 'bold 12pt Segoe UI,sans-serif',
                editable: false,
                isMultiline: false,
                minSize: new go.Size(10, 14),
                margin: new go.Margin(0, 5, 5, 5),
                width: 200,
                wrap: go.TextBlock.WrapFit,
                textAlign: 'center',
              },
              new go.Binding('text', 'headline'),
            ),
            createCandidateRow(0, 5),
            createCandidateRow(1, 6),
            createCandidateRow(2, 7),
            createCandidateRow(3, 8),
            $(
              go.Panel,
              'Horizontal',
              {
                row: 9,
                column: 0,
                alignment: go.Spot.Right,
                height: 40,
              },
              new go.Binding('visible', 'nodeState', (s) => s === 'active'),
              $(
                go.Panel,
                'Table',
                {
                  margin: new go.Margin(0, 10, 0, 0),
                  width: 200,
                },
                $(go.RowColumnDefinition, { column: 0, width: 24 }),
                $(go.RowColumnDefinition, { column: 1, width: 24 }),
                $(
                  go.Picture,
                  {
                    row: 0,
                    column: 0,
                    source: DOWNLOAD_ICON_URL,
                    desiredSize: new go.Size(12, 12),
                    width: 12,
                    cursor: 'pointer',
                  },
                  {
                    click: (_e: go.InputEvent, obj: go.GraphObject) => {
                      const node = obj.part as go.Node | undefined;
                      const data = node?.data as OrgChartNodeData | undefined;
                      if (data && onDownloadNode) onDownloadNode(data);
                    },
                  },
                ),
                $(
                  go.Picture,
                  {
                    row: 0,
                    column: 1,
                    source: SIMILAR_ITEMS_ICON_URL,
                    desiredSize: new go.Size(12, 12),
                    width: 12,
                    cursor: 'pointer',
                  },
                  {
                    click: (_e: go.InputEvent, obj: go.GraphObject) => {
                      const node = obj.part as go.Node | undefined;
                      const data = node?.data as OrgChartNodeData | undefined;
                      if (data && onSimilarPeople) onSimilarPeople(data);
                    },
                  },
                ),
                $(
                  go.TextBlock,
                  {
                    row: 0,
                    column: 2,
                    editable: false,
                    isMultiline: false,
                    minSize: new go.Size(10, 14),
                    margin: new go.Margin(0, 8, 0, 0),
                    stroke: 'rgb(150,150,150)',
                    cursor: 'pointer',
                  },
                  new go.Binding('text', 'total_people', textSeeMore),
                ),
              ),
            ),
          ),
        ),
      );

      if (onNodeContextAction) {
        const $c = go.GraphObject.make;
        node.contextMenu = buildOrgChartNodeContextMenu(
          $c,
          onNodeContextAction,
          m7kqContactMode,
          onLockedContactChannelClick,
        );
      }

      return node;
    }, [
      defaultAvatarUrl,
      LOCK_ICON_URL,
      LINKEDIN_ICON_URL,
      DOWNLOAD_ICON_URL,
      SIMILAR_ITEMS_ICON_URL,
      M7KQ_EMAIL_ICON_URL,
      M7KQ_PHONE_ICON_URL,
      onNodeContextAction,
      onNodeClick,
      onNodeDoubleClick,
      onDownloadNode,
      onSimilarPeople,
      showNodeCapabilitiesHoverHint,
      capabilitiesHoverCompanyLabel,
      m7kqContactMode,
      onLockedContactChannelClick,
    ]);

    const initDiagram = useCallback((): go.Diagram => {
      const $ = go.GraphObject.make;

      const diagram = $(
        go.Diagram,
        {
          ...(showNodeCapabilitiesHoverHint || m7kqContactMode
            ? {
                'toolManager.hoverDelay': 0,
                'toolManager.toolTipDuration':
                  PREVIEW_CAPABILITIES_TOOLTIP_DURATION_MS,
              }
            : {}),
          'undoManager.isEnabled': true,
          initialContentAlignment: go.Spot.Default,
          validCycle: go.Diagram.CycleDestinationTree,
          layout: $(
            go.TreeLayout,
            {
              angle: 90,
              layerSpacing: 35,
              arrangement: go.TreeLayout.ArrangementHorizontal,
            },
          ),
          model: $(
            go.TreeModel,
            {
              nodeKeyProperty: 'key',
              nodeParentKeyProperty: 'parent',
              makeUniqueKeyFunction: (m: go.Model, data: go.ObjectData) => {
                let k = (data.key as number) || 1;
                while (m.findNodeDataForKey(k)) k += 1;
                data.key = k;
                return k;
              },
            },
          ),
        },
      );

      diagram.nodeTemplate = createNodeTemplate();
      diagram.linkTemplate = $(
        go.Link,
        { routing: go.Link.Orthogonal, corner: 5 },
        $(go.Shape, { strokeWidth: 4, stroke: '#00a4a4' }),
      );

      // Extra scrollable space so the tree root (top of doc) can be centered in the viewport;
      // default scrollMargin is 0 and centerRect cannot scroll past document bounds.
      // Document coords: extra L/R so wide trees (CEO far from x=0) can scroll to center.
      diagram.scrollMargin = new go.Margin(800, 4000, 800, 4000);

      const levelColors: string[] = [
        '#AC193D',
        '#2672EC',
        '#8C0095',
        '#5133AB',
        '#008299',
        '#D24726',
        '#008A00',
        '#094AB2',
      ];

      const layout = diagram.layout as go.TreeLayout;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const baseCommitNodes = (layout as any).commitNodes.bind(layout);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (layout as any).commitNodes = function () {
        baseCommitNodes();
        const network = layout.network;
        if (!network) return;

        network.vertexes.each((v) => {
          const tv = v as go.TreeVertex;
          const node = tv.node;
          if (!node) return;

          const level = tv.level % levelColors.length;
          const color = levelColors[level];
          const shape = node.findObject('SHAPE') as go.Shape | null;
          if (!shape) return;

          shape.stroke = $(go.Brush, 'Linear', {
            0: color,
            1: go.Brush.lightenBy(color, 0.05),
            start: go.Spot.Left,
            end: go.Spot.Right,
          });
        });
      };

      if (onBackgroundContextAction) {
        const $c = go.GraphObject.make;
        diagram.contextMenu = buildOrgChartBackgroundContextMenu(
          $c,
          onBackgroundContextAction,
        );
      }

      return diagram;
    }, [createNodeTemplate, onBackgroundContextAction, showNodeCapabilitiesHoverHint, m7kqContactMode]);

    const getDiagram = useCallback((): go.Diagram | null => {
      const diagramHost = diagramRef.current as unknown as {
        getDiagram?: () => go.Diagram | null;
      } | null;
      return diagramHost?.getDiagram?.() ?? null;
    }, []);

    useEffect(() => {
      const diagram = getDiagram();
      const overviewDiv = overviewDivRef.current;

      if (!diagram || !overviewDiv) return;

      if (overviewRef.current) {
        overviewRef.current.observed = diagram;
        return;
      }

      const $ = go.GraphObject.make;
      const overview = $(
        go.Overview,
        overviewDiv,
        {
          observed: diagram,
          contentAlignment: go.Spot.Center,
        },
      );

      overviewRef.current = overview;

      return () => {
        if (overviewRef.current) {
          overviewRef.current.observed = null;
          overviewRef.current.div = null;
          overviewRef.current = null;
        }
      };
    }, [getDiagram]);

    const focusResultAtIndex = useCallback(
      (index: number) => {
        const diagram = getDiagram();
        if (!diagram) return;

        const keys = searchResultsKeysRef.current;
        if (!keys.length) return;

        const safeIndex = ((index % keys.length) + keys.length) % keys.length;
        const key = keys[safeIndex];
        const part = diagram.findPartForKey(key);
        if (!part || !(part instanceof go.Node)) return;

        applyZoomAroundNode(diagram, part);
        currentResultIndexRef.current = safeIndex;
      },
      [getDiagram],
    );

    const performSearch = useCallback(
      (keyword: string): number => {
        const diagram = getDiagram();
        if (!diagram) return 0;

        diagram.startTransaction('highlight search');
        diagram.clearHighlighteds();

        const trimmed = keyword.trim();
        if (!trimmed) {
          searchResultsKeysRef.current = [];
          currentResultIndexRef.current = 0;
          diagram.commitTransaction('highlight search');
          diagram.commandHandler.zoomToFit();
          return 0;
        }

        const regex = new RegExp(trimmed, 'i');
        const examples: go.ObjectData[] = [{ headline: regex }, { country: regex }];
        for (let i = 0; i <= 297; i += 1) {
          examples.push({ [`name_${i}`]: regex }, { [`title_${i}`]: regex });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const results = (diagram as any).findNodesByExample.apply(
          diagram,
          examples,
        ) as go.Iterator<go.Node>;

        const keys: go.Key[] = [];
        results.each((item) => keys.push(item.data.key));
        searchResultsKeysRef.current = keys;
        currentResultIndexRef.current = 0;

        diagram.highlightCollection(results);

        const first = results.first();
        if (first) {
          applyZoomAroundNode(diagram, first);
        } else {
          diagram.commandHandler.zoomToFit();
        }

        diagram.commitTransaction('highlight search');
        return keys.length;
      },
      [getDiagram],
    );

    const focusNextResult = useCallback(() => {
      focusResultAtIndex(currentResultIndexRef.current + 1);
    }, [focusResultAtIndex]);

    const focusPreviousResult = useCallback(() => {
      focusResultAtIndex(currentResultIndexRef.current - 1);
    }, [focusResultAtIndex]);

    const clearSearch = useCallback(() => {
      const diagram = getDiagram();
      if (!diagram) return;

      searchResultsKeysRef.current = [];
      currentResultIndexRef.current = 0;
      diagram.startTransaction('highlight search');
      diagram.clearHighlighteds();
      diagram.commitTransaction('highlight search');
      diagram.commandHandler.zoomToFit();
    }, [getDiagram]);

    const zoomToFit = useCallback(() => {
      const diagram = getDiagram();
      if (!diagram) return;
      diagram.commandHandler.zoomToFit();
    }, [getDiagram]);

    const centerContent = useCallback(() => {
      const diagram = getDiagram();
      if (!diagram) return;
      const rootNode = getOrgChartRootNode(diagram);
      if (!rootNode) {
        diagram.commandHandler.zoomToFit();
        return;
      }
      if (!applyZoomAroundNode(diagram, rootNode)) {
        requestAnimationFrame(() => {
          const d = getDiagram();
          const r = d ? getOrgChartRootNode(d) : null;
          if (d && r) applyZoomAroundNode(d, r);
        });
      }
    }, [getDiagram]);

    const handle = {
      search: performSearch,
      focusNextResult,
      focusPreviousResult,
      clearSearch,
      getSearchResultCount: () => searchResultsKeysRef.current.length,
      zoomToFit,
      centerContent,
    };

    useImperativeHandle(
      ref,
      () => handle,
      [
        clearSearch,
        focusNextResult,
        focusPreviousResult,
        performSearch,
        zoomToFit,
        centerContent,
      ],
    );

    useEffect(() => {
      onDiagramReady?.(handle);
    }, [onDiagramReady, clearSearch, focusNextResult, focusPreviousResult, performSearch, zoomToFit, centerContent]);

    useEffect(() => {
      hasCenteredRef.current = false;
    }, [nodeDataArray]);

    useEffect(() => {
      const diagram = getDiagram();
      if (!diagram) return;

      let settleTimer: ReturnType<typeof setTimeout> | undefined;

      const handleInitialLayout = () => {
        if (hasCenteredRef.current) return;

        const tryCenter = (): boolean => {
          const rootNode = getOrgChartRootNode(diagram);
          if (!rootNode) {
            diagram.commandHandler.zoomToFit();
            return true;
          }
          return applyZoomAroundNode(diagram, rootNode);
        };

        const frameCenterOnRoot = () => {
          if (hasCenteredRef.current) return;
          if (tryCenter()) {
            hasCenteredRef.current = true;
            return;
          }
          requestAnimationFrame(() => {
            if (hasCenteredRef.current) return;
            if (tryCenter()) {
              hasCenteredRef.current = true;
              return;
            }
            settleTimer = setTimeout(() => {
              if (hasCenteredRef.current) return;
              if (tryCenter()) {
                hasCenteredRef.current = true;
                return;
              }
              diagram.commandHandler.zoomToFit();
              hasCenteredRef.current = true;
            }, 320);
          });
        };

        requestAnimationFrame(() => {
          requestAnimationFrame(frameCenterOnRoot);
        });
      };

      diagram.addDiagramListener('InitialLayoutCompleted', handleInitialLayout);
      return () => {
        if (settleTimer !== undefined) clearTimeout(settleTimer);
        diagram.removeDiagramListener('InitialLayoutCompleted', handleInitialLayout);
      };
    }, [getDiagram, nodeDataArray]);

    return (
      <StyledDiagramWrapper>
        <StyledOverviewContainer ref={overviewDivRef} />
        <ReactDiagram
          ref={diagramRef}
          divClassName="orgchart-diagram"
          initDiagram={initDiagram}
          nodeDataArray={nodeDataArray}
          onModelChange={handleModelChange}
          style={{ width: '100%', height: '100%', minHeight: 400 }}
        />
      </StyledDiagramWrapper>
    );
  },
);
