import {
  WORKFLOW_DIAGRAM_PDF_EXPORT_PADDING_PX,
  WORKFLOW_DIAGRAM_PDF_PAGE_MAX_HEIGHT_PX,
  WORKFLOW_DIAGRAM_PDF_PAGE_MAX_WIDTH_PX,
  getWorkflowDiagramPdfFileName,
  getWorkflowDiagramPdfPages,
  workflowDiagramNodeIntersectsPdfSlice,
} from '@/workflow/workflow-diagram/utils/workflowDiagramPdfExport';

describe('getWorkflowDiagramPdfPages', () => {
  it('should keep a small graph on one page at its own size', () => {
    const pages = getWorkflowDiagramPdfPages({
      x: 10,
      y: 20,
      width: 100,
      height: 50,
    });

    expect(pages).toEqual([
      {
        bounds: {
          x: 10 - WORKFLOW_DIAGRAM_PDF_EXPORT_PADDING_PX,
          y: 20 - WORKFLOW_DIAGRAM_PDF_EXPORT_PADDING_PX,
          width: 100 + WORKFLOW_DIAGRAM_PDF_EXPORT_PADDING_PX * 2,
          height: 50 + WORKFLOW_DIAGRAM_PDF_EXPORT_PADDING_PX * 2,
        },
        imageWidth: 100 + WORKFLOW_DIAGRAM_PDF_EXPORT_PADDING_PX * 2,
        imageHeight: 50 + WORKFLOW_DIAGRAM_PDF_EXPORT_PADDING_PX * 2,
      },
    ]);
  });

  it('should split a tall graph into pages that stay under the canvas cap', () => {
    const pages = getWorkflowDiagramPdfPages({
      x: 0,
      y: 0,
      width: 100,
      height: 10000,
    });
    const lastPage = pages[pages.length - 1];

    expect(pages.length).toBeGreaterThan(1);
    expect(
      pages.every(
        (page) =>
          page.imageWidth <= WORKFLOW_DIAGRAM_PDF_PAGE_MAX_WIDTH_PX &&
          page.imageHeight <= WORKFLOW_DIAGRAM_PDF_PAGE_MAX_HEIGHT_PX,
      ),
    ).toBe(true);
    expect(lastPage.bounds.y + lastPage.bounds.height).toBeCloseTo(
      10000 + WORKFLOW_DIAGRAM_PDF_EXPORT_PADDING_PX,
    );
  });
});

describe('workflowDiagramNodeIntersectsPdfSlice', () => {
  it('should include a node that overlaps the slice', () => {
    expect(
      workflowDiagramNodeIntersectsPdfSlice({
        nodeY: 90,
        nodeHeight: 40,
        sliceY: 100,
        sliceHeight: 200,
      }),
    ).toBe(true);
  });

  it('should skip a node that sits fully above the slice', () => {
    expect(
      workflowDiagramNodeIntersectsPdfSlice({
        nodeY: 0,
        nodeHeight: 40,
        sliceY: 100,
        sliceHeight: 200,
      }),
    ).toBe(false);
  });
});

describe('getWorkflowDiagramPdfFileName', () => {
  it('should turn the workflow name into a pdf file name', () => {
    expect(getWorkflowDiagramPdfFileName('Candidate Sequencer')).toBe(
      'Candidate-Sequencer.pdf',
    );
  });

  it('should fall back when the name is empty or only punctuation', () => {
    expect(getWorkflowDiagramPdfFileName(undefined)).toBe('workflow.pdf');
    expect(getWorkflowDiagramPdfFileName('***')).toBe('workflow.pdf');
  });
});
