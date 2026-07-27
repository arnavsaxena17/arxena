import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useFindManyAttachments } from '@/candidate-search/hooks/useFindManyAttachments';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { styled } from '@linaria/react';
import axios from 'axios';
import DOMPurify from 'dompurify';
import mammoth from 'mammoth';
import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getAttachmentDownloadUrl } from 'twenty-shared/utils';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

import { UploadCV } from './UploadCV';

type AttachmentListItem = {
  id: string;
  name: string;
  fullPath?: string | null;
  file?: Array<{ url?: string | null } | null> | null;
};

type DocHandlerResult = {
  value: string;
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

const handleDocFile = async (
  arrayBuffer: ArrayBuffer,
): Promise<DocHandlerResult> => {
  try {
    const uint8Array = new Uint8Array(arrayBuffer);
    let text = '';
    for (let i = 0; i < uint8Array.length; i++) {
      const char = String.fromCharCode(uint8Array[i]);
      if (char.match(/[\x20-\x7E]/)) {
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

const isPdfArrayBuffer = (buffer: ArrayBuffer): boolean => {
  if (buffer.byteLength < 5) {
    return false;
  }

  const header = new TextDecoder('ascii').decode(buffer.slice(0, 5));

  return header === '%PDF-';
};

const isZipArrayBuffer = (buffer: ArrayBuffer): boolean => {
  if (buffer.byteLength < 4) {
    return false;
  }

  const bytes = new Uint8Array(buffer);

  // DOCX is a ZIP (PK..)
  return bytes[0] === 0x50 && bytes[1] === 0x4b;
};

// Legacy fullPath is storage-relative (e.g. attachment/<uuid>.pdf).
// Signed FILES-field URLs are already absolute (/file/files-field/...).
// Server may sign with localhost while the app runs on arxena.localhost.
const normalizeAttachmentUrl = (url: string): string => {
  try {
    const lowerCaseUrl = url.toLowerCase();
    const isAbsoluteUri =
      ['http:', 'https:', 'data:', 'blob:'].some((scheme) =>
        lowerCaseUrl.startsWith(scheme),
      ) || url.startsWith('//');

    let resolvedUrl = url;

    if (!isAbsoluteUri) {
      const isFileByIdPath =
        url.startsWith('/file/') || url.startsWith('file/');
      const isLegacyFilesPath =
        url.startsWith('/files/') || url.startsWith('files/');

      if (!isFileByIdPath && !isLegacyFilesPath) {
        const relativePath = url.replace(/^\//, '');
        resolvedUrl = `/files/${relativePath}`;
      } else if (!url.startsWith('/')) {
        resolvedUrl = `/${url}`;
      }
    }

    const parsedUrl = new URL(resolvedUrl, REACT_APP_SERVER_BASE_URL);
    const serverBaseUrl = new URL(REACT_APP_SERVER_BASE_URL);

    if (
      parsedUrl.hostname === 'localhost' ||
      parsedUrl.hostname === '127.0.0.1'
    ) {
      parsedUrl.protocol = serverBaseUrl.protocol;
      parsedUrl.hostname = serverBaseUrl.hostname;
      parsedUrl.port = serverBaseUrl.port;
    }

    return parsedUrl.toString();
  } catch {
    return url;
  }
};

// Lazy: keep react-pdf/pdfjs-dist out of wyw-in-js evaluation of this Linaria module
const AttachmentPdfViewer = lazy(() =>
  import('./AttachmentPdfViewer').then((module) => ({
    default: module.AttachmentPdfViewer,
  })),
);

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
  padding: 24px;
  background: white;
  border-radius: 4px;
  font-family: 'Calibri', 'Arial', sans-serif;
  line-height: 1.6;
  color: #333;

  h1 {
    font-size: 24px;
    font-weight: bold;
    margin: 16px 0 8px;
    color: #2c3e50;
  }

  h2 {
    font-size: 20px;
    font-weight: bold;
    margin: 14px 0 7px;
  }

  h3 {
    font-size: 16px;
    font-weight: bold;
    margin: 12px 0 6px;
  }

  p {
    margin: 8px 0;
    font-size: 14px;
  }

  strong {
    font-weight: 600;
  }

  ul, ol {
    margin: 8px 0;
    padding-left: 24px;
  }

  li {
    margin: 4px 0;
  }

  table {
    border-collapse: collapse;
    margin: 16px 0;
    width: 100%;
  }

  td, th {
    border: 1px solid #ddd;
    padding: 8px;
  }

  th {
    background-color: #f5f5f5;
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
  padding: 12px 16px;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: ${themeCssVariables.background.primary};
`;

const CandidateInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const CandidateName = styled.h2`
  font-size: 14px;
  font-weight: 500;
  color: ${themeCssVariables.font.color.primary};
  margin: 0;
`;

const FileName = styled.h3`
  font-size: 13px;
  font-weight: 400;
  color: ${themeCssVariables.font.color.tertiary};
  margin: 0;
`;

const NavigationContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const NavButton = styled.button`
  background: transparent;
  border: none;
  color: ${themeCssVariables.font.color.secondary};
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;

  &:hover:not(:disabled) {
    background: ${themeCssVariables.background.tertiary};
  }

  &:disabled {
    color: ${themeCssVariables.font.color.light};
    cursor: not-allowed;
  }
`;

const AttachmentCounter = styled.span`
  font-size: 13px;
  color: ${themeCssVariables.font.color.secondary};
  margin: 0 8px;
  min-width: 60px;
  text-align: center;
`;

const DownloadButton = styled.button`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: 4px;
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  font-size: 13px;
  margin-left: 12px;
  padding: 6px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;

  &:hover:not(:disabled) {
    background: ${themeCssVariables.background.tertiary};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
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

const PDFContainer = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  width: 100%;
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
  color: ${props => themeCssVariables.font.color.secondary};
`;

const RetryButton = styled.button`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: 4px;
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  font-size: 13px;
  padding: 8px 16px;
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;

  &:hover {
    background: ${themeCssVariables.background.tertiary};
  }
`;

const ErrorContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;
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

  const [attachments, setAttachments] = useState<AttachmentListItem[]>([]);
  const [currentAttachmentIndex, setCurrentAttachmentIndex] = useState(0);
  const [fileContent, setFileContent] = useState<string | ArrayBuffer | null>(
    null,
  );
  const [tokenPair] = useAtomState(tokenPairState);
  const currentWorkspaceMember = useAtomStateValue(currentWorkspaceMemberState);
  const { findManyAttachments } = useFindManyAttachments();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // Add state to track when CV is uploaded
  const [uploadSuccess, setUploadSuccess] = useState(false);

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

      const fetchedAttachments = await findManyAttachments({
        filter: { targetCandidateId: { eq: candidateId } },
        orderBy: [{ createdAt: 'DescNullsFirst' }],
      });

      setAttachments(fetchedAttachments as AttachmentListItem[]);
      setCurrentAttachmentIndex(0);
      console.log('Total Attachments: ', fetchedAttachments?.length || 0);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching attachments:', error);
      setError('Failed to fetch attachments. Please try again.');
      setIsLoading(false);
    }
  }, [isOpen, candidateId, findManyAttachments]);

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
      if (downloadUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(downloadUrl);
      }
    };
  }, [downloadUrl]);

  const fetchFileContent = useCallback(
    async (attachment: AttachmentListItem) => {
      if (!attachment) {
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        setFileContent(null);
        setDownloadUrl(null);

        const rawAttachmentUrl = getAttachmentDownloadUrl(attachment);

        if (!rawAttachmentUrl) {
          setError('Attachment not found or could not be loaded.');
          setIsLoading(false);

          return;
        }

        const attachmentUrl = normalizeAttachmentUrl(rawAttachmentUrl);
        const fileExtension = attachment.name.split('.').pop()?.toLowerCase();
        const extensionContentType = getContentTypeFromExtension(fileExtension);
        const isPdfByName =
          fileExtension === 'pdf' || extensionContentType.includes('pdf');
        const isDocByName =
          fileExtension === 'doc' || fileExtension === 'docx';

        // Signed FILES-field URLs already carry ?token= — do not send Bearer
        // (Authorization forces a CORS preflight that often fails cross-origin).
        const isSignedFileUrl =
          attachmentUrl.includes('token=') ||
          Boolean(attachment.file?.[0]?.url);

        const response = await axios.get(attachmentUrl, {
          headers: isSignedFileUrl
            ? undefined
            : {
                Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}`,
              },
          responseType: 'arraybuffer',
        });

        const responseBuffer = response.data as ArrayBuffer;
        let contentType = (
          response.headers['content-type'] || ''
        ).split(';')[0];

        // /file/filesField/<uuid> has no extension — prefer filename when header is weak
        if (
          !contentType ||
          contentType === 'application/octet-stream' ||
          !contentType.includes('/')
        ) {
          contentType = extensionContentType;
        }

        if (contentType.includes('pdf') || isPdfByName) {
          if (!isPdfArrayBuffer(responseBuffer)) {
            setError(
              'Downloaded file is not a valid PDF. The storage URL may be expired or incorrect.',
            );
            setIsLoading(false);

            return;
          }

          // Pass bytes directly — blob: URLs get revoked by Strict Mode cleanup
          setFileContent(responseBuffer);
        } else if (
          contentType.includes('word') ||
          contentType.includes('doc') ||
          contentType.includes('docx') ||
          contentType.includes('msword') ||
          contentType.includes(
            'openxmlformats-officedocument.wordprocessingml.document',
          ) ||
          isDocByName
        ) {
          try {
            let result: DocHandlerResult;

            if (
              (contentType.includes('doc') && !contentType.includes('docx')) ||
              fileExtension === 'doc'
            ) {
              result = await handleDocFile(responseBuffer);
            } else {
              if (!isZipArrayBuffer(responseBuffer)) {
                throw new Error('Response is not a DOCX/ZIP archive');
              }

              result = await mammoth.convertToHtml({
                arrayBuffer: responseBuffer,
              });
            }

            setFileContent(result.value);
          } catch (conversionError) {
            console.error('Document conversion failed:', conversionError);
            const blob = new Blob([responseBuffer], {
              type: contentType || 'application/octet-stream',
            });
            const url = URL.createObjectURL(blob);
            setDownloadUrl(url);
            setFileContent(
              `Unable to display the document. Click the link below to download the ${attachment.name} file.`,
            );
          }
        } else if (
          contentType.includes('text') ||
          contentType.includes('xml') ||
          contentType.includes('json')
        ) {
          const decoder = new TextDecoder('utf-8');
          const text = decoder.decode(responseBuffer);
          setFileContent(text);
        } else {
          const blob = new Blob([responseBuffer], {
            type: contentType || 'application/octet-stream',
          });
          const url = URL.createObjectURL(blob);
          setDownloadUrl(url);
          setFileContent(
            `Unknown file type. Click the link below to download the ${attachment.name} file.`,
          );
        }
      } catch (error) {
        console.error('Error fetching file content:', error);
        const isLegacyFullPathOnly =
          !attachment.file?.[0]?.url && Boolean(attachment.fullPath);

        setError(
          isLegacyFullPathOnly
            ? 'Legacy attachment file is missing from storage. Re-upload the CV.'
            : 'Attachment not found or could not be loaded.',
        );
      }
      setIsLoading(false);
    },
    [tokenPair],
  );

  const DocxViewer: React.FC<{ content: string }> = ({ content }) => {
    // Sanitize the HTML content
    const sanitizedContent = DOMPurify.sanitize(content, {
      ADD_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'tr', 'td', 'th'],
      ADD_ATTR: ['style'],
    });

    return (
      <DocViewer dangerouslySetInnerHTML={{ __html: sanitizedContent }} />
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

  const handleDownload = useCallback(async () => {
    if (!currentAttachment) return;

    try {
      const rawAttachmentUrl = getAttachmentDownloadUrl(currentAttachment);

      if (!rawAttachmentUrl) {
        setError('Failed to download file. Please try again.');

        return;
      }

      const attachmentUrl = normalizeAttachmentUrl(rawAttachmentUrl);
      const isSignedFileUrl =
        attachmentUrl.includes('token=') ||
        Boolean(currentAttachment.file?.[0]?.url);

      const response = await axios.get(attachmentUrl, {
        headers: isSignedFileUrl
          ? undefined
          : {
              Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}`,
            },
        responseType: 'blob',
      });

      const blob = new Blob([response.data]);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = currentAttachment.name;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      setError('Failed to download file. Please try again.');
    }
  }, [currentAttachment, tokenPair]);

  const handleRetry = useCallback(() => {
    setError(null);
    if (currentAttachment) {
      fetchFileContent(currentAttachment);
    }
  }, [currentAttachment, fetchFileContent]);

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
          {currentAttachment && (
            <DownloadButton
              onClick={handleDownload}
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : 'Download'}
            </DownloadButton>
          )}
        </NavigationContainer>
      </Header>
      <CustomContentContainer>
        {error ? (
          <ErrorContainer>
            <ErrorMessage>{error}</ErrorMessage>
            <RetryButton onClick={handleRetry}>
              Try Again
            </RetryButton>
          </ErrorContainer>
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
                currentIndividual={currentWorkspaceMember}
                buttonColor="#000000"
              />
            </UploadContainer>
          </>
        ) : fileContent ? (
          fileContent instanceof ArrayBuffer ? (
            <PDFContainer>
              <Suspense fallback={<div>Loading PDF...</div>}>
                <AttachmentPdfViewer
                  key={currentAttachment?.id}
                  fileData={fileContent}
                  onRetry={handleRetry}
                />
              </Suspense>
            </PDFContainer>
          ) : typeof fileContent === 'string' &&
            fileContent.startsWith('<') ? (
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
