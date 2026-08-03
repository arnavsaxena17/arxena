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
} from 'twenty-shared/utils';

import type { OrgChartDiagramProps } from '../OrgChartDiagram.types';
import {
  getOrgChartCtxMenu,
  orgChartNodeHasM7kqMatchIds,
  type OrgChartColorScheme,
  type OrgChartCtxMenuColors,
} from './constants';

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
  menu: OrgChartCtxMenuColors,
  text: string,
): go.TextBlock =>
  $(
    go.TextBlock,
    {
      text,
      stroke: menu.text,
      font: menu.fontItem,
    },
  );

const orgChartContextSectionLabel = (
  $: OrgChartGraphObjectMake,
  menu: OrgChartCtxMenuColors,
  title: string,
): go.TextBlock =>
  $(
    go.TextBlock,
    {
      text: title.toUpperCase(),
      stroke: menu.label,
      font: menu.fontLabel,
      margin: new go.Margin(6, 12, 4, 12),
    },
  );

const orgChartContextColumnSeparator = (
  $: OrgChartGraphObjectMake,
  menu: OrgChartCtxMenuColors,
): go.Shape =>
  $(
    go.Shape,
    'Rectangle',
    {
      width: 1,
      stretch: go.GraphObject.Vertical,
      minSize: new go.Size(1, 48),
      fill: menu.sep,
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

// GoJS ContextMenuButton keeps a white ButtonBorder by default; theme it with the menu palette
const orgChartContextMenuButtonProps = (
  menu: OrgChartCtxMenuColors,
): go.ObjectData => ({
  'ButtonBorder.fill': menu.buttonFill,
  'ButtonBorder.stroke': menu.buttonStroke,
  _buttonFillOver: menu.buttonFillOver,
  _buttonFillPressed: menu.buttonFillPressed,
  _buttonStrokeOver: menu.buttonStroke,
});

const orgChartContextMenuButton = (
  $: OrgChartGraphObjectMake,
  menu: OrgChartCtxMenuColors,
  label: string,
  props: go.ObjectData = {},
  ...extra: Array<go.Binding | go.GraphObject>
): go.Panel =>
  $(
    'ContextMenuButton',
    orgChartContextItemText($, menu, label),
    {
      ...orgChartContextMenuButtonProps(menu),
      ...props,
    },
    ...extra,
  );

const orgChartContextMenuShell = (
  $: OrgChartGraphObjectMake,
  menu: OrgChartCtxMenuColors,
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
          fill: menu.fill,
          stroke: menu.stroke,
          strokeWidth: 1,
          parameter1: menu.corner,
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
  colorScheme: OrgChartColorScheme = 'light',
): go.Adornment => {
  const menu = getOrgChartCtxMenu(colorScheme);
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
    orgChartContextSectionLabel($, menu, 'Position'),
    orgChartContextMenuButton($, menu, 'Get people in this position', {
      click: (_: go.InputEvent, obj: go.GraphObject) => {
        const data = orgChartContextNodeData(obj);
        if (!data) return;
        onNodeContextAction('current_node', data, {
          selectedNodes: orgChartGetDiagramSelectedNodes(obj, data),
        });
      },
    }),
    ...(m7kqContactMode
      ? [
          orgChartContextMenuButton($, menu, 'Fetch email + phone', {
            click: (_e: go.InputEvent, obj: go.GraphObject) => {
              const data = orgChartContextNodeData(obj);
              if (data && orgChartNodeHasM7kqMatchIds(data)) {
                onNodeContextAction('m7kq_fetch_complete', data, {
                  selectedNodes: orgChartGetDiagramSelectedNodes(obj, data),
                });
              }
            },
          }),
          orgChartContextMenuButton($, menu, 'Fetch phone', {
            click: (_e: go.InputEvent, obj: go.GraphObject) => {
              const data = orgChartContextNodeData(obj);
              if (data && orgChartNodeHasM7kqMatchIds(data)) {
                onNodeContextAction('m7kq_fetch_phone', data, {
                  selectedNodes: orgChartGetDiagramSelectedNodes(obj, data),
                });
              }
            },
          }),
          orgChartContextMenuButton($, menu, 'Fetch email', {
            click: (_e: go.InputEvent, obj: go.GraphObject) => {
              const data = orgChartContextNodeData(obj);
              if (data && orgChartNodeHasM7kqMatchIds(data)) {
                onNodeContextAction('m7kq_fetch_email', data, {
                  selectedNodes: orgChartGetDiagramSelectedNodes(obj, data),
                });
              }
            },
          }),
        ]
      : []),
    orgChartContextMenuButton($, menu, 'Get all selected positions', {
      click: (_: go.InputEvent, obj: go.GraphObject) => {
        const data = orgChartContextNodeData(obj);
        if (!data) return;
        const effectiveSelected = orgChartGetDiagramSelectedNodes(obj, data);
        onNodeContextAction('selected_nodes', data, {
          selectedNodes: effectiveSelected,
        });
      },
    }),
  );

  const colLists = orgChartContextMenuColumn(
    $,
    orgChartContextSectionLabel($, menu, 'Lists & search'),
    orgChartContextMenuButton($, menu, 'Get boolean keywords string', {
      click: (_: go.InputEvent, obj: go.GraphObject) => {
        const data = orgChartContextNodeData(obj);
        if (!data) return;
        onNodeContextAction('boolean_keywords', data, {
          selectedNodes: orgChartGetDiagramSelectedNodes(obj, data),
        });
      },
    }),
    orgChartContextMenuButton($, menu, 'Get all leadership in this company', {
      click: (_: go.InputEvent, obj: go.GraphObject) => {
        const data = orgChartContextNodeData(obj);
        if (!data) return;
        onNodeContextAction('leadership', data, {
          selectedNodes: orgChartGetDiagramSelectedNodes(obj, data),
        });
      },
    }),
    orgChartContextMenuButton($, menu, 'Get all names in this company', {
      click: (_: go.InputEvent, obj: go.GraphObject) => {
        const data = orgChartContextNodeData(obj);
        if (!data) return;
        onNodeContextAction('entire_company', data, {
          selectedNodes: orgChartGetDiagramSelectedNodes(obj, data),
        });
      },
    }),
    orgChartContextMenuButton($, menu, 'Get all names in this function', {
      click: (_: go.InputEvent, obj: go.GraphObject) => {
        const data = orgChartContextNodeData(obj);
        if (!data) return;
        onNodeContextAction('function_grade', data, {
          selectedNodes: orgChartGetDiagramSelectedNodes(obj, data),
        });
      },
    }),
    orgChartContextMenuButton(
      $,
      menu,
      'Get similar names in similar companies',
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
    orgChartContextSectionLabel($, menu, 'Add to job'),
    orgChartContextMenuButton($, menu, 'Add to job and send invite', {
      click: (_: go.InputEvent, obj: go.GraphObject) => {
        const data = orgChartContextNodeData(obj);
        if (!data) return;
        onNodeContextAction('add_to_job_and_send_invite', data, {
          selectedNodes: orgChartGetDiagramSelectedNodes(obj, data),
        });
      },
    }),
    orgChartContextMenuButton($, menu, 'Add to job and invite to job', {
      click: (_: go.InputEvent, obj: go.GraphObject) => {
        const data = orgChartContextNodeData(obj);
        if (!data) return;
        onNodeContextAction('add_to_job_and_invite_to_job', data, {
          selectedNodes: orgChartGetDiagramSelectedNodes(obj, data),
        });
      },
    }),
  );

  const colOutreach = orgChartContextMenuColumn(
    $,
    orgChartContextSectionLabel($, menu, 'Outreach'),
    orgChartContextMenuButton(
      $,
      menu,
      'LinkedIn: connection request',
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
    orgChartContextMenuButton(
      $,
      menu,
      'LinkedIn: connection request (locked)',
      { click: lockedContactClick('linkedin') },
      new go.Binding(
        'visible',
        '',
        (d: OrgChartNodeData | null) => !!d && d.nodeState === 'lock',
      ),
    ),
    orgChartContextMenuButton(
      $,
      menu,
      'Send WhatsApp message',
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
    orgChartContextMenuButton(
      $,
      menu,
      'Send WhatsApp message (locked)',
      { click: lockedContactClick('phone') },
      new go.Binding(
        'visible',
        '',
        (d: OrgChartNodeData | null) => !!d && d.nodeState === 'lock',
      ),
    ),
    orgChartContextMenuButton(
      $,
      menu,
      'Add to Google Contacts',
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
    orgChartContextMenuButton(
      $,
      menu,
      'Add to Google Contacts (locked)',
      { click: lockedContactClick('email') },
      new go.Binding(
        'visible',
        '',
        (d: OrgChartNodeData | null) => !!d && d.nodeState === 'lock',
      ),
    ),
    orgChartContextMenuButton(
      $,
      menu,
      'Send email',
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
    orgChartContextMenuButton(
      $,
      menu,
      'Send email (locked)',
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
    menu,
    colPosition,
    orgChartContextColumnSeparator($, menu),
    colLists,
    orgChartContextColumnSeparator($, menu),
    colJob,
    orgChartContextColumnSeparator($, menu),
    colOutreach,
  );
};

export const buildOrgChartBackgroundContextMenu = (
  $: OrgChartGraphObjectMake,
  onBackgroundContextAction: NonNullable<
    OrgChartDiagramProps['onBackgroundContextAction']
  >,
  colorScheme: OrgChartColorScheme = 'light',
): go.Adornment => {
  const menu = getOrgChartCtxMenu(colorScheme);
  return orgChartContextMenuShell(
    $,
    menu,
    orgChartContextMenuColumn(
      $,
      orgChartContextSectionLabel($, menu, 'Company'),
      orgChartContextMenuButton($, menu, 'Get all names in this company', {
        click: () => onBackgroundContextAction('entire_company'),
      }),
      orgChartContextMenuButton(
        $,
        menu,
        'Get all leadership in this company',
        { click: () => onBackgroundContextAction('leadership') },
      ),
    ),
    orgChartContextColumnSeparator($, menu),
    orgChartContextMenuColumn(
      $,
      orgChartContextSectionLabel($, menu, 'Org chart data'),
      orgChartContextMenuButton($, menu, 'Delete saved org chart cache', {
        click: () => onBackgroundContextAction('delete_company_cache'),
      }),
      orgChartContextMenuButton(
        $,
        menu,
        'Rebuild Org Chart Using Saved People',
        {
          click: () =>
            onBackgroundContextAction('rebuild_orgchart_using_saved_people'),
        },
      ),
      orgChartContextMenuButton($, menu, 'Reload Org Intelligence', {
        click: () =>
          onBackgroundContextAction('reload_apify_org_intelligence'),
      }),
    ),
  );
};
