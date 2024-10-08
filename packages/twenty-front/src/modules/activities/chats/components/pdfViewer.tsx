import React, { useState, useMemo, useCallback } from 'react';
import { Document, Page, pdfjs} from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import styled from '@emotion/styled';


// Set the worker source
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.mjs`;


const PDFContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  height: 100%;
  overflow-y: auto;
`;


interface PDFViewerProps {
    fileContent: string;
  }

const PdfViewer: React.FC<PDFViewerProps> = React.memo(({ fileContent }) => {
    const [numPages, setNumPages] = useState<number | null>(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [error, setError] = useState<string | null>(null);

  
    const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
      setNumPages(numPages);
      console.log('PDF loaded successfully. Number of pages:', numPages);
    }, []);
  
    const options = useMemo(() => ({
      cMapUrl: 'cmaps/',
      cMapPacked: true,
    }), []);

    function onDocumentLoadError(error: Error) {
        console.error("Error loading PDF:", error);
        setError(error.message);
      }
    
    
  
    const handlePrevPage = useCallback(() => {
      setPageNumber((prevPageNumber) => Math.max(prevPageNumber - 1, 1));
    }, []);
  
    const handleNextPage = useCallback(() => {
      setPageNumber((prevPageNumber) => Math.min(prevPageNumber + 1, numPages || 1));
    }, [numPages]);
  
    return (
      <PDFContainer>
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

      </PDFContainer>
    );
  });
  
  export default PdfViewer;