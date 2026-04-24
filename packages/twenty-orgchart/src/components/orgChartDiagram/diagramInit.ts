import * as go from 'gojs';

import type { OrgChartDiagramProps } from '../OrgChartDiagram.types';
import { PREVIEW_CAPABILITIES_TOOLTIP_DURATION_MS } from './constants';
import { buildOrgChartBackgroundContextMenu } from './contextMenus';

export const initOrgChartDiagram = ({
  createNodeTemplate,
  onBackgroundContextAction,
  showNodeCapabilitiesHoverHint,
  m7kqContactMode,
}: {
  createNodeTemplate: () => go.Node;
  onBackgroundContextAction?: OrgChartDiagramProps['onBackgroundContextAction'];
  showNodeCapabilitiesHoverHint: boolean;
  m7kqContactMode: boolean;
}): go.Diagram => {
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
};

