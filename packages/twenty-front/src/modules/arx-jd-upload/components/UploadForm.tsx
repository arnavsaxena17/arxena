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
  align-items: center;
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  gap: ${themeCssVariables.spacing[3]};
  margin: ${themeCssVariables.spacing[1]} 0;
  width: 100%;

  &::before,
  &::after {
    background-color: ${themeCssVariables.border.color.medium};
    content: '';
    flex: 1;
    height: 1px;
  }
`;

const StyledNameInputContainer = styled.div`
  background-color: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
  padding: ${themeCssVariables.spacing[4]};
  width: 100%;
`;

const StyledNameInput = styled.input`
  background-color: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-sizing: border-box;
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  width: 100%;

  &:focus {
    border-color: ${themeCssVariables.color.blue};
    outline: none;
  }
`;

const StyledLabel = styled.label`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledActions = styled.div`
  display: flex;
  justify-content: flex-end;
  width: 100%;
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
        <StyledActions>
          <Button
            title={isCreatingJob ? 'Creating...' : 'Create Project'}
            fullWidth={false}
            size="small"
            accent="blue"
            justify="center"
            variant="primary"
            onClick={handleCreateJobFromName}
            disabled={!jobName.trim() || isCreatingJob || isUploading}
            isLoading={isCreatingJob}
          />
        </StyledActions>
      </StyledNameInputContainer>
    </StyledContainer>
  );
};
