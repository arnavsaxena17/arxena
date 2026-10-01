import {
  getWorkflowDiagramPdfPages,
  workflowDiagramNodeIntersectsPdfSlice,
  type DownloadWorkflowDiagramPdfResult,
} from '@/workflow/workflow-diagram/utils/workflowDiagramPdfExport';
import { Document, Image, Page, pdf } from '@react-pdf/renderer';
import { getViewportForBounds, type Rect } from '@xyflow/react';
import { saveAs } from 'file-saver';
import { domToPng } from 'modern-screenshot';
import { isDefined } from 'twenty-shared/utils';

const WORKFLOW_DIAGRAM_PDF_EXPORT_MIN_ZOOM = 0.0001;
const WORKFLOW_DIAGRAM_PDF_EXPORT_MAX_ZOOM = 1;
const WORKFLOW_DIAGRAM_PDF_EXPORT_SCALE = 1;
const WORKFLOW_DIAGRAM_PDF_MAX_CANVAS_PX = 2048;

const NODE_TRANSLATE_PATTERN =
  /translate\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px\s*\)/;

const WorkflowDiagramPdfDocument = ({
  pages,
}: {
  pages: Array<{
    imageSrc: string;
    pageWidth: number;
    pageHeight: number;
  }>;
}) => (
  <Document>
    {pages.map((page, pageIndex) => (
      <Page
        key={page.pageHeight + pageIndex}
        size={{ width: page.pageWidth, height: page.pageHeight }}
        style={{ margin: 0, padding: 0 }}
      >
        <Image
          src={page.imageSrc}
          style={{ width: page.pageWidth, height: page.pageHeight }}
        />
      </Page>
    ))}
  </Document>
);

const yieldToMainThread = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      setTimeout(resolve, 0);
    });
  });

// Canvas fillStyle drops some CSS color functions, so resolve to a hex first.
const normalizeCssColorForCanvas = (color: string): string => {
  const probe = document.createElement('div');
  probe.style.backgroundColor = color;
  document.body.append(probe);
  const resolvedBackgroundColor = getComputedStyle(probe).backgroundColor;
  probe.remove();

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!isDefined(context)) {
    return resolvedBackgroundColor;
  }

  context.fillStyle = 'transparent';
  const rejectedFillStyle = context.fillStyle;
  context.fillStyle = resolvedBackgroundColor;

  if (context.fillStyle === rejectedFillStyle) {
    return resolvedBackgroundColor;
  }

  return context.fillStyle;
};

const readNodeTranslateY = (transform: string): number | undefined => {
  const match = NODE_TRANSLATE_PATTERN.exec(transform);

  if (!isDefined(match)) {
    return undefined;
  }

  const translateY = Number(match[2]);

  return Number.isFinite(translateY) ? translateY : undefined;
};

const createPdfSliceNodeFilter =
  (slice: Rect) =>
  (domNode: globalThis.Node): boolean => {
    if (!(domNode instanceof HTMLElement)) {
      return true;
    }

    if (!domNode.classList.contains('react-flow__node')) {
      return true;
    }

    const nodeY = readNodeTranslateY(domNode.style.transform);

    if (!isDefined(nodeY)) {
      return true;
    }

    return workflowDiagramNodeIntersectsPdfSlice({
      nodeY,
      nodeHeight: domNode.offsetHeight,
      sliceY: slice.y,
      sliceHeight: slice.height,
    });
  };

// Arrow markers live outside the viewport. One defs host is enough for the snapshot.
const attachEdgeMarkerDefs = (
  diagramElement: HTMLElement,
  viewportElement: HTMLElement,
): (() => void) => {
  const markerDefs = diagramElement.querySelector(':scope > svg defs');

  if (!(markerDefs instanceof SVGDefsElement)) {
    return () => undefined;
  }

  const markerHost = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'svg',
  );
  const clonedMarkerDefs = markerDefs.cloneNode(true);

  if (!(clonedMarkerDefs instanceof SVGDefsElement)) {
    return () => undefined;
  }

  markerHost.append(clonedMarkerDefs);
  viewportElement.prepend(markerHost);

  return () => {
    markerHost.remove();
  };
};

export const downloadWorkflowDiagramPdf = async ({
  diagramElement,
  viewportElement,
  nodesBounds,
  backgroundColor,
  fileName,
  onProgress,
}: {
  diagramElement: HTMLElement;
  viewportElement: HTMLElement;
  nodesBounds: Rect;
  backgroundColor: string;
  fileName: string;
  onProgress?: (pageNumber: number, pageCount: number) => void;
}): Promise<DownloadWorkflowDiagramPdfResult> => {
  if (nodesBounds.width <= 0 || nodesBounds.height <= 0) {
    return 'empty';
  }

  const pages = getWorkflowDiagramPdfPages(nodesBounds);
  const background = normalizeCssColorForCanvas(backgroundColor);
  const detachEdgeMarkerDefs = attachEdgeMarkerDefs(
    diagramElement,
    viewportElement,
  );
  const pageImages: Array<{
    imageSrc: string;
    pageWidth: number;
    pageHeight: number;
  }> = [];

  try {
    for (const [pageIndex, page] of pages.entries()) {
      onProgress?.(pageIndex + 1, pages.length);
      await yieldToMainThread();

      const viewport = getViewportForBounds(
        page.bounds,
        page.imageWidth,
        page.imageHeight,
        WORKFLOW_DIAGRAM_PDF_EXPORT_MIN_ZOOM,
        WORKFLOW_DIAGRAM_PDF_EXPORT_MAX_ZOOM,
        0,
      );
      const dataUrl = await domToPng(viewportElement, {
        backgroundColor: background,
        width: page.imageWidth,
        height: page.imageHeight,
        scale: WORKFLOW_DIAGRAM_PDF_EXPORT_SCALE,
        maximumCanvasSize: WORKFLOW_DIAGRAM_PDF_MAX_CANVAS_PX,
        font: false,
        filter: createPdfSliceNodeFilter(page.bounds),
        style: {
          width: `${page.imageWidth}px`,
          height: `${page.imageHeight}px`,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        },
      });

      pageImages.push({
        imageSrc: dataUrl,
        pageWidth: page.imageWidth,
        pageHeight: page.imageHeight,
      });
    }

    const blob = await pdf(
      <WorkflowDiagramPdfDocument pages={pageImages} />,
    ).toBlob();

    if (blob.size === 0) {
      throw new Error('Workflow diagram PDF was empty');
    }

    saveAs(blob, fileName);

    return 'downloaded';
  } finally {
    detachEdgeMarkerDefs();
  }
};
