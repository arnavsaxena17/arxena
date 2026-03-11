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

import type { OrgChartNodeData } from 'twenty-shared';

import type {
  OrgChartDiagramHandle,
  OrgChartDiagramProps
} from './OrgChartDiagram.types';

export type {
  OrgChartContextAction,
  OrgChartDiagramHandle,
  OrgChartDiagramIconUrls,
  OrgChartDiagramProps
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
    },
    ref,
  ) => {
    const LOCK_ICON_URL = iconUrls?.lock ?? DEFAULT_LOCK_ICON;
    const LINKEDIN_ICON_URL = iconUrls?.linkedin ?? DEFAULT_LINKEDIN_ICON;
    const DOWNLOAD_ICON_URL = iconUrls?.download ?? DEFAULT_DOWNLOAD_ICON;
    const SIMILAR_ITEMS_ICON_URL = iconUrls?.similarItems ?? DEFAULT_SIMILAR_ITEMS_ICON;
    const diagramRef = useRef<ReactDiagram>(null);
    const overviewDivRef = useRef<HTMLDivElement | null>(null);
    const overviewRef = useRef<go.Overview | null>(null);
    const hasCenteredRef = useRef(false);
    const searchResultsKeysRef = useRef<go.Key[]>([]);
    const currentResultIndexRef = useRef(0);

    const handleModelChange = useCallback(() => {}, []);

    const createNodeTemplate = useCallback((): go.Node => {
      const $ = go.GraphObject.make;

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
        if (s === 'lock') return 'Lock';
        return '';
      };

      const showLabelContainer = (s: unknown): number => {
        const label = getLabelFromNodeState(s);
        return ['Preview', 'Active', 'Lock'].includes(label) ? 20 : 0;
      };

      const showLabelContainerTable = (s: unknown): number => {
        const label = getLabelFromNodeState(s);
        return ['Preview', 'Active', 'Lock'].includes(label) ? 40 : 20;
      };

      const textLabel = (s: unknown): string => getLabelFromNodeState(s);

      const colorLabel = (s: unknown): string => {
        if (s === 'active') return 'PaleGreen';
        if (s === 'lock') return '#64748b';
        return 'rgb(36,116,204)';
      };

      const findIconSource = (nodeState: unknown): string =>
        nodeState === 'active' ? LINKEDIN_ICON_URL : LOCK_ICON_URL;

      // Fixed height per candidate row: name (1 line) + title (2 lines max) + padding. Avoids empty gaps.

      const CANDIDATE_ROW_HEIGHT = 52;





      const createCandidateRow = (idx: number, rowIndex: number) =>
        $(
          go.Panel,
          'Table',
          {
            row: rowIndex,
            column: 0,
            stretch: go.Stretch.Horizontal,
            defaultAlignment: go.Spot.Left,
          },
          new go.Binding('height', `height_${idx}` as const, findSize),
          $(go.RowColumnDefinition, { column: 0, width: 50 }),
          $(go.RowColumnDefinition, { column: 1 }),
          $(go.RowColumnDefinition, { column: 2, width: 18 }),
          $(
            go.Panel,
            'Spot',
            {
              row: 0,
              column: 0,
              rowSpan: 2,
              isClipping: true,
              scale: 1,
              margin: new go.Margin(6, 8, 6, 10),
            },
            $(go.Shape, 'Circle', { width: 30, strokeWidth: 0 }),
            $(
              go.Picture,
              {
                desiredSize: new go.Size(30, 30),
                imageStretch: go.GraphObject.UniformToFill,
                errorFunction: () => defaultAvatarUrl,
              },
              new go.Binding('source', `image_${idx}` as const, (src) =>
                src || defaultAvatarUrl,
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
              width: 150,
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
              width: 150,
            },
            new go.Binding('text', `title_${idx}` as const, (t) => t || ''),
          ),
          $(
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
                if (url && typeof url === 'string') {
                  window.open(
                    url.startsWith('http') ? url : `https://${url}`,
                    '_blank',
                  );
                }
              },
            },
            $(
              go.Shape,
              'Circle',
              { width: 10, height: 10, strokeWidth: 0, fill: 'white' },
            ),
            $(
              go.Picture,
              {
                desiredSize: new go.Size(12, 12),
                imageStretch: go.GraphObject.UniformToFill,
              },
              new go.Binding('source', 'nodeState', findIconSource),
            ),
          ),
        );

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
            if (data) onNodeDoubleClick(data);
          },
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
              strokeWidth: 1,
              stroke: 'rgb(150,150,150)',
              cursor: 'pointer',
              width: 230,
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
            { width: 220 },
            new go.Binding(
              'padding',
              'nodeState',
              (s: string) =>
                s === 'preview'
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
        node.contextMenu = $c(
          'ContextMenu',
          $c(
            'ContextMenuButton',
            $c(go.TextBlock, 'Get people in this position'),
            {
              click: (_, obj) => {
                const part = (obj.part ?? null) as go.Node | null;
                const data = part?.data as OrgChartNodeData | undefined;
                if (data) onNodeContextAction('current_node', data);
              },
            },
          ),
          $c(
            'ContextMenuButton',
            $c(go.TextBlock, 'Get all selected positions'),
            {
              click: (_, obj) => {
                const part = (obj.part ?? null) as go.Node | null;
                const data = part?.data as OrgChartNodeData | undefined;
                if (data) onNodeContextAction('selected_nodes', data);
              },
            },
          ),
          $c(
            'ContextMenuButton',
            $c(go.TextBlock, 'Get boolean keywords string'),
            {
              click: (_, obj) => {
                const part = (obj.part ?? null) as go.Node | null;
                const data = part?.data as OrgChartNodeData | undefined;
                if (data) onNodeContextAction('boolean_keywords', data);
              },
            },
          ),
          $c(
            'ContextMenuButton',
            $c(go.TextBlock, 'Get all leadership in this company'),
            {
              click: (_, obj) => {
                const part = (obj.part ?? null) as go.Node | null;
                const data = part?.data as OrgChartNodeData | undefined;
                if (data) onNodeContextAction('leadership', data);
              },
            },
          ),
          $c(
            'ContextMenuButton',
            $c(go.TextBlock, 'Get all names in this company'),
            {
              click: (_, obj) => {
                const part = (obj.part ?? null) as go.Node | null;
                const data = part?.data as OrgChartNodeData | undefined;
                if (data) onNodeContextAction('entire_company', data);
              },
            },
          ),
          $c(
            'ContextMenuButton',
            $c(go.TextBlock, 'Get all names in this function'),
            {
              click: (_, obj) => {
                const part = (obj.part ?? null) as go.Node | null;
                const data = part?.data as OrgChartNodeData | undefined;
                if (data) onNodeContextAction('function_grade', data);
              },
            },
          ),
          $c(
            'ContextMenuButton',
            $c(go.TextBlock, 'Get similar names in similar companies'),
            {
              click: (_, obj) => {
                const part = (obj.part ?? null) as go.Node | null;
                const data = part?.data as OrgChartNodeData | undefined;
                if (data) onNodeContextAction('similar_companies', data);
              },
            },
          ),
          $c(
            'ContextMenuButton',
            $c(go.TextBlock, 'Add to job and send invite'),
            {
              click: (_, obj) => {
                const part = (obj.part ?? null) as go.Node | null;
                const data = part?.data as OrgChartNodeData | undefined;
                if (data) onNodeContextAction('add_to_job_and_send_invite', data);
              },
            },
          ),
          $c(
            'ContextMenuButton',
            $c(go.TextBlock, 'Add to job and invite to job'),
            {
              click: (_, obj) => {
                const part = (obj.part ?? null) as go.Node | null;
                const data = part?.data as OrgChartNodeData | undefined;
                if (data) onNodeContextAction('add_to_job_and_invite_to_job', data);
              },
            },
          ),
        );
      }

      return node;
    }, [
      defaultAvatarUrl,
      LOCK_ICON_URL,
      LINKEDIN_ICON_URL,
      DOWNLOAD_ICON_URL,
      SIMILAR_ITEMS_ICON_URL,
      onNodeContextAction,
      onNodeClick,
      onNodeDoubleClick,
      onDownloadNode,
      onSimilarPeople,
    ]);

    const initDiagram = useCallback((): go.Diagram => {
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
        $(go.Shape, { strokeWidth: 4, stroke: '#00a4a4' }),
      );

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
        diagram.contextMenu = $c(
          'ContextMenu',
          $c(
            'ContextMenuButton',
            $c(go.TextBlock, 'Get all names in this company'),
            {
              click: () => onBackgroundContextAction('entire_company'),
            },
          ),
          $c(
            'ContextMenuButton',
            $c(go.TextBlock, 'Get all leadership in this company'),
            {
              click: () => onBackgroundContextAction('leadership'),
            },
          ),
        );
      }

      return diagram;
    }, [createNodeTemplate, onBackgroundContextAction]);

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
        if (!part) return;

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
      diagram.scale = 1;
      const rootNode = diagram.nodes.first();
      if (rootNode) diagram.commandHandler.scrollToPart(rootNode);
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

      const handleInitialLayout = () => {
        if (hasCenteredRef.current) return;
        hasCenteredRef.current = true;
        diagram.commandHandler.zoomToFit();
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
