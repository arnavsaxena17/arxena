import * as go from 'gojs';

import type { OrgChartDiagramProps } from '../OrgChartDiagram.types';
import { PREVIEW_CAPABILITIES_TOOLTIP_DURATION_MS } from './constants';
import { buildOrgChartBackgroundContextMenu } from './contextMenus';
import {
  GradeAlignedTreeLayout,
  compareTreeVertexByGradeTier,
} from './gradeAlignedTreeLayout';
import { LevelColoredTreeLayout } from './levelColoredTreeLayout';

const createDefaultTreeLayout = (
  $: typeof go.GraphObject.make,
): LevelColoredTreeLayout =>
  $(LevelColoredTreeLayout, {
    angle: 90,
    layerSpacing: 35,
    arrangement: go.TreeLayout.ArrangementHorizontal,
  });

const createGradeAlignedTreeLayout = (
  $: typeof go.GraphObject.make,
): GradeAlignedTreeLayout =>
  $(GradeAlignedTreeLayout, {
    angle: 90,
    layerSpacing: 45,
    nodeSpacing: 30,
    arrangement: go.TreeLayout.ArrangementHorizontal,
    sorting: go.TreeSorting.Ascending,
    comparer: compareTreeVertexByGradeTier,
  });

export const initOrgChartDiagram = ({
  createNodeTemplate,
  onBackgroundContextAction,
  showNodeCapabilitiesHoverHint,
  m7kqContactMode,
  showLinkedInUrlOnNodes = false,
  gradeAlignedLayout = false,
  colorScheme = 'light',
}: {
  createNodeTemplate: () => go.Node;
  onBackgroundContextAction?: OrgChartDiagramProps['onBackgroundContextAction'];
  showNodeCapabilitiesHoverHint: boolean;
  m7kqContactMode: boolean;
  showLinkedInUrlOnNodes?: boolean;
  gradeAlignedLayout?: boolean;
  colorScheme?: OrgChartDiagramProps['colorScheme'];
}): go.Diagram => {
  const $ = go.GraphObject.make;

  const diagram = $(go.Diagram, {
    ...(showNodeCapabilitiesHoverHint ||
    m7kqContactMode ||
    showLinkedInUrlOnNodes
      ? {
          'toolManager.hoverDelay': 0,
          'toolManager.toolTipDuration':
            PREVIEW_CAPABILITIES_TOOLTIP_DURATION_MS,
        }
      : {}),
    'undoManager.isEnabled': true,
    initialContentAlignment: go.Spot.Default,
    validCycle: go.Diagram.CycleDestinationTree,
    layout: gradeAlignedLayout
      ? createGradeAlignedTreeLayout($)
      : createDefaultTreeLayout($),
    model: $(go.TreeModel, {
      nodeKeyProperty: 'key',
      nodeParentKeyProperty: 'parent',
      makeUniqueKeyFunction: (m: go.Model, data: go.ObjectData) => {
        let k = (data.key as number) || 1;
        while (m.findNodeDataForKey(k)) k += 1;
        data.key = k;
        return k;
      },
    }),
  });

  diagram.nodeTemplate = createNodeTemplate();
  diagram.linkTemplate = $(
    go.Link,
    { routing: go.Link.Orthogonal, corner: 5 },
    $(go.Shape, { strokeWidth: 4, stroke: '#00a4a4' }),
  );

  diagram.scrollMargin = new go.Margin(800, 4000, 800, 4000);

  if (onBackgroundContextAction) {
    const $c = go.GraphObject.make;
    diagram.contextMenu = buildOrgChartBackgroundContextMenu(
      $c,
      onBackgroundContextAction,
      colorScheme,
    );
  }

  return diagram;
};
