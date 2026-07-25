import { useCallback, useMemo, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';

// Keep react-pdf out of Linaria-evaluated modules — wyw-in-js cannot parse
// pdfjs-dist private class fields (`#divider`).
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.mjs`;

type AttachmentPdfViewerProps = {
  fileUrl: string;
  onRetry: () => void;
};

export const AttachmentPdfViewer = ({
  fileUrl,
  onRetry,
}: AttachmentPdfViewerProps) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);

  const options = useMemo(
    () => ({
      cMapUrl: 'cmaps/',
      cMapPacked: true,
    }),
    [],
  );

  const handleDocumentLoadSuccess = useCallback(
    ({ numPages: loadedPageCount }: { numPages: number }) => {
      setNumPages(loadedPageCount);
      setPdfLoadError(null);
    },
    [],
  );

  const handleDocumentLoadError = useCallback((error: Error) => {
    console.error('Error loading PDF:', error);
    setPdfLoadError(
      'Failed to load PDF. The file might be corrupted or temporarily unavailable.',
    );
  }, []);

  const handleRetryClick = useCallback(() => {
    setPdfLoadError(null);
    onRetry();
  }, [onRetry]);

  if (pdfLoadError !== null) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div style={{ color: 'red', marginBottom: 12 }}>{pdfLoadError}</div>
        <button type="button" onClick={handleRetryClick}>
          Reload PDF
        </button>
      </div>
    );
  }

  return (
    <Document
      file={fileUrl}
      onLoadSuccess={handleDocumentLoadSuccess}
      onLoadError={handleDocumentLoadError}
      options={options}
    >
      {Array.from(new Array(numPages ?? 0), (_element, index) => (
        <Page
          key={`page_${index + 1}`}
          pageNumber={index + 1}
          renderTextLayer={false}
          renderAnnotationLayer={false}
        />
      ))}
    </Document>
  );
};
