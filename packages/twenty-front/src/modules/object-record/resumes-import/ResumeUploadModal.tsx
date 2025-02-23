import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import styled from '@emotion/styled';
import { IconUpload } from 'twenty-ui';

const ModalContainer = styled.div`
  background: ${({ theme }) => theme.background.primary};
  border-radius: ${({ theme }) => theme.border.radius.md};
  padding: ${({ theme }) => theme.spacing(4)};
  width: 23vw;
  max-width: 90vw;
`;

const DropzoneArea = styled.div`
  border: 2px dashed ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  padding: ${({ theme }) => theme.spacing(4)};
  text-align: center;
  cursor: pointer;

  &:hover {
    border-color: ${({ theme }) => theme.border.color.medium};
  }
`;

const FileList = styled.ul`
  list-style: none;
  padding: ${({ theme }) => theme.spacing(2)};
  margin: ${({ theme }) => theme.spacing(2)} 0;
`;

const FileItem = styled.li`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${({ theme }) => theme.spacing(1)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
`;

const ButtonContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-top: ${({ theme }) => theme.spacing(3)};
`;

const Button = styled.button`
  padding: ${({ theme }) => theme.spacing(1, 2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: none;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const UploadButton = styled(Button)`
  background: ${({ theme }) => theme.background.primaryInverted};
  color: ${({ theme }) => theme.font.color.extraLight};
`;

const CancelButton = styled(Button)`
  background: transparent;
  border: 1px solid ${({ theme }) => theme.border.color.medium};
`;

export interface ResumeUploadModalProps {
  onUpload: (files: File[]) => Promise<void>;
  onClose: () => void;
}


export const ResumeUploadModal: React.FC<ResumeUploadModalProps> = ({ 
  onUpload, 
  onClose 
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prev => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
  });

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      await onUpload(files);
      onClose();
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <ModalContainer>
      <h2>Upload Resumes</h2>
      <DropzoneArea {...getRootProps()}>
        <input {...getInputProps()} />
        <IconUpload size={32} />
        {isDragActive ? <p>Drop the resumes here</p> : <p>Drag and drop resumes here, or click to select files</p>}
        <small>Supported formats: PDF, DOC, DOCX</small>
      </DropzoneArea>

      {files.length > 0 && (
        <FileList>
          {files.map((file, index) => (
            <FileItem key={index}>
              <span>
                {file.name} ({Math.round(file.size / 1024)}KB)
              </span>
              <button onClick={() => removeFile(index)}>Remove</button>
            </FileItem>
          ))}
        </FileList>
      )}

      <ButtonContainer>
        <CancelButton onClick={onClose}>Cancel</CancelButton>
        <UploadButton onClick={handleUpload} disabled={isUploading || files.length === 0}>
          {isUploading ? 'Uploading...' : 'Upload Resumes'}
        </UploadButton>
      </ButtonContainer>
    </ModalContainer>
  );
};
