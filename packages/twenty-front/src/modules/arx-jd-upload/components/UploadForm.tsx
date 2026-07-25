import { Button } from 'twenty-ui/input';
import { IconUpload } from 'twenty-ui/icon';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useState } from 'react';

import { StyledDropzoneArea } from './ArxJDUploadModal.styled';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
  width: 100%;
`;

const StyledOrSeparator = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[2]};
  margin: ${themeCssVariables.spacing[2]} 0;
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background-color: ${themeCssVariables.border.color.medium};
  }
`;

const StyledNameInputContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[3]};
  background-color: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
`;

const StyledNameInput = styled.input`
  background-color: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  padding: ${themeCssVariables.spacing[2]};
  font-size: ${themeCssVariables.font.size.md};
  color: ${themeCssVariables.font.color.primary};

  &:focus {
    outline: none;
    border-color: ${themeCssVariables.color.blue};
  }
`;

const StyledLabel = styled.label`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

type UploadFormProps = {
  getRootProps: any;
  getInputProps: any;
  isDragActive: boolean;
  isUploading: boolean;
  error: string | null;
  uploadButtonLabel?: string;
  onCreateJobFromName?: (jobName: string) => Promise<void>;
};

export const UploadForm = ({
  getRootProps,
  getInputProps,
  isDragActive,
  isUploading,
  error,
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
              color: themeCssVariables.color.red,
              marginTop: '8px',
              padding: '8px',
              backgroundColor: themeCssVariables.background.danger,
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
        <StyledLabel htmlFor="job-name-input">Enter Project Name</StyledLabel>
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
          title={isCreatingJob ? 'Creating...' : 'Create Project'}
          fullWidth={false}
          size="small"
          position="middle"
          accent="blue"
          justify="center"
          variant="secondary"
          onClick={handleCreateJobFromName}
          disabled={!jobName.trim() || isCreatingJob || isUploading}
          isLoading={isCreatingJob}
        />
      </StyledNameInputContainer>
    </StyledContainer>
  );
};
