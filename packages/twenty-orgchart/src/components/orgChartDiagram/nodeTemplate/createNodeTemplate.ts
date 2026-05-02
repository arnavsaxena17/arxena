import * as go from 'gojs';
import { isValidLinkedInProfileUrl, type OrgChartNodeData } from 'twenty-shared';

import type { OrgChartDiagramProps } from '../../OrgChartDiagram.types';
import {
    DEFAULT_DOWNLOAD_ICON,
    DEFAULT_LINKEDIN_ICON,
    DEFAULT_LOCK_ICON,
    DEFAULT_M7KQ_EMAIL_ICON,
    DEFAULT_M7KQ_PHONE_ICON,
    DEFAULT_SIMILAR_ITEMS_ICON,
    NODE_CAPABILITIES_BULLETS,
    getOrgChartDataFromToolTipObject,
} from '../constants';
import { buildOrgChartNodeContextMenu } from '../contextMenus';

export const createNodeTemplate = ({
  defaultAvatarUrl,
  iconUrls,
  onNodeContextAction,
  onNodeClick,
  onNodeDoubleClick,
  onDownloadNode,
  onSimilarPeople,
  showNodeCapabilitiesHoverHint,
  capabilitiesHoverCompanyLabel,
  m7kqContactMode,
  showLinkedInUrlOnNodes = false,
  onLockedContactChannelClick,
}: {
  defaultAvatarUrl: string;
  iconUrls?: OrgChartDiagramProps['iconUrls'];
  onNodeContextAction?: OrgChartDiagramProps['onNodeContextAction'];
  onNodeClick?: OrgChartDiagramProps['onNodeClick'];
  onNodeDoubleClick?: OrgChartDiagramProps['onNodeDoubleClick'];
  onDownloadNode?: OrgChartDiagramProps['onDownloadNode'];
  onSimilarPeople?: OrgChartDiagramProps['onSimilarPeople'];
  showNodeCapabilitiesHoverHint: boolean;
  capabilitiesHoverCompanyLabel: string;
  m7kqContactMode: boolean;
  showLinkedInUrlOnNodes?: boolean;
  onLockedContactChannelClick?: OrgChartDiagramProps['onLockedContactChannelClick'];
}): go.Node => {
  const LOCK_ICON_URL = iconUrls?.lock ?? DEFAULT_LOCK_ICON;
  const LINKEDIN_ICON_URL = iconUrls?.linkedin ?? DEFAULT_LINKEDIN_ICON;
  const DOWNLOAD_ICON_URL = iconUrls?.download ?? DEFAULT_DOWNLOAD_ICON;
  const SIMILAR_ITEMS_ICON_URL = iconUrls?.similarItems ?? DEFAULT_SIMILAR_ITEMS_ICON;
  const M7KQ_EMAIL_ICON_URL = iconUrls?.email ?? DEFAULT_M7KQ_EMAIL_ICON;
  const M7KQ_PHONE_ICON_URL = iconUrls?.phone ?? DEFAULT_M7KQ_PHONE_ICON;

  const $ = go.GraphObject.make;
  type OrgChartNodeState = 'active' | 'preview' | 'lock';
  type OrgChartDataMap = Record<string, string | number | boolean | undefined>;

  const buildCapabilitiesHoverIntro = (data: OrgChartNodeData | undefined): string => {
    const role =
      typeof data?.headline === 'string' && data.headline.trim()
        ? data.headline.trim()
        : 'people in this role';
    return `These are the ${role} teams at ${capabilitiesHoverCompanyLabel}.`;
  };

  const findSize = (size: string | number | undefined): number => {
    const n = typeof size === 'number' ? size : parseInt(String(size ?? 0), 10);
    return Number.isNaN(n) ? 0 : n;
  };

  const textSeeMore = (total: string | number | undefined): string => {
    const count = typeof total === 'number' ? total : parseInt(String(total ?? 0), 10);
    const num = Number.isNaN(count) ? 0 : count;
    return num === 1 ? '1 executive' : `${num} executives`;
  };

  const getLabelFromNodeState = (s: string | undefined): string => {
    if (s === 'active') return 'Active';
    if (s === 'preview') return 'Preview';
    if (s === 'lock') return 'Live';
    return '';
  };

  const showLabelContainer = (s: string | undefined): number => {
    const label = getLabelFromNodeState(s);
    return ['Preview', 'Active', 'Live'].includes(label) ? 20 : 0;
  };

  const showLabelContainerTable = (s: string | undefined): number => {
    const label = getLabelFromNodeState(s);
    return ['Preview', 'Active', 'Live'].includes(label) ? 40 : 20;
  };

  const textLabel = (s: string | undefined): string => getLabelFromNodeState(s);

  const colorLabel = (s: string | undefined): string => {
    if (s === 'active') return 'PaleGreen';
    if (s === 'lock') return '#16a34a';
    return 'rgb(36,116,204)';
  };

  const findIconSource = (nodeState: string | undefined): string =>
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

  const m7kqChannelClick = (
    slotIdx: number,
    channel: 'email' | 'phone' | 'linkedin',
  ) => {
    return (_e: go.InputEvent, obj: go.GraphObject) => {
      if (!onLockedContactChannelClick) return;
      const data = getOrgChartNodeDataFromObject(obj);
      if (data) {
        onLockedContactChannelClick(data, slotIdx, channel);
      }
    };
  };

  const createCandidateRow = (idx: number, rowIndex: number) => {
    const slotEmail = (d: OrgChartDataMap | undefined): string => {
      if (!d) return '';
      const v = d[`email_${idx}`];
      return typeof v === 'string' ? v.trim() : '';
    };
    const slotPhone = (d: OrgChartDataMap | undefined): string => {
      if (!d) return '';
      const v = d[`phone_${idx}`];
      return typeof v === 'string' ? v.trim() : '';
    };
    const slotLinkedInUrl = (d: OrgChartDataMap | undefined): string => {
      if (!d) return '';
      const v = d[`linkedin_url_${idx}`];
      return typeof v === 'string' ? v.trim() : '';
    };
    const nodeStateOf = (d: OrgChartDataMap | undefined): string =>
      typeof d?.nodeState === 'string' ? (d.nodeState as string) : '';

    const m7kqEmailToolTipText = (d: OrgChartDataMap | undefined): string => {
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

    const m7kqPhoneToolTipText = (d: OrgChartDataMap | undefined): string => {
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

    const m7kqLinkedInToolTipText = (
      d: OrgChartDataMap | undefined,
    ): string => {
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
      d: OrgChartDataMap | undefined,
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
      d: OrgChartDataMap | undefined,
    ): { text: string; stroke: string } => {
      if (!d) return { text: '·', stroke: '#e2e8f0' };
      const pv = slotPhone(d);
      if (pv) return { text: '●', stroke: '#22c55e' };
      if (d[`has_direct_phone_${idx}`] === true || d[`has_org_phone_${idx}`] === true) {
        return { text: '●', stroke: '#cbd5e1' };
      }
      if (d[`has_direct_phone_${idx}`] === false && d[`has_org_phone_${idx}`] === false) {
        return { text: '◦', stroke: '#cbd5e1' };
      }
      return { text: '·', stroke: '#e2e8f0' };
    };

    const m7kqLinkedInStatusDot = (
      d: OrgChartDataMap | undefined,
    ): { text: string; stroke: string } => {
      if (!d) return { text: '·', stroke: '#e2e8f0' };
      const url = slotLinkedInUrl(d);
      if (isValidLinkedInProfileUrl(url)) return { text: '●', stroke: '#22c55e' };
      return { text: '◦', stroke: '#cbd5e1' };
    };

    const m7kqLinkedInClick = (_e: go.InputEvent, obj: go.GraphObject) => {
      const data = getOrgChartNodeDataFromObject(obj);
      if (!data) return;
      const r = data as OrgChartDataMap;
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
                  (_: string | boolean | undefined, obj: go.GraphObject) =>
                    m7kqEmailToolTipText(
                      getOrgChartDataFromToolTipObject(obj) as
                        | OrgChartDataMap
                        | undefined,
                    ),
                ),
                new go.Binding(
                  'text',
                  `has_email_${idx}` as const,
                  (_: string | boolean | undefined, obj: go.GraphObject) =>
                    m7kqEmailToolTipText(
                      getOrgChartDataFromToolTipObject(obj) as
                        | OrgChartDataMap
                        | undefined,
                    ),
                ),
                new go.Binding(
                  'text',
                  'nodeState',
                  (_: string | boolean | undefined, obj: go.GraphObject) =>
                    m7kqEmailToolTipText(
                      getOrgChartDataFromToolTipObject(obj) as
                        | OrgChartDataMap
                        | undefined,
                    ),
                ),
              ),
            ),
          },
          new go.Binding('visible', 'nodeState', (s: string | undefined) => s !== 'preview'),
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
            new go.Binding(
              'text',
              `email_${idx}` as const,
              (_: string | boolean | undefined, obj: go.GraphObject) =>
                m7kqEmailStatusDot(obj.part?.data as OrgChartDataMap | undefined).text,
            ),
            new go.Binding(
              'text',
              `has_email_${idx}` as const,
              (_: string | boolean | undefined, obj: go.GraphObject) =>
                m7kqEmailStatusDot(obj.part?.data as OrgChartDataMap | undefined).text,
            ),
            new go.Binding(
              'stroke',
              `email_${idx}` as const,
              (_: string | boolean | undefined, obj: go.GraphObject) =>
                m7kqEmailStatusDot(obj.part?.data as OrgChartDataMap | undefined).stroke,
            ),
            new go.Binding(
              'stroke',
              `has_email_${idx}` as const,
              (_: string | boolean | undefined, obj: go.GraphObject) =>
                m7kqEmailStatusDot(obj.part?.data as OrgChartDataMap | undefined).stroke,
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
                  (_: string | boolean | undefined, obj: go.GraphObject) =>
                    m7kqPhoneToolTipText(
                      getOrgChartDataFromToolTipObject(obj) as
                        | OrgChartDataMap
                        | undefined,
                    ),
                ),
                new go.Binding(
                  'text',
                  `has_direct_phone_${idx}` as const,
                  (_: string | boolean | undefined, obj: go.GraphObject) =>
                    m7kqPhoneToolTipText(
                      getOrgChartDataFromToolTipObject(obj) as
                        | OrgChartDataMap
                        | undefined,
                    ),
                ),
                new go.Binding(
                  'text',
                  `has_org_phone_${idx}` as const,
                  (_: string | boolean | undefined, obj: go.GraphObject) =>
                    m7kqPhoneToolTipText(
                      getOrgChartDataFromToolTipObject(obj) as
                        | OrgChartDataMap
                        | undefined,
                    ),
                ),
                new go.Binding(
                  'text',
                  'nodeState',
                  (_: string | boolean | undefined, obj: go.GraphObject) =>
                    m7kqPhoneToolTipText(
                      getOrgChartDataFromToolTipObject(obj) as
                        | OrgChartDataMap
                        | undefined,
                    ),
                ),
              ),
            ),
          },
          new go.Binding('visible', 'nodeState', (s: string | undefined) => s !== 'preview'),
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
              (_: string | boolean | undefined, obj: go.GraphObject) =>
                m7kqPhoneStatusDot(obj.part?.data as OrgChartDataMap | undefined).text,
            ),
            new go.Binding(
              'text',
              `has_direct_phone_${idx}` as const,
              (_: string | boolean | undefined, obj: go.GraphObject) =>
                m7kqPhoneStatusDot(obj.part?.data as OrgChartDataMap | undefined).text,
            ),
            new go.Binding(
              'text',
              `has_org_phone_${idx}` as const,
              (_: string | boolean | undefined, obj: go.GraphObject) =>
                m7kqPhoneStatusDot(obj.part?.data as OrgChartDataMap | undefined).text,
            ),
            new go.Binding(
              'stroke',
              `phone_${idx}` as const,
              (_: string | boolean | undefined, obj: go.GraphObject) =>
                m7kqPhoneStatusDot(obj.part?.data as OrgChartDataMap | undefined).stroke,
            ),
            new go.Binding(
              'stroke',
              `has_direct_phone_${idx}` as const,
              (_: string | boolean | undefined, obj: go.GraphObject) =>
                m7kqPhoneStatusDot(obj.part?.data as OrgChartDataMap | undefined).stroke,
            ),
            new go.Binding(
              'stroke',
              `has_org_phone_${idx}` as const,
              (_: string | boolean | undefined, obj: go.GraphObject) =>
                m7kqPhoneStatusDot(obj.part?.data as OrgChartDataMap | undefined).stroke,
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
                  (_: string | boolean | undefined, obj: go.GraphObject) =>
                    m7kqLinkedInToolTipText(
                      getOrgChartDataFromToolTipObject(obj) as
                        | OrgChartDataMap
                        | undefined,
                    ),
                ),
                new go.Binding(
                  'text',
                  'nodeState',
                  (_: string | boolean | undefined, obj: go.GraphObject) =>
                    m7kqLinkedInToolTipText(
                      getOrgChartDataFromToolTipObject(obj) as
                        | OrgChartDataMap
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
              (_: string | boolean | undefined, obj: go.GraphObject) =>
                m7kqLinkedInStatusDot(obj.part?.data as OrgChartDataMap | undefined).text,
            ),
            new go.Binding(
              'stroke',
              `linkedin_url_${idx}` as const,
              (_: string | boolean | undefined, obj: go.GraphObject) =>
                m7kqLinkedInStatusDot(obj.part?.data as OrgChartDataMap | undefined).stroke,
            ),
          ),
        ),
      ),
    );

    const classicLinkedInProfileToolTip = makeM7kqChannelToolTip(
      $(
        go.TextBlock,
        {
          margin: new go.Margin(8, 10, 8, 10),
          font: '10pt system-ui, Segoe UI, sans-serif',
          wrap: go.TextBlock.WrapFit,
          maxSize: new go.Size(380, NaN),
          textAlign: 'left',
          stroke: '#0f172a',
        },
        new go.Binding(
          'text',
          `linkedin_url_${idx}` as const,
          (url: string | undefined) => {
            const u = typeof url === 'string' ? url.trim() : '';
            if (isValidLinkedInProfileUrl(u)) {
              return `${u}\n\nClick to open in a new tab`;
            }
            return 'No LinkedIn profile URL for this person';
          },
        ),
      ),
    );

    const classicLinkedInOpenClick = (_e: go.InputEvent, obj: go.GraphObject) => {
      const node = obj.part as go.Node | undefined;
      const data = node?.data as OrgChartNodeData | undefined;
      if (!data) return;
      const urlRaw = (data as OrgChartDataMap)[`linkedin_url_${idx}`];
      const url = typeof urlRaw === 'string' ? urlRaw.trim() : '';
      if (isValidLinkedInProfileUrl(url)) {
        window.open(url.startsWith('http') ? url : `https://${url}`, '_blank');
      }
    };

    const classicLinkedInIconPicture = $(
      go.Picture,
      {
        desiredSize: new go.Size(12, 12),
        imageStretch: go.GraphObject.UniformToFill,
      },
      new go.Binding('source', 'nodeState', findIconSource),
    );

    const classicLinkedInCell = showLinkedInUrlOnNodes
      ? $(
          go.Panel,
          'Vertical',
          {
            row: 0,
            column: 2,
            rowSpan: 2,
            alignment: go.Spot.Top,
            margin: new go.Margin(2, 2, 2, 0),
            toolTip: classicLinkedInProfileToolTip,
          },
          new go.Binding(
            'visible',
            `linkedin_url_${idx}` as const,
            (url: string | undefined) =>
              isValidLinkedInProfileUrl(typeof url === 'string' ? url : undefined),
          ),
          $(
            go.Panel,
            'Spot',
            {
              isClipping: true,
              alignment: go.Spot.Center,
              cursor: 'pointer',
              width: 10,
              click: classicLinkedInOpenClick,
            },
            $(go.Shape, 'Circle', { width: 10, height: 10, strokeWidth: 0, fill: 'white' }),
            classicLinkedInIconPicture,
          ),
          $(
            go.TextBlock,
            {
              font: '6pt system-ui, Segoe UI, sans-serif',
              stroke: '#0a66c2',
              maxLines: 2,
              overflow: go.TextBlock.OverflowEllipsis,
              width: 84,
              wrap: go.TextBlock.WrapFit,
              textAlign: 'left',
              cursor: 'pointer',
              margin: new go.Margin(2, 0, 0, 0),
              click: classicLinkedInOpenClick,
              toolTip: classicLinkedInProfileToolTip,
            },
            new go.Binding(
              'visible',
              `linkedin_url_${idx}` as const,
              (url: string | undefined) =>
                isValidLinkedInProfileUrl(typeof url === 'string' ? url : undefined),
            ),
            new go.Binding(
              'text',
              `linkedin_url_${idx}` as const,
              (url: string | undefined) => {
                const u = typeof url === 'string' ? url.trim() : '';
                if (!isValidLinkedInProfileUrl(u)) return '';
                return u.length > 46 ? `${u.slice(0, 45)}…` : u;
              },
            ),
          ),
        )
      : $(
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
            click: classicLinkedInOpenClick,
            toolTip: classicLinkedInProfileToolTip,
          },
          new go.Binding(
            'visible',
            `linkedin_url_${idx}` as const,
            (url: string | undefined) =>
              isValidLinkedInProfileUrl(typeof url === 'string' ? url : undefined),
          ),
          $(go.Shape, 'Circle', { width: 10, height: 10, strokeWidth: 0, fill: 'white' }),
          classicLinkedInIconPicture,
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
      $(
        go.RowColumnDefinition,
        { column: 2, width: m7kqContactMode ? 64 : showLinkedInUrlOnNodes ? 90 : 18 },
      ),
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
            // Ensure broken/blocked images always fall back.
            errorFunction: (pic: go.Picture) => {
              pic.source = defaultAvatarUrl;
            },
          },
          new go.Binding(
            'source',
            `image_${idx}` as const,
            (src) => (src as string) || defaultAvatarUrl,
          ),
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
        new go.Binding('text', `name_${idx}` as const, (n) => (n as string) || ''),
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
        new go.Binding('text', `title_${idx}` as const, (t) => (t as string) || ''),
      ),
      m7kqContactMode ? m7kqContactStrip : classicLinkedInCell,
    );
  };

  const capabilitiesIntroBinding = new go.Binding(
    'text',
    '',
    (_val: string | undefined, obj: go.GraphObject) =>
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
          const allCandidates = (data as { allCandidates?: unknown }).allCandidates;
          // eslint-disable-next-line no-console
          console.log('[orgchart/OrgChartDiagram/doubleClick]', {
            headline: data.headline,
            key: data.key,
            totalPeople: data.total_people,
            allCandidatesLength: Array.isArray(allCandidates) ? allCandidates.length : null,
          });
          onNodeDoubleClick(data);
        }
      },
    },
    new go.Binding('toolTip', 'nodeState', (state: OrgChartNodeState | undefined) => {
      if (state === 'lock') {
        return lockedNodeToolTip;
      }
      if (state === 'preview' && showNodeCapabilitiesHoverHint && nodeHoverToolTip) {
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
                  const part = obj.part as go.Node | undefined;
                  const data = part?.data as OrgChartNodeData | undefined;
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
                  const part = obj.part as go.Node | undefined;
                  const data = part?.data as OrgChartNodeData | undefined;
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
};

