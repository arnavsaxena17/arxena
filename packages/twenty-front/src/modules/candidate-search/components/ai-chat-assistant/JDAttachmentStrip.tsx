import { ParsedJD } from '@/arx-jd-upload/types/ParsedJD';
import { useFindManyAttachments } from '@/object-record/hooks/useFindManyAttachments';
import styled from '@emotion/styled';
import { useCallback, useEffect, useState } from 'react';
import { Button, IconFile, IconTrash, IconUpload } from 'twenty-ui';

const StyledAttachmentStrip = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(2)};
  background-color: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledFileInfo = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  flex: 1;
`;

const StyledFileName = styled.span`
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledFileActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledDropzoneArea = styled.div<{ isDragActive?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing(2)};
  border: 2px dashed ${({ theme, isDragActive }) => 
    isDragActive ? theme.color.blue : theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme, isDragActive }) => 
    isDragActive ? theme.color.blue10 : theme.background.transparent.light};
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  
  &:hover {
    border-color: ${({ theme }) => theme.color.blue};
    background-color: ${({ theme }) => theme.color.blue10};
  }
  
  p {
    margin: 0;
    text-align: center;
    color: ${({ theme }) => theme.font.color.secondary};
    font-size: ${({ theme }) => theme.font.size.sm};
  }
  
  small {
    display: block;
    margin-top: ${({ theme }) => theme.spacing(1)};
    color: ${({ theme }) => theme.font.color.tertiary};
    font-size: ${({ theme }) => theme.font.size.xs};
  }
`;

type JDAttachmentStripProps = {
  parsedJD: ParsedJD | null;
  onFileRemove?: () => Promise<void>;
  onFileUpload?: (files: File[]) => Promise<void>;
  isUploading?: boolean;
  onParsedJDUpdate?: (updatedParsedJD: ParsedJD) => void;
};

export const JDAttachmentStrip = ({
  parsedJD,
  onFileRemove,
  onFileUpload,
  isUploading = false,
  onParsedJDUpdate,
}: JDAttachmentStripProps) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [showDropzone, setShowDropzone] = useState(false);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(false);

  const { findManyAttachments } = useFindManyAttachments();

  // Fetch attachments for the current job using parsedJD.id
  useEffect(() => {
    const fetchAttachments = async () => {
      if (!parsedJD?.id) {
        setAttachments([]);
        return;
      }

      try {
        setIsLoadingAttachments(true);
        const fetchedAttachments = await findManyAttachments({
          filter: { jobId: { eq: parsedJD.id } },
          orderBy: [{ createdAt: 'DescNullsFirst' }],
          limit: 1,
        });
        setAttachments(fetchedAttachments);
        console.log('JDAttachmentStrip - Fetched attachments for job:', parsedJD.id, fetchedAttachments);
      } catch (error) {
        console.error('Error fetching attachments:', error);
        setAttachments([]);
      } finally {
        setIsLoadingAttachments(false);
      }
    };

    fetchAttachments();
  }, [parsedJD?.id, findManyAttachments]);

  const getFileName = () => {
    // First priority: use actual attachment name if available
    if (attachments && attachments.length > 0 && attachments[0]?.name) {
      return attachments[0].name;
    }
    
    // Fallback to parsedJD name if available
    if (parsedJD && parsedJD.name && parsedJD.name.trim() !== '') {
      const jobCode = parsedJD.jobCode ? `${parsedJD.jobCode} - ` : '';
      return `${jobCode}${parsedJD.name}.pdf`;
    }
    
    // Final fallback: show generic name
    return 'Job Description';
  };

  const fileName = getFileName();
  const hasFile = attachments && attachments.length > 0;

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    setShowDropzone(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0 && onFileUpload) {
      await onFileUpload(files);
      
      // Update parsedJD with new file name
      if (parsedJD && onParsedJDUpdate) {
        const fileName = files[0].name;
        const updatedParsedJD = {
          ...parsedJD,
          name: fileName.replace(/\.(pdf|doc|docx|txt)$/i, ''), // Remove file extension
        };
        onParsedJDUpdate(updatedParsedJD);
      }
    }
  }, [onFileUpload, parsedJD, onParsedJDUpdate]);

  const handleFileInputChange = useCallback(async (e: Event) => {
    const target = e.target as HTMLInputElement;
    const files = Array.from(target.files || []);
    if (files.length > 0 && onFileUpload) {
      await onFileUpload(files);
      
      // Update parsedJD with new file name
      if (parsedJD && onParsedJDUpdate) {
        const fileName = files[0].name;
        const updatedParsedJD = {
          ...parsedJD,
          name: fileName.replace(/\.(pdf|doc|docx|txt)$/i, ''), // Remove file extension
        };
        onParsedJDUpdate(updatedParsedJD);
      }
    }
    setShowDropzone(false);
  }, [onFileUpload, parsedJD, onParsedJDUpdate]);

  const handleRemoveFile = useCallback(async () => {
    if (onFileRemove) {
      await onFileRemove();
      
      // Update parsedJD to reflect file removal
      if (parsedJD && onParsedJDUpdate) {
        const updatedParsedJD = {
          ...parsedJD,
          name: parsedJD.name.replace(/ \(No file attached\)$/, ''), // Remove the "(No file attached)" suffix if it exists
        };
        onParsedJDUpdate(updatedParsedJD);
      }
    }
  }, [onFileRemove, parsedJD, onParsedJDUpdate]);

  const handleReplaceFile = useCallback(() => {
    setShowDropzone(true);
  }, []);

  // Don't render if no parsedJD or job ID is available
  if (!parsedJD || !parsedJD.id) {
    return null;
  }

  // Show loading state while fetching attachments
  if (isLoadingAttachments) {
    return (
      <StyledAttachmentStrip>
        <StyledFileInfo>
          <IconFile size={16} />
          <StyledFileName>Loading JD attachment...</StyledFileName>
        </StyledFileInfo>
      </StyledAttachmentStrip>
    );
  }

  return (
    <>
      <StyledAttachmentStrip>
        <StyledFileInfo>
          <IconFile size={16} />
          <StyledFileName>
            {hasFile ? fileName : `${parsedJD?.name || 'Job Description'} (No file attached)`}
          </StyledFileName>
        </StyledFileInfo>
        <StyledFileActions>
          <Button
            variant="tertiary"
            size="small"
            title={hasFile ? "Replace JD" : "Upload JD"}
            Icon={IconUpload}
            onClick={handleReplaceFile}
            disabled={isUploading}
          />
          {hasFile && (
            <Button
              variant="tertiary"
              size="small"
              accent="danger"
              title="Remove JD"
              Icon={IconTrash}
              onClick={handleRemoveFile}
              disabled={isUploading}
            />
          )}
        </StyledFileActions>
      </StyledAttachmentStrip>

      {showDropzone && (
        <StyledDropzoneArea
          isDragActive={isDragActive}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.pdf,.doc,.docx,.txt';
            input.multiple = false;
            input.onchange = handleFileInputChange;
            input.click();
          }}
        >
          <div>
            <IconUpload size={24} />
            <p>
              {isDragActive 
                ? 'Drop the JD file here...' 
                : hasFile 
                  ? 'Click to select a new JD file or drag & drop'
                  : 'Click to upload a JD file or drag & drop'
              }
            </p>
            <small>Supported formats: PDF, DOC, DOCX (max 10MB)</small>
            {isUploading && <p>Uploading and processing...</p>}
          </div>
        </StyledDropzoneArea>
      )}
    </>
  );
};
