import styled from '@emotion/styled';
import { useState } from 'react';
import { Button, IconUpload } from 'twenty-ui';
import { StyledDropzoneArea } from './ArxJDUploadModal.styled';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(4)};
  width: 100%;
`;

const StyledOrSeparator = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  margin: ${({ theme }) => theme.spacing(2)} 0;
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  
  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background-color: ${({ theme }) => theme.border.color.medium};
  }
`;

const StyledNameInputContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3)};
  background-color: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
`;

const StyledNameInput = styled.input`
  background-color: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  padding: ${({ theme }) => theme.spacing(2)};
  font-size: ${({ theme }) => theme.font.size.md};
  color: ${({ theme }) => theme.font.color.primary};
  
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.color.blue};
  }
`;

const StyledLabel = styled.label`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
`;

type UploadFormProps = {
  getRootProps: any;
  getInputProps: any;
  isDragActive: boolean;
  isUploading: boolean;
  error: string | null;
  theme: any;
  uploadButtonLabel?: string;
  onCreateJobFromName?: (jobName: string) => Promise<void>;
};

export const UploadForm = ({
  getRootProps,
  getInputProps,
  isDragActive,
  isUploading,
  error,
  theme,
  uploadButtonLabel = "Upload File",
  onCreateJobFromName,
}: UploadFormProps) => {
  const rootProps = getRootProps();
  const inputProps = getInputProps();
  const [jobName, setJobName] = useState('');
  const [isCreatingJob, setIsCreatingJob] = useState(false);

  // Prevent hotkey propagation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
  };

  const handleCreateJobFromName = async () => {
    if (!jobName.trim()) {
      return;
    }
    
    if (!onCreateJobFromName) {
      return;
    }

    setIsCreatingJob(true);
    try {
      await onCreateJobFromName(jobName.trim());
      setJobName('');
    } catch (error) {
      console.error('Error creating job from name:', error);
    } finally {
      setIsCreatingJob(false);
    }
  };

  const handleNameInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCreateJobFromName();
    }
  };

  return (
    <StyledContainer>
      <StyledDropzoneArea
        {...rootProps}
        onKeyDown={handleKeyDown}
      >
        <input
          {...inputProps}
          style={{ display: 'none' }}
          onKeyDown={handleKeyDown}
        />
        <IconUpload size={32} />
        {isDragActive ? (
          <p>Drop the JD file here...</p>
        ) : (
          <p>
            Drag & drop a JD file here, or click to {uploadButtonLabel.toLowerCase()}
            <br />
            <small>Supported formats: PDF, DOC, DOCX (max 10MB)</small>
          </p>
        )}
        {isUploading && <p>Uploading and processing your file...</p>}
        {error && (
          <p
            style={{
              color: theme.color.red,
              marginTop: '8px',
              padding: '8px',
              backgroundColor: theme.background.danger,
              borderRadius: '4px',
              maxWidth: '80%',
              textAlign: 'center',
            }}
          >
            {error}
          </p>
        )}
      </StyledDropzoneArea>

      <StyledOrSeparator>or</StyledOrSeparator>

      <StyledNameInputContainer>
        <StyledLabel htmlFor="job-name-input">Enter Job Name</StyledLabel>
        <StyledNameInput
          id="job-name-input"
          type="text"
          placeholder="e.g., Software Engineer"
          value={jobName}
          onChange={(e) => setJobName(e.target.value)}
          onKeyDown={handleNameInputKeyDown}
          disabled={isCreatingJob || isUploading}
        />
        <Button
          title="Create Job"
          fullWidth={false}
          size="small"
          position="middle"
          accent="blue"
          justify="center"
          variant="secondary"
          onClick={handleCreateJobFromName}
          disabled={!jobName.trim() || isCreatingJob || isUploading}
        >
          {isCreatingJob ? 'Creating...' : 'Create Job'}
        </Button>
      </StyledNameInputContainer>
    </StyledContainer>
  );
};
