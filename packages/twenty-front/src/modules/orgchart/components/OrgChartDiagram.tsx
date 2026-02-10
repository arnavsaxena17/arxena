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

import type { OrgChartNodeData } from '../utils/orgChartDataUtils';

const DEFAULT_AVATAR =
  'https://st2.depositphotos.com/4111759/12123/v/950/depositphotos_121232442-stock-illustration-male-default-placeholder-avatar-profile.jpg';

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

function createNodeTemplate(): go.Node {
  const $ = go.GraphObject.make;

  return $(
    go.Node,
    'Auto',
    {
      cursor: 'pointer',
      fromSpot: go.Spot.Bottom,
      toSpot: go.Spot.Top,
    },
    $(
      go.Panel,
      'Auto',
      $(
        go.Shape,
        'RoundedRectangle',
        {
          name: 'SHAPE',
          fill: 'white',
          stroke: 'rgb(150,150,150)',
          strokeWidth: 1,
          width: 230,
          portId: '',
          fromLinkable: true,
          toLinkable: true,
        },
        // Match legacy search highlighting behavior
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
        'Vertical',
        { margin: 8 },
        $(
          go.TextBlock,
          {
            font: 'bold 12pt Segoe UI, sans-serif',
            wrap: go.TextBlock.WrapFit,
            textAlign: 'center',
            maxSize: new go.Size(200, NaN),
          },
          new go.Binding('text', 'headline'),
        ),
        $(
          go.Panel,
          'Horizontal',
          { margin: new go.Margin(4, 0, 0, 0) },
          $(
            go.Panel,
            'Spot',
            {
              width: 30,
              height: 30,
              margin: new go.Margin(0, 8, 0, 0),
            },
            $(go.Shape, 'Circle', { width: 30, height: 30, strokeWidth: 0 }),
            $(
              go.Picture,
              {
                desiredSize: new go.Size(30, 30),
                imageStretch: go.GraphObject.UniformToFill,
                errorFunction: () => DEFAULT_AVATAR,
              },
              new go.Binding('source', 'image_0', (src) => src || DEFAULT_AVATAR),
            ),
          ),
          $(
            go.Panel,
            'Vertical',
            $(
              go.TextBlock,
              {
                font: '11pt Segoe UI, sans-serif',
                wrap: go.TextBlock.WrapFit,
                maxSize: new go.Size(160, NaN),
              },
              new go.Binding('text', 'name_0', (n) => n || ''),
            ),
            $(
              go.TextBlock,
              {
                font: '10pt Segoe UI, sans-serif',
                wrap: go.TextBlock.WrapFit,
                stroke: '#666',
                maxSize: new go.Size(160, NaN),
              },
              new go.Binding('text', 'title_0', (t) => t || ''),
            ),
          ),
        ),
      ),
    ),
  );
}

function initDiagram(): go.Diagram {
  const $ = go.GraphObject.make;

  const diagram = $(
    go.Diagram,
    {
      'undoManager.isEnabled': true,
      initialContentAlignment: go.Spot.Center,
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
    $(go.Shape, { strokeWidth: 1.5, stroke: '#999' }),
  );

  // Depth-based stroke gradient similar to legacy org chart
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
  // Access protected commitNodes via a typed escape hatch;
  // this mirrors the vanilla JS override used in the legacy app.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baseCommitNodes = (layout as any).commitNodes.bind(layout);

  // Override commitNodes to apply level-based colors
  // eslint-disable-next-line func-names, @typescript-eslint/no-explicit-any
  (layout as any).commitNodes = function () {
    baseCommitNodes();
    const network = layout.network;
    if (!network) {
      return;
    }

    network.vertexes.each((v) => {
      const tv = v as go.TreeVertex;
      const node = tv.node;
      if (!node) {
        return;
      }

      const level = tv.level % levelColors.length;
      const color = levelColors[level];
      const shape = node.findObject('SHAPE') as go.Shape | null;
      if (!shape) {
        return;
      }

      shape.stroke = $(go.Brush, 'Linear', {
        0: color,
        1: go.Brush.lightenBy(color, 0.05),
        start: go.Spot.Left,
        end: go.Spot.Right,
      });
    });
  };

  return diagram;
}

export type OrgChartDiagramProps = {
  nodeDataArray: OrgChartNodeData[];
};

export type OrgChartDiagramHandle = {
  search: (keyword: string) => number;
  focusNextResult: () => void;
  focusPreviousResult: () => void;
  clearSearch: () => void;
  getSearchResultCount: () => number;
};

export const OrgChartDiagram = forwardRef<OrgChartDiagramHandle, OrgChartDiagramProps>(
  ({ nodeDataArray }, ref) => {
    const diagramRef = useRef<ReactDiagram>(null);
    const overviewDivRef = useRef<HTMLDivElement | null>(null);
    const overviewRef = useRef<go.Overview | null>(null);
    const hasCenteredRef = useRef(false);
    const searchResultsKeysRef = useRef<go.Key[]>([]);
    const currentResultIndexRef = useRef(0);

    const handleModelChange = useCallback(() => {
      // No-op for now; can sync state if needed
    }, []);

    const getDiagram = useCallback((): go.Diagram | null => {
      const diagramHost = diagramRef.current as unknown as {
        getDiagram?: () => go.Diagram | null;
      } | null;

      return diagramHost?.getDiagram?.() ?? null;
    }, []);

    useEffect(() => {
      const diagram = getDiagram();
      const overviewDiv = overviewDivRef.current;

      if (!diagram || !overviewDiv) {
        return;
      }

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
        if (!diagram) {
          return;
        }

        const keys = searchResultsKeysRef.current;
        if (!keys.length) {
          return;
        }

        const safeIndex = ((index % keys.length) + keys.length) % keys.length;
        const key = keys[safeIndex];
        const part = diagram.findPartForKey(key);
        if (!part) {
          return;
        }

        diagram.zoomToRect(part.actualBounds);
        diagram.centerRect(part.actualBounds);
        diagram.commandHandler.decreaseZoom(0.3);
        currentResultIndexRef.current = safeIndex;
      },
      [getDiagram],
    );

    const performSearch = useCallback(
      (keyword: string): number => {
        const diagram = getDiagram();
        if (!diagram) {
          return 0;
        }

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
        results.each((item) => {
          keys.push(item.data.key);
        });
        searchResultsKeysRef.current = keys;
        currentResultIndexRef.current = 0;

        diagram.highlightCollection(results);

        const first = results.first();
        if (first) {
          diagram.zoomToRect(first.actualBounds);
          diagram.centerRect(first.actualBounds);
          diagram.commandHandler.decreaseZoom(0.3);
        } else {
          diagram.commandHandler.zoomToFit();
        }

        diagram.commitTransaction('highlight search');

        return keys.length;
      },
      [getDiagram],
    );

    const focusNextResult = useCallback(() => {
      const nextIndex = currentResultIndexRef.current + 1;
      focusResultAtIndex(nextIndex);
    }, [focusResultAtIndex]);

    const focusPreviousResult = useCallback(() => {
      const prevIndex = currentResultIndexRef.current - 1;
      focusResultAtIndex(prevIndex);
    }, [focusResultAtIndex]);

    const clearSearch = useCallback(() => {
      const diagram = getDiagram();
      if (!diagram) {
        return;
      }

      searchResultsKeysRef.current = [];
      currentResultIndexRef.current = 0;

      diagram.startTransaction('highlight search');
      diagram.clearHighlighteds();
      diagram.commitTransaction('highlight search');
      diagram.commandHandler.zoomToFit();
    }, [getDiagram]);

    useImperativeHandle(
      ref,
      () => ({
        search: performSearch,
        focusNextResult,
        focusPreviousResult,
        clearSearch,
        getSearchResultCount: () => searchResultsKeysRef.current.length,
      }),
      [clearSearch, focusNextResult, focusPreviousResult, performSearch],
    );

    useEffect(() => {
      hasCenteredRef.current = false;
    }, [nodeDataArray]);

    useEffect(() => {
      const diagram = getDiagram();
      if (!diagram) {
        return;
      }

      const handleInitialLayout = () => {
        if (hasCenteredRef.current) {
          return;
        }
        hasCenteredRef.current = true;

        const ceoNode = diagram
          .findNodesByExample({ std_function: 'ceo', std_grade: 'ceo' })
          .first();

        if (ceoNode) {
          diagram.commandHandler.scrollToPart(ceoNode);
          return;
        }

        const firstNode = diagram.nodes.first();
        if (firstNode) {
          diagram.commandHandler.scrollToPart(firstNode);
        }
      };

      diagram.addDiagramListener('InitialLayoutCompleted', handleInitialLayout);

      return () => {
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
