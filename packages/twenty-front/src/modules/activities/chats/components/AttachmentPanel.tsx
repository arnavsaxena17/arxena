import React, { useState, useEffect,useCallback, useMemo } from 'react';
import ChatTile from "./ChatTile";
import styled from "@emotion/styled";
import { useNavigate } from 'react-router-dom';
import SearchBox from "./SearchBox";
import JobDropdown from "./JobDropdown";
import axios from 'axios';
import { useRecoilState } from 'recoil';
import { tokenPairState } from '@/auth/states/tokenPairState';
import mammoth from 'mammoth';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import {Document, Page, pdfjs} from 'react-pdf';



pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.mjs`;


const PanelContainer = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  right: ${props => (props.isOpen ? '0' : '-40%')};
  width: 40%;
  height: 100vh;
  background-color: #f5f5f5;
  box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);
  transition: right 0.3s ease-in-out;
  overflow-y: auto;
  z-index: 1000;
  display: flex;
  flex-direction: column;
`;

const Header = styled.div`
  padding: 15px;
  
  border-bottom: 1px solid #e0e0e0;
  width:80%;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const CandidateInfo = styled.div`
  flex-grow: 1;
  width:50%;
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

const NavigationContainer = styled.div`
  display: flex;
  align-items: center;
`;

const NavButton = styled.button`
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  color: #333;
  padding: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  &:disabled {
    color: #ccc;
    cursor: not-allowed;
  }
`;



const PDFContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  height: 100%;
  overflow-y: auto;
`;



const AttachmentCounter = styled.span`
  font-size: 14px;
  color: #666;
  margin: 0 10px;
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
    const [attachments, setAttachments] = useState<Array<{ id: string; name: string; fullPath: string }>>([]);
    const [currentAttachmentIndex, setCurrentAttachmentIndex] = useState(0);
  const [fileContent, setFileContent] = useState<string | ArrayBuffer | null>(null);
  const [tokenPair] = useRecoilState(tokenPairState);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);


  
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

  
  useEffect(() => {
    if (isOpen && candidateId) {
      fetchAttachments();
    }
  }, [isOpen, candidateId]);

  const fetchAttachments = useCallback(async () => {
    if (!isOpen || !candidateId) return;

    try {
      setError(null);
      const response = await axios.post(
        `${process.env.REACT_APP_SERVER_BASE_URL}/graphql`,
        {
          operationName: 'FindManyAttachments',
          variables: {
            filter: { candidateId: { eq: candidateId } },
            orderBy: [{ createdAt: 'DescNullsFirst' }],
          },
          query: `query FindManyAttachments($filter: AttachmentFilterInput, $orderBy: [AttachmentOrderByInput]) {
              attachments(filter: $filter, orderBy: $orderBy) {
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
        }
      );

      const fetchedAttachments = response.data.data.attachments.edges.map((edge: any) => edge.node);
      setAttachments(fetchedAttachments);
      setCurrentAttachmentIndex(0);
      console.log('Total Attachments: ', fetchedAttachments.length);
    } catch (error) {
      console.error('Error fetching attachments:', error);
      setError('Failed to fetch attachments. Please try again.');
    }
  }, [isOpen, candidateId, tokenPair]);




  const handlePrevAttachment = useCallback(() => {
    setCurrentAttachmentIndex((prevIndex) => Math.max(prevIndex - 1, 0));
  }, []);

  const handleNextAttachment = useCallback(() => {
    setCurrentAttachmentIndex((prevIndex) => Math.min(prevIndex + 1, attachments.length - 1));
  }, [attachments.length]);



  useEffect(() => {
    return () => {
      if (fileContent && typeof fileContent === 'string' && fileContent.startsWith('blob:')) {
        URL.revokeObjectURL(fileContent);
      }
    };
  }, [fileContent]);



  const fetchFileContent = useCallback(async (attachment: { id: string; name: string; fullPath: string }) => {
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
}, [tokenPair]);

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


  useEffect(() => {
    if (attachments.length > 0) {
      fetchFileContent(attachments[currentAttachmentIndex]);
    }
  }, [currentAttachmentIndex, attachments, fetchFileContent]);

  const currentAttachment = useMemo(() => attachments[currentAttachmentIndex], [attachments, currentAttachmentIndex]);


  console.log("Current Attachment ::", currentAttachment)
  console.log("Total Attachments : ", attachments.length)
  return (
    <PanelContainer isOpen={isOpen}>
      <CloseButton onClick={onClose}>&times;</CloseButton>
      <Header>
        <CandidateInfo>
          <CandidateName>{candidateName}</CandidateName>
          {currentAttachment && <FileName>{currentAttachment.name}</FileName>}
        </CandidateInfo>
        <NavigationContainer>
          <NavButton onClick={handlePrevAttachment} disabled={currentAttachmentIndex === 0}>
            &#9650;
          </NavButton>
          <AttachmentCounter>
            {currentAttachmentIndex + 1} of {attachments.length}
          </AttachmentCounter>
          <NavButton onClick={handleNextAttachment} disabled={currentAttachmentIndex === attachments.length - 1}>
            &#9660;
          </NavButton>
        </NavigationContainer>
      </Header>
      <ContentContainer>
        {error ? (
          <ErrorMessage>{error}</ErrorMessage>
        ) : fileContent ? (
          typeof fileContent === 'string' && fileContent.startsWith('blob:') ? (



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
            {/* Add navigation controls for PDF if needed */}
          </PDFContainer>


            // <PdfViewer fileContent={fileContent} />
          
        
        
        
        
        ) : typeof fileContent === 'string' && fileContent.startsWith('<') ? (
            <DocxViewer dangerouslySetInnerHTML={{ __html: fileContent }} />
          ) : (
            <ContentViewer>{typeof fileContent === 'string' ? fileContent : 'Unsupported file type'}</ContentViewer>
          )
        ) : (
          <div>Loading...</div>
        )}
        {downloadUrl && (
          <a href={downloadUrl} download={currentAttachment?.name}>
            Download {currentAttachment?.name}
          </a>
        )}
      </ContentContainer>
    </PanelContainer>
  );
};

export default AttachmentPanel;
