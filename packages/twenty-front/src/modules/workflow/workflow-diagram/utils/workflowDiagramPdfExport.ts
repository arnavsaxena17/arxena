export const WORKFLOW_DIAGRAM_PDF_EXPORT_PADDING_PX = 48;

// One page stays small enough that the screenshot canvas cannot exhaust the tab.
export const WORKFLOW_DIAGRAM_PDF_PAGE_MAX_WIDTH_PX = 1200;
export const WORKFLOW_DIAGRAM_PDF_PAGE_MAX_HEIGHT_PX = 1600;

// Shared strip so a node on the cut is fully visible on at least one page.
const WORKFLOW_DIAGRAM_PDF_PAGE_OVERLAP_PX = 200;

export type DownloadWorkflowDiagramPdfResult = 'downloaded' | 'empty';

type WorkflowDiagramPdfBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type WorkflowDiagramPdfPage = {
  bounds: WorkflowDiagramPdfBounds;
  imageWidth: number;
  imageHeight: number;
};

export const getWorkflowDiagramPdfPages = (
  nodesBounds: WorkflowDiagramPdfBounds,
): WorkflowDiagramPdfPage[] => {
  const paddedWidth =
    nodesBounds.width + WORKFLOW_DIAGRAM_PDF_EXPORT_PADDING_PX * 2;
  const paddedHeight =
    nodesBounds.height + WORKFLOW_DIAGRAM_PDF_EXPORT_PADDING_PX * 2;
  const originX = nodesBounds.x - WORKFLOW_DIAGRAM_PDF_EXPORT_PADDING_PX;
  const originY = nodesBounds.y - WORKFLOW_DIAGRAM_PDF_EXPORT_PADDING_PX;
  const widthScale = Math.min(
    1,
    WORKFLOW_DIAGRAM_PDF_PAGE_MAX_WIDTH_PX / paddedWidth,
  );
  const sliceFlowHeight = WORKFLOW_DIAGRAM_PDF_PAGE_MAX_HEIGHT_PX / widthScale;
  const step = Math.max(
    1,
    sliceFlowHeight - WORKFLOW_DIAGRAM_PDF_PAGE_OVERLAP_PX,
  );
  const pages: WorkflowDiagramPdfPage[] = [];
  let offset = 0;

  while (offset < paddedHeight - 0.5) {
    const sliceHeight = Math.min(sliceFlowHeight, paddedHeight - offset);

    pages.push({
      bounds: {
        x: originX,
        y: originY + offset,
        width: paddedWidth,
        height: sliceHeight,
      },
      imageWidth: Math.max(1, Math.round(paddedWidth * widthScale)),
      imageHeight: Math.max(1, Math.round(sliceHeight * widthScale)),
    });

    if (offset + sliceHeight >= paddedHeight - 0.5) {
      break;
    }

    offset += step;
  }

  return pages;
};

export const workflowDiagramNodeIntersectsPdfSlice = ({
  nodeY,
  nodeHeight,
  sliceY,
  sliceHeight,
}: {
  nodeY: number;
  nodeHeight: number;
  sliceY: number;
  sliceHeight: number;
}): boolean => {
  const nodeBottom = nodeY + nodeHeight;
  const sliceBottom = sliceY + sliceHeight;

  return nodeBottom > sliceY && nodeY < sliceBottom;
};

export const getWorkflowDiagramPdfFileName = (
  workflowName: string | undefined,
): string => {
  const sanitizedName = (workflowName ?? '')
    .replace(/[^\p{L}\p{N}\s-]+/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);

  return `${sanitizedName.length > 0 ? sanitizedName : 'workflow'}.pdf`;
};
