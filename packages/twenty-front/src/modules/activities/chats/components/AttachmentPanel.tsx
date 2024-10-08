import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import styled from '@emotion/styled';
import { useRecoilState } from 'recoil';
import { tokenPairState } from '@/auth/states/tokenPairState';
import mammoth from 'mammoth';
import PDFViewer from './pdfViewer';
import { Document } from 'react-pdf'

import 'react-pdf/dist/esm/Page/AnnotationLayer.css';

// console.log("pdfjs.version:",pdfjs.version)
// pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.min.mjs`;
// pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.mjs`;

// console.log('PDF.js worker src:', pdfjs.GlobalWorkerOptions.workerSrc);


// console.log('PDF.js version:', pdfjs.version);

const PanelContainer = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  right: ${props => (props.isOpen ? '0' : '-40%')};
  width: 40%;
  height: 100vh;
  background-color: white;
  box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);
  transition: right 0.3s ease-in-out;
  overflow-y: auto;
  z-index: 1000;
  display: flex;
  flex-direction: column;
`;

const Header = styled.div`
  padding: 15px;
  background-color: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
`;

const CandidateName = styled.h2`
  margin: 0 0 8px 0;
  font-size: 1.2em;
`;

const FileName = styled.h3`
  margin: 0;
  color: #666;
  font-size: 1em;
`;

const ContentContainer = styled.div`
  flex-grow: 1;
  overflow-y: auto;
  padding: 15px;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 15px;
  right: 15px;
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  z-index: 1001;
`;

const ErrorMessage = styled.div`
  color: red;
  padding: 15px;
  text-align: center;
  background-color: #ffeeee;
  border: 1px solid #ffcccc;
  border-radius: 4px;
  margin-top: 15px;
`;

const DocxViewer = styled.div`
  padding: 15px;
  background-color: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  overflow-y: auto;
`;

const ContentViewer = styled.pre`
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 100%;
  overflow-y: auto;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.9em;
`;

interface AttachmentPanelProps {
  isOpen: boolean;
  onClose: () => void;
  candidateId: string;
  candidateName: string;
}

const AttachmentPanel: React.FC<AttachmentPanelProps> = ({ isOpen, onClose, candidateId, candidateName }) => {
  const [attachment, setAttachment] = useState<{ id: string; name: string; fullPath: string } | null>(null);
  const [fileContent, setFileContent] = useState<string | ArrayBuffer | null>(null);
  const [tokenPair] = useRecoilState(tokenPairState);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);
  const [isPdfLoading, setIsPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && candidateId) {
      fetchAttachment();
    }
  }, [isOpen, candidateId]);
  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    console.log("numPages loadec", numPages);
    setNumPages(numPages);
    setIsPdfLoading(false);
  }


  const fetchAttachment = async () => {
    try {
      setError(null);
      const response = await axios.post(
        `${process.env.REACT_APP_SERVER_BASE_URL}/graphql`,
        {
          operationName: 'FindManyAttachments',
          variables: {
            filter: { candidateId: { eq: candidateId } },
            orderBy: [{ createdAt: 'DescNullsFirst' }],
            limit: 1,
          },
          query: `query FindManyAttachments($filter: AttachmentFilterInput, $orderBy: [AttachmentOrderByInput], $limit: Int) {
              attachments(filter: $filter, orderBy: $orderBy, first: $limit) {
                edges {
                  node {
                    id
                    name
                    fullPath
                  }
                }
              }
            }`,
        },
        {
          headers: {
            Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
            'Content-Type': 'application/json',
            'x-schema-version': '135',
          },
        },
      );

      const fetchedAttachment = response.data.data.attachments.edges[0]?.node;
      if (fetchedAttachment) {
        setAttachment(fetchedAttachment);
        fetchFileContent(fetchedAttachment);
      } else {
        setError('No attachments found for this candidate.');
      }
    } catch (error) {
      console.error('Error fetching attachment:', error);
      setError('Failed to fetch attachment. Please try again.');
    }
  };
  useEffect(() => {
    return () => {
      if (fileContent && typeof fileContent === 'string' && fileContent.startsWith('blob:')) {
        URL.revokeObjectURL(fileContent);
      }
    };
  }, [fileContent]);
  let attachmentFilePath
  const fetchFileContent = async (attachment: { id: string; name: string; fullPath: string }) => {
    try {
      if (!attachment || fileContent) return; // Prevent unnecessary fetches

      setIsLoading(true);
      setError(null);
      setFileContent(null);
      setDownloadUrl(null);

      const response = await axios.get(`${process.env.REACT_APP_SERVER_BASE_URL}/files/${attachment.fullPath}`, { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` }, responseType: 'arraybuffer' });
      console.log('Attachment:', attachment);
      console.log('Response received:', response.status, response.headers['content-type']);
      console.log('Response headers:', response.headers);
      console.log('Response:', response);

      let contentType = response.headers['content-type'] || attachment?.fullPath?.split('?')[0]?.split('.').pop()?.toLowerCase() || 'application/octet-stream';
      contentType = contentType.split(';')[0]; // Remove charset if present
      console.log('Content Type:', contentType);

      if (!contentType) {
        const fileExtension = attachment.name.split('.').pop()?.toLowerCase();
        contentType = getContentTypeFromExtension(fileExtension);
      }
      //   const blob = new Blob([response.data], { type: contentType || 'application/octet-stream' });

      let blob;
      try {
        blob = new Blob([response.data], { type: contentType || 'application/octet-stream' });
        console.log('Blob created successfully. Size:', blob.size);
      } catch (error) {
        console.error('Error creating Blob:', error);
        setError('Failed to process the file. Please try again.');
        return;
      }

      console.log('Blob size:', blob.size);
      console.log("This ithe content type:", contentType)
      if (contentType && contentType.includes('pdf')) {
        const url = URL.createObjectURL(blob);
        setFileContent(url)
      } else if (contentType && (contentType.includes('word') ||  contentType.includes('docx') || contentType.includes('msword') || contentType.includes('openxmlformats-officedocument.wordprocessingml.document'))) {
        console.log("Word file")
        try {

          const arrayBuffer = await blob.arrayBuffer();
          const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
          setFileContent(result.value);
        } catch (mammothError) {
          console.error('Mammoth conversion failed:', mammothError);
          const url = URL.createObjectURL(blob);
          setDownloadUrl(url);
          setFileContent(`Unable to display the Word document. Click the link below to download the ${attachment.name} file.`);
        }
      } else if (contentType && (contentType.includes('text') || contentType.includes('xml') || contentType.includes('json'))) {
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(response.data);
        setFileContent(text);
      } else {
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);
        setFileContent(`Unknown file type. Click the link below to download the ${attachment.name} file.`);
      }
    } catch (error) {
      console.error('Error fetching file content:', error);
      setError(`Failed to load file content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    setIsLoading(false);
  };

  const getContentTypeFromExtension = (extension?: string): string => {
    switch (extension) {
      case 'pdf':
        return 'application/pdf';
      case 'doc':
      case 'docx':
        return 'application/msword';
      case 'xls':
      case 'xlsx':
        return 'application/vnd.ms-excel';
      case 'ppt':
      case 'pptx':
        return 'application/vnd.ms-powerpoint';
      case 'txt':
        return 'text/plain';
      case 'xml':
        return 'application/xml';
      case 'json':
        return 'application/json';
      default:
        return 'application/octet-stream';
    }
  };

  console.log('File content:', fileContent);

  const documentOptions = useMemo(
    () => ({
    cMapUrl: 'https://unpkg.com/pdfjs-dist@2.9.359/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@2.9.359/standard_fonts/'
    }),
    [],
  );
  

  const LoadingMessage = styled.div`
    text-align: center;
    padding: 20px;
  `;

  const PdfViewer = styled.iframe`
    width: 100%;
    height: 100%;
    border: none;
  `;

  console.log('Rendering with fileContent:', fileContent);

  console.log('Blob URL:', fileContent);

  return (
    <PanelContainer isOpen={isOpen}>
      <CloseButton onClick={onClose}>&times;</CloseButton>
      <Header>
        <CandidateName>{candidateName}</CandidateName>
        {attachment && <FileName>{attachment.name}</FileName>}
      </Header>
      <ContentContainer>
        {error ? (
          <ErrorMessage>{error}</ErrorMessage>
        
        // ) : fileContent ? (
        //   typeof fileContent === 'string' && fileContent.startsWith('blob:') && (
        //     <iframe 
        //       src={fileContent} 
        //       style={{ width: '100%', height: '500px', border: 'none' }} 
        //       title="PDF Viewer"
        //     />
        //   )
        ) : fileContent ? (
          typeof fileContent === 'string' && fileContent.startsWith('blob:') ? (
            <PDFViewer fileContent={fileContent} />
          ) : typeof fileContent === 'string' && fileContent.startsWith('<') ? (
            <DocxViewer dangerouslySetInnerHTML={{ __html: fileContent }} />
          ) : (
            <ContentViewer>{typeof fileContent === 'string' ? fileContent : 'Unsupported file type'}</ContentViewer>
          )
        ) : (
          <div>Loading...</div>
        )}
        {downloadUrl && (
          <a href={downloadUrl} download={attachment?.name}>
            Download {attachment?.name}
          </a>
        )}
      </ContentContainer>
    </PanelContainer>
  );
};

export default AttachmentPanel;
