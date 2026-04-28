import * as go from 'gojs';
import { ReactDiagram } from 'gojs-react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import '../../gojs-runtime-patch';

import type {
  OrgChartDiagramHandle,
  OrgChartDiagramProps,
} from '../OrgChartDiagram.types';
import { DEFAULT_AVATAR } from './constants';
import { initOrgChartDiagram } from './diagramInit';
import { createNodeTemplate } from './nodeTemplate/createNodeTemplate';
import {
  StyledDiagramWrapper,
  StyledOverviewContainer,
} from './OrgChartDiagram.styles';
import { clearSearch, focusResultAtIndex, performSearch } from './search';
import { applyZoomAroundNode, getOrgChartRootNode } from './zoomAndRoot';

export const OrgChartDiagram = forwardRef<
  OrgChartDiagramHandle,
  OrgChartDiagramProps
>(
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
    const diagramRef = useRef<ReactDiagram>(null);
    const overviewDivRef = useRef<HTMLDivElement | null>(null);
    const overviewRef = useRef<go.Overview | null>(null);
    const hasCenteredRef = useRef(false);
    const structureHashRef = useRef<number | null>(null);
    const searchResultsKeysRef = useRef<go.Key[]>([]);
    const currentResultIndexRef = useRef(0);

    const handleModelChange = useCallback(() => {}, []);

    const capabilitiesHoverCompanyLabel =
      (nodeCapabilitiesHoverCompanyName ?? '').trim() || 'this company';

    const createNodeTemplateFactory = useCallback((): go.Node => {
      return createNodeTemplate({
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
        onLockedContactChannelClick,
      });
    }, [
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
      onLockedContactChannelClick,
    ]);

    const initDiagram = useCallback((): go.Diagram => {
      return initOrgChartDiagram({
        createNodeTemplate: createNodeTemplateFactory,
        onBackgroundContextAction,
        showNodeCapabilitiesHoverHint,
        m7kqContactMode,
      });
    }, [
      createNodeTemplateFactory,
      onBackgroundContextAction,
      showNodeCapabilitiesHoverHint,
      m7kqContactMode,
    ]);

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

    const focusNextResult = useCallback(() => {
      focusResultAtIndex({
        index: currentResultIndexRef.current + 1,
        getDiagram,
        searchResultsKeysRef,
        currentResultIndexRef,
      });
    }, [getDiagram]);

    const focusPreviousResult = useCallback(() => {
      focusResultAtIndex({
        index: currentResultIndexRef.current - 1,
        getDiagram,
        searchResultsKeysRef,
        currentResultIndexRef,
      });
    }, [getDiagram]);

    const performSearchImpl = useCallback(
      (keyword: string): number =>
        performSearch({
          keyword,
          getDiagram,
          searchResultsKeysRef,
          currentResultIndexRef,
        }),
      [getDiagram],
    );

    const clearSearchImpl = useCallback(() => {
      clearSearch({
        getDiagram,
        searchResultsKeysRef,
        currentResultIndexRef,
      });
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

    const handle = useMemo<OrgChartDiagramHandle>(
      () => ({
        search: performSearchImpl,
        focusNextResult,
        focusPreviousResult,
        clearSearch: clearSearchImpl,
        getSearchResultCount: () => searchResultsKeysRef.current.length,
        zoomToFit,
        centerContent,
      }),
      [
        performSearchImpl,
        focusNextResult,
        focusPreviousResult,
        clearSearchImpl,
        zoomToFit,
        centerContent,
      ],
    );

    useImperativeHandle(ref, () => handle, [
      performSearchImpl,
      focusNextResult,
      focusPreviousResult,
      clearSearchImpl,
      zoomToFit,
      centerContent,
    ]);

    useEffect(() => {
      onDiagramReady?.(handle);
    }, [onDiagramReady, handle]);

    useEffect(() => {
      const nextHash = nodeDataArray.reduce((acc, n) => {
        const k = typeof n.key === 'number' ? n.key : 0;
        const p = typeof (n as { parent?: unknown }).parent === 'number'
          ? ((n as { parent: number }).parent ?? 0)
          : 0;
        // Cheap, stable hash for "structure" changes (keys + parent links).
        // Intentionally ignores cosmetic fields like `nodeState`.
        return (((acc * 31) ^ (k * 7 + p * 13)) >>> 0) as number;
      }, 0);

      if (structureHashRef.current !== nextHash) {
        structureHashRef.current = nextHash;
        hasCenteredRef.current = false;
      }
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

      // NOTE: `InitialLayoutCompleted` only fires once per Diagram instance.
      // We want to center after *any* layout that corresponds to a new org chart
      // structure (e.g. preview → full chart).
      diagram.addDiagramListener('LayoutCompleted', handleInitialLayout);

      // Proactively request a layout pass after structure changes so the
      // LayoutCompleted event runs in cases where the ReactDiagram data update
      // doesn't trigger a layout immediately.
      if (!hasCenteredRef.current && nodeDataArray.length > 0) {
        requestAnimationFrame(() => {
          const d = getDiagram();
          if (!d) return;
          d.layoutDiagram(true);
        });
      }

      return () => {
        if (settleTimer !== undefined) clearTimeout(settleTimer);
        diagram.removeDiagramListener('LayoutCompleted', handleInitialLayout);
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

