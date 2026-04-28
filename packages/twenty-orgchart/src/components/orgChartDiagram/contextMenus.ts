import * as go from 'gojs';
import {
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

import type { OrgChartDiagramProps } from '../OrgChartDiagram.types';
import { ORG_CHART_CTX_MENU, orgChartNodeHasM7kqMatchIds } from './constants';

type OrgChartGraphObjectMake = typeof go.GraphObject.make;

const orgChartContextNodeData = (
  obj: go.GraphObject,
): OrgChartNodeData | undefined => {
  const part = (obj.part ?? null) as go.Node | null;
  return part?.data as OrgChartNodeData | undefined;
};

const orgChartGetDiagramSelectedNodes = (
  obj: go.GraphObject,
  fallback?: OrgChartNodeData,
): OrgChartNodeData[] => {
  const dg = obj.diagram;
  const selectedNodes: OrgChartNodeData[] = [];
  if (dg) {
    dg.selection.each((p: go.Part) => {
      if (p instanceof go.Node && p.data) {
        selectedNodes.push(p.data as OrgChartNodeData);
      }
    });
  }
  if (selectedNodes.length > 0) return selectedNodes;
  return fallback ? [fallback] : [];
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

const orgChartContextColumnSeparator = ($: OrgChartGraphObjectMake): go.Shape =>
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
          defaultAlignment: go.Spot.Top,
          padding: 4,
        },
        ...columns,
      ),
    ),
  );

export const buildOrgChartNodeContextMenu = (
  $: OrgChartGraphObjectMake,
  onNodeContextAction: NonNullable<OrgChartDiagramProps['onNodeContextAction']>,
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
          if (!data) return;
          onNodeContextAction('current_node', data, {
            selectedNodes: orgChartGetDiagramSelectedNodes(obj, data),
          });
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
                  onNodeContextAction('m7kq_fetch_complete', data, {
                    selectedNodes: orgChartGetDiagramSelectedNodes(obj, data),
                  });
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
                  onNodeContextAction('m7kq_fetch_phone', data, {
                    selectedNodes: orgChartGetDiagramSelectedNodes(obj, data),
                  });
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
                  onNodeContextAction('m7kq_fetch_email', data, {
                    selectedNodes: orgChartGetDiagramSelectedNodes(obj, data),
                  });
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
          const effectiveSelected = orgChartGetDiagramSelectedNodes(obj, data);
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
          if (!data) return;
          onNodeContextAction('boolean_keywords', data, {
            selectedNodes: orgChartGetDiagramSelectedNodes(obj, data),
          });
        },
      },
    ),
    $(
      'ContextMenuButton',
      orgChartContextItemText($, 'Get all leadership in this company'),
      {
        click: (_: go.InputEvent, obj: go.GraphObject) => {
          const data = orgChartContextNodeData(obj);
          if (!data) return;
          onNodeContextAction('leadership', data, {
            selectedNodes: orgChartGetDiagramSelectedNodes(obj, data),
          });
        },
      },
    ),
    $(
      'ContextMenuButton',
      orgChartContextItemText($, 'Get all names in this company'),
      {
        click: (_: go.InputEvent, obj: go.GraphObject) => {
          const data = orgChartContextNodeData(obj);
          if (!data) return;
          onNodeContextAction('entire_company', data, {
            selectedNodes: orgChartGetDiagramSelectedNodes(obj, data),
          });
        },
      },
    ),
    $(
      'ContextMenuButton',
      orgChartContextItemText($, 'Get all names in this function'),
      {
        click: (_: go.InputEvent, obj: go.GraphObject) => {
          const data = orgChartContextNodeData(obj);
          if (!data) return;
          onNodeContextAction('function_grade', data, {
            selectedNodes: orgChartGetDiagramSelectedNodes(obj, data),
          });
        },
      },
    ),
    $(
      'ContextMenuButton',
      orgChartContextItemText($, 'Get similar names in similar companies'),
      {
        click: (_: go.InputEvent, obj: go.GraphObject) => {
          const data = orgChartContextNodeData(obj);
          if (!data) return;
          onNodeContextAction('similar_companies', data, {
            selectedNodes: orgChartGetDiagramSelectedNodes(obj, data),
          });
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
          if (!data) return;
          onNodeContextAction('add_to_job_and_send_invite', data, {
            selectedNodes: orgChartGetDiagramSelectedNodes(obj, data),
          });
        },
      },
    ),
    $(
      'ContextMenuButton',
      orgChartContextItemText($, 'Add to job and invite to job'),
      {
        click: (_: go.InputEvent, obj: go.GraphObject) => {
          const data = orgChartContextNodeData(obj);
          if (!data) return;
          onNodeContextAction('add_to_job_and_invite_to_job', data, {
            selectedNodes: orgChartGetDiagramSelectedNodes(obj, data),
          });
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
              selectedNodes: orgChartGetDiagramSelectedNodes(obj, data),
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
      new go.Binding(
        'visible',
        '',
        (d: OrgChartNodeData | null) => !!d && d.nodeState === 'lock',
      ),
    ),
    $(
      'ContextMenuButton',
      orgChartContextItemText($, 'Send WhatsApp message'),
      {
        click: (_: go.InputEvent, obj: go.GraphObject) => {
          const data = orgChartContextNodeData(obj);
          if (data) {
            onNodeContextAction('outreach_whatsapp', data, {
              selectedNodes: orgChartGetDiagramSelectedNodes(obj, data),
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
      new go.Binding(
        'visible',
        '',
        (d: OrgChartNodeData | null) => !!d && d.nodeState === 'lock',
      ),
    ),
    $(
      'ContextMenuButton',
      orgChartContextItemText($, 'Add to Google Contacts'),
      {
        click: (_: go.InputEvent, obj: go.GraphObject) => {
          const data = orgChartContextNodeData(obj);
          if (data) {
            onNodeContextAction('outreach_google_contact', data, {
              selectedNodes: orgChartGetDiagramSelectedNodes(obj, data),
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
      new go.Binding(
        'visible',
        '',
        (d: OrgChartNodeData | null) => !!d && d.nodeState === 'lock',
      ),
    ),
    $(
      'ContextMenuButton',
      orgChartContextItemText($, 'Send email'),
      {
        click: (_: go.InputEvent, obj: go.GraphObject) => {
          const data = orgChartContextNodeData(obj);
          if (data) {
            onNodeContextAction('outreach_email', data, {
              selectedNodes: orgChartGetDiagramSelectedNodes(obj, data),
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
      new go.Binding(
        'visible',
        '',
        (d: OrgChartNodeData | null) => !!d && d.nodeState === 'lock',
      ),
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

export const buildOrgChartBackgroundContextMenu = (
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

