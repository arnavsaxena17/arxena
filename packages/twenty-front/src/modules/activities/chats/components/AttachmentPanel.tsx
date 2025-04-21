import { tokenPairState } from '@/auth/states/tokenPairState';
import styled from '@emotion/styled';
import axios from 'axios';
import mammoth from 'mammoth';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import { useRecoilState } from 'recoil';
import { findManyAttachmentsQuery } from 'twenty-shared';
// import { extractRawText } from 'docx2html';
import { UploadCV } from './chat-window/UploadCV';

// Add a type declaration for the handleDocFile function
type DocHandlerResult = {
  value: string;
};

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.mjs`;

// const PanelContainer = styled.div<{ isOpen: boolean }>`
//   position: fixed;
//   top: 10;
//   right: ${props => (props.isOpen ? '0' : '-40%')};
//   width: 40%;
//   height: 100vh;
//   background-color: #f5f5f5;
//   box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);
//   transition: right 0.3s ease-in-out;
//   overflow-y: auto;
//   z-index: 1000;
//   display: flex;
//   flex-direction: column;
// `;
const DocViewer = styled.div`
  padding: 16px;
  background: white;
  border-radius: 4px;

  p {
    margin: 8px 0;
    line-height: 1.6;
    font-size: 14px;
  }
`;

const DefaultPanelContainer = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 10;
  right: ${(props) => (props.isOpen ? '0' : '-40%')};
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

// const PanelContainer = styled.div<{ isOpen: boolean }>`
//   position: absolute;
//   top: 0;
//   right: ${props => (props.isOpen ? '0' : '-100%')};
//   width: 100%;
//   height: 100vh;
//   background-color: #f5f5f5;
//   box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);
//   transition: right 0.3s ease-in-out;
//   overflow-y: hidden; // Changed from auto to hidden
//   z-index: 1000;
//   display: flex;
//   flex-direction: column;
//   margin: 0;
//   padding: 0;
// `;

const Header = styled.div`
  padding: 15px;
  border-bottom: 1px solid #e0e0e0;
  width: 80%;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const CandidateInfo = styled.div`
  flex-grow: 1;
  width: 50%;
`;

const CandidateName = styled.h2`
  font-size: 1.2em;
  margin: 0 0 8px 0;
`;

const FileName = styled.h3`
  color: #666;
  font-size: 1em;
  margin: 0;
`;

const NavigationContainer = styled.div`
  align-items: center;
  display: flex;
`;

const ContentContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 15px;
  height: calc(100vh - 60px);
  width: 100%;
`;

// Add this new styling for when used inside a tab
const InlineContentContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 15px;
  height: 100%;
  width: 100%;
`;

// const ContentContainer = styled.div`
//   flex-grow: 1;
//   overflow-y: auto;
//   padding: 15px;
// `;

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
  align-items: center;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  width: 100%;
`;

const AttachmentCounter = styled.span`
  font-size: 14px;
  color: #666;
  margin: 0 10px;
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
  background-color: #ffeeee;
  border: 1px solid #ffcccc;
  border-radius: 4px;
  color: red;
  margin-top: 15px;
  padding: 15px;
  text-align: center;
`;

const NotFoundMessage = styled.div`
  background-color: #f8f8f8;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  color: #666;
  margin-top: 15px;
  padding: 15px;
  text-align: center;
`;

// const DocxViewer = styled.div`
//   padding: 15px;
//   background-color: white;
//   border: 1px solid #ccc;
//   border-radius: 4px;
//   overflow-y: auto;
// `;

const ContentViewer = styled.pre`
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.9em;
  max-height: 100%;
  overflow-y: auto;
  padding: 8px;
  top: 200px;
  white-space: pre-wrap;
  word-wrap: break-word;
`;

const UploadContainer = styled.div`
  margin-top: 20px;
  text-align: center;
  padding: 20px;
  border: 1px dashed #ccc;
  border-radius: 8px;
  background-color: #f9f9f9;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

const UploadMessage = styled.p`
  margin-bottom: 16px;
  color: ${props => props.theme.font.color.secondary};
`;

interface AttachmentPanelProps {
  isOpen: boolean;
  onClose: () => void;
  candidateId: string;
  candidateName: string;
  PanelContainer?: React.ComponentType<{ isOpen: boolean }>;
}

const AttachmentPanel: React.FC<AttachmentPanelProps> = ({
  isOpen,
  onClose,
  candidateId,
  candidateName,
  PanelContainer = DefaultPanelContainer, // Use default if not provided
}) => {
  const Container = PanelContainer || DefaultPanelContainer;
  const isInline = PanelContainer !== DefaultPanelContainer;
  
  const [attachments, setAttachments] = useState<
    Array<{ id: string; name: string; fullPath: string }>
  >([]);
  const [currentAttachmentIndex, setCurrentAttachmentIndex] = useState(0);
  const [fileContent, setFileContent] = useState<string | ArrayBuffer | null>(
    null,
  );
  const [tokenPair] = useRecoilState(tokenPairState);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);

  // Add state to track when CV is uploaded
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const onDocumentLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setNumPages(numPages);
      console.log('PDF loaded successfully. Number of pages:', numPages);
    },
    [],
  );

  const options = useMemo(
    () => ({
      cMapUrl: 'cmaps/',
      cMapPacked: true,
    }),
    [],
  );

  function onDocumentLoadError(error: Error) {
    console.error('Error loading PDF:', error);
    setError(error.message);
  }

  const handlePrevPage = useCallback(() => {
    setPageNumber((prevPageNumber) => Math.max(prevPageNumber - 1, 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setPageNumber((prevPageNumber) =>
      Math.min(prevPageNumber + 1, numPages || 1),
    );
  }, [numPages]);

  useEffect(() => {
    if (isOpen && candidateId) {
      fetchAttachments();
    }
  }, [isOpen, candidateId]);

  const fetchAttachments = useCallback(async () => {
    if (!isOpen || !candidateId) return;

    try {
      setIsLoading(true);
      setError(null);
      const response = await axios.post(
        `${process.env.REACT_APP_SERVER_BASE_URL}/graphql`,
        {
          operationName: 'FindManyAttachments',
          variables: {
            filter: { candidateId: { eq: candidateId } },
            orderBy: [{ createdAt: 'DescNullsFirst' }],
          },
          query: findManyAttachmentsQuery,
        },
        {
          headers: {
            Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const fetchedAttachments = response?.data?.data?.attachments?.edges?.map(
        (edge: any) => edge.node,
      );
      setAttachments(fetchedAttachments || []);
      setCurrentAttachmentIndex(0);
      console.log('Total Attachments: ', fetchedAttachments?.length || 0);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching attachments:', error);
      setError('Failed to fetch attachments. Please try again.');
      setIsLoading(false);
    }
  }, [isOpen, candidateId, tokenPair]);

  const handlePrevAttachment = useCallback(() => {
    setCurrentAttachmentIndex((prevIndex) => Math.max(prevIndex - 1, 0));
  }, []);

  const handleNextAttachment = useCallback(() => {
    setCurrentAttachmentIndex((prevIndex) =>
      Math.min(prevIndex + 1, attachments.length - 1),
    );
  }, [attachments.length]);

  useEffect(() => {
    return () => {
      if (
        fileContent &&
        typeof fileContent === 'string' &&
        fileContent.startsWith('blob:')
      ) {
        URL.revokeObjectURL(fileContent);
      }
    };
  }, [fileContent]);

  const fetchFileContent = useCallback(
    async (attachment: { id: string; name: string; fullPath: string }) => {
      try {
        if (!attachment || fileContent) return;

        setIsLoading(true);
        setError(null);
        setFileContent(null);
        setDownloadUrl(null);
        console.log(
          'This si the attachment.fullPath REACT_APP_SERVER_BASE_URL::',
          process.env.REACT_APP_SERVER_BASE_URL,
        );
        console.log('This si the fullPath::', attachment.fullPath);

        // const response = await axios.get(`${process.env.REACT_APP_SERVER_BASE_URL}/files/${attachment.fullPath}`, { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` }, responseType: 'arraybuffer' });
        const response = await axios.get(`${attachment.fullPath}`, {
          headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` },
          responseType: 'arraybuffer',
        });

        let contentType =
          response.headers['content-type'] ||
          attachment?.fullPath
            ?.split('?')[0]
            ?.split('.')
            .pop()
            ?.toLowerCase() ||
          'application/octet-stream';
        contentType = contentType.split(';')[0];

        if (!contentType) {
          const fileExtension = attachment.name.split('.').pop()?.toLowerCase();
          contentType = getContentTypeFromExtension(fileExtension);
        }

        const blob = new Blob([response.data], {
          type: contentType || 'application/octet-stream',
        });

        if (contentType && contentType.includes('pdf')) {
          const url = URL.createObjectURL(blob);
          setFileContent(url);
        } else if (
          contentType &&
          (contentType.includes('word') ||
            contentType.includes('doc') ||
            contentType.includes('docx') ||
            contentType.includes('msword') ||
            contentType.includes(
              'openxmlformats-officedocument.wordprocessingml.document',
            ))
        ) {
          try {
            const arrayBuffer = await blob.arrayBuffer();
            let result: DocHandlerResult;

            if (contentType.includes('doc') && !contentType.includes('docx')) {
              // For .doc files, we need to use a different library or API
              // Here, we'll use a placeholder for the actual implementation
              result = await handleDocFile(arrayBuffer);
            } else {
              // For .docx files, we can use mammoth
              result = await mammoth.convertToHtml({
                arrayBuffer: arrayBuffer,
              });
            }

            setFileContent(result.value);
          } catch (conversionError) {
            console.error('Document conversion failed:', conversionError);
            const url = URL.createObjectURL(blob);
            setDownloadUrl(url);
            setFileContent(
              `Unable to display the document. Click the link below to download the ${attachment.name} file.`,
            );
          }
        } else if (
          contentType &&
          (contentType.includes('text') ||
            contentType.includes('xml') ||
            contentType.includes('json'))
        ) {
          const decoder = new TextDecoder('utf-8');
          const text = decoder.decode(response.data);
          setFileContent(text);
        } else {
          const url = URL.createObjectURL(blob);
          setDownloadUrl(url);
          setFileContent(
            `Unknown file type. Click the link below to download the ${attachment.name} file.`,
          );
        }
      } catch (error) {
        console.error('Error fetching file content:', error);
        setError(
          `Attachment not found or could not be loaded.`,
        );
      }
      setIsLoading(false);
    },
    [tokenPair],
  );

  const handleDocFile = async (
    arrayBuffer: ArrayBuffer,
  ): Promise<DocHandlerResult> => {
    try {
      // Attempt to extract text using a simple method
      const uint8Array = new Uint8Array(arrayBuffer);
      let text = '';
      for (let i = 0; i < uint8Array.length; i++) {
        const char = String.fromCharCode(uint8Array[i]);
        if (char.match(/[\x20-\x7E]/)) {
          // Only include printable ASCII characters
          text += char;
        }
      }
      return { value: `<pre>${text}</pre>` };
    } catch (error) {
      console.error('Error processing .doc file:', error);
      return {
        value:
          '<p>Unable to read .doc file content. The file may be corrupt or use unsupported features.</p>',
      };
    }
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

  const DocxViewer: React.FC<{ content: string }> = ({ content }) => {
    const lines = content.split(/\r?\n/).filter((line) => line.trim());
    return (
      <DocViewer>
        {lines?.map((line, index) => <p key={index}>{line}</p>)}
      </DocViewer>
    );
  };

  useEffect(() => {
    if (attachments.length > 0) {
      fetchFileContent(attachments[currentAttachmentIndex]);
    } else {
      setIsLoading(false);
    }
  }, [currentAttachmentIndex, attachments, fetchFileContent]);

  const currentAttachment = useMemo(
    () => attachments[currentAttachmentIndex],
    [attachments, currentAttachmentIndex],
  );

  console.log('Current Attachment ::', currentAttachment);
  console.log('Total Attachments : ', attachments?.length);
  
  // Choose the appropriate content container based on whether we're inline
  const CustomContentContainer = isInline ? InlineContentContainer : ContentContainer;
  
  // Handle successful upload
  const handleUploadSuccess = useCallback(() => {
    setUploadSuccess(true);
    fetchAttachments();
  }, [fetchAttachments]);

  return (
    <Container isOpen={isOpen}>
      {!isInline && <CloseButton onClick={onClose}>&times;</CloseButton>}
      <Header>
        <CandidateInfo>
          <CandidateName>{candidateName}</CandidateName>
          {currentAttachment && <FileName>{currentAttachment.name}</FileName>}
        </CandidateInfo>
        <NavigationContainer>
          <NavButton
            onClick={handlePrevAttachment}
            disabled={currentAttachmentIndex === 0}
          >
            &#9650;
          </NavButton>
          <AttachmentCounter>
            {attachments.length > 0 
              ? `${currentAttachmentIndex + 1} of ${attachments.length}` 
              : 'No attachments'}
          </AttachmentCounter>
          <NavButton
            onClick={handleNextAttachment}
            disabled={currentAttachmentIndex === attachments.length - 1}
          >
            &#9660;
          </NavButton>
        </NavigationContainer>
      </Header>
      <CustomContentContainer>
        {error ? (
          <NotFoundMessage>{error}</NotFoundMessage>
        ) : isLoading ? (
          <div>Loading attachments...</div>
        ) : attachments.length === 0 ? (
          <>
            <NotFoundMessage>No attachments found for this candidate</NotFoundMessage>
            <UploadContainer>
              <UploadMessage>Upload a CV for this candidate</UploadMessage>
              <UploadCV 
                candidateId={candidateId}
                tokenPair={tokenPair}
                onUploadSuccess={handleUploadSuccess}
                currentIndividual={null}
                buttonColor="#000000"
              />
            </UploadContainer>
          </>
        ) : fileContent ? (
          typeof fileContent === 'string' &&
          fileContent.startsWith('blob:') ? (
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
          ) : typeof fileContent === 'string' &&
            fileContent.startsWith('<') ? (
            // <DocxViewer dangerouslySetInnerHTML={{ __html: fileContent }} />
            <DocxViewer content={fileContent} />
          ) : (
            <ContentViewer>
              {typeof fileContent === 'string'
                ? fileContent
                : 'Unsupported file type'}
            </ContentViewer>
          )
        ) : (
          <div>Loading...</div>
        )}
        {downloadUrl && (
          <a href={downloadUrl} download={currentAttachment?.name}>
            Download {currentAttachment?.name}
          </a>
        )}
      </CustomContentContainer>
    </Container>
  );
};

export default AttachmentPanel;
