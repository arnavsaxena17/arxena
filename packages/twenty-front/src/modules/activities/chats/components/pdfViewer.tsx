import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs} from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';

// Set the worker source
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.mjs`;

const PDFViewer: React.FC<{ fileContent: string }> = ({ fileContent }) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [error, setError] = useState<string | null>(null);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    console.log("PDF loaded successfully. Number of pages:", numPages);
    setNumPages(numPages);
  }

  function onDocumentLoadError(error: Error) {
    console.error("Error loading PDF:", error);
    setError(error.message);
  }

  useEffect(() => {
    console.log("Attempting to load PDF with content:", fileContent);
  }, [fileContent]);


  const options = {
    cMapUrl: 'https://unpkg.com/pdfjs-dist@2.9.359/cmaps/',
    cMapPacked: true,
  };



  return (
    <div style={{ height: '100vh', overflow: 'auto' }}>
      {error ? (
        <div>Error loading PDF: {error}</div>
      ) : (
        <Document
          file={fileContent}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          options={options}
        >
          {Array.from(new Array(numPages), (el, index) => (
            <Page
              key={`page_${index + 1}`}
              pageNumber={index + 1}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          ))}
        </Document>
      )}
    </div>
  );
};

export default PDFViewer;