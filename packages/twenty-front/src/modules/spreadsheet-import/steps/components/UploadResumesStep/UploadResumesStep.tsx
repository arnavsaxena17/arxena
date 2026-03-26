import styled from '@emotion/styled';
import { useCallback, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { Modal } from '@/ui/layout/modal/components/Modal';
import { Checkbox, MainButton } from 'twenty-ui';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { jobIdAtom, jobsState } from '@/candidate-table/states/states';
import { useSpreadsheetImportInternal } from '@/spreadsheet-import/hooks/useSpreadsheetImportInternal';
import { SpreadsheetImportStep } from '@/spreadsheet-import/steps/types/SpreadsheetImportStep';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';

const StyledContent = styled(Modal.Content)`
  align-items: center;
  padding-left: ${({ theme }) => theme.spacing(6)};
  padding-right: ${({ theme }) => theme.spacing(6)};
`;

const StyledFileList = styled.div`
  margin: ${({ theme }) => theme.spacing(4)} 0;
  width: 100%;
`;

const StyledFileItem = styled.div<{ isSelected: boolean }>`
  padding: ${({ theme }) => theme.spacing(3)};
  border: 1px solid ${({ theme, isSelected }) => 
    isSelected ? theme.border.color.strong : theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: ${({ theme, isSelected }) => 
    isSelected ? theme.background.transparent.strong : theme.background.primary};
  transition: all 0.2s ease;
  cursor: pointer;
  
  &:hover {
    border-color: ${({ theme }) => theme.border.color.strong};
    background-color: ${({ theme }) => theme.background.transparent.strong};
  }
`;

const StyledFileInfo = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  margin-left: ${({ theme }) => theme.spacing(3)};
`;

const StyledFileName = styled.span`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.primary};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  margin-bottom: ${({ theme }) => theme.spacing(1)};
`;

const StyledFileSize = styled.span`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledButtonContainer = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-top: ${({ theme }) => theme.spacing(4)};
  justify-content: flex-end;
`;

const StyledSelectAllContainer = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => theme.spacing(2)};
  background-color: ${({ theme }) => theme.background.secondary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
`;

const StyledSelectAllLabel = styled.span`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.primary};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  margin-left: ${({ theme }) => theme.spacing(2)};
`;

type UploadResumesStepProps = {
  files: File[];
  setCurrentStepState: (data: any) => void;
  onError: (message: string) => void;
  nextStep: () => void;
  setPreviousStepState: (data: any) => void;
  onBack: () => void;
  currentStepState: SpreadsheetImportStep;
};

export const UploadResumesStep = ({
  files,
  setCurrentStepState,
  onError,
  nextStep,
  setPreviousStepState,
  onBack,
  currentStepState,
}: UploadResumesStepProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set(files.map((_, index) => index)));
  
  // Get current job context
  const currentJobId = useRecoilValue(jobIdAtom);
  const jobs = useRecoilValue(jobsState);
  const currentJob = jobs.find(job => job.id === currentJobId);
  const [tokenPair] = useRecoilState(tokenPairState);
  
  // Get onClose from context to close modal after successful upload
  const { onClose } = useSpreadsheetImportInternal();
  const { enqueueSnackBar } = useSnackBar();

  // Get refresh function from parent context if available

  const isAllSelected = selectedFiles.size === files.length;
  const isIndeterminate = selectedFiles.size > 0 && selectedFiles.size < files.length;

  const handleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(files.map((_, index) => index)));
    }
  }, [isAllSelected, files.length]);

  const handleSelectFile = useCallback((index: number) => {
    const newSelectedFiles = new Set(selectedFiles);
    if (newSelectedFiles.has(index)) {
      newSelectedFiles.delete(index);
    } else {
      newSelectedFiles.add(index);
    }
    setSelectedFiles(newSelectedFiles);
  }, [selectedFiles]);

  const handleUpload = useCallback(async () => {
    if (selectedFiles.size === 0) {
      onError('Please select at least one file to upload');
      return;
    }

    setIsUploading(true);

    try {
      // Create FormData for file upload with only selected files
      const formData = new FormData();
      const selectedFilesArray = Array.from(selectedFiles).map(index => files[index]);
      const apiToken = tokenPair?.accessToken?.token;
      selectedFilesArray.forEach((file) => {
        formData.append('resume', file);
      });

      // Add required fields for the API
      const jobId = currentJobId || 'temp-job-id';
      const jobName = currentJob?.name || 'Resume Upload';
      formData.append('jobId', jobId);
      formData.append('jobName', jobName);
      
      const response = await fetch(`${process.env.REACT_APP_SERVER_BASE_URL}/resume-upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload resumes');
      }

      const result = await response.json();
      
      // Resume upload is complete - show success message and close modal
      console.log('Resume upload completed successfully:', result);
      
      // Show success message indicating processing has started
      enqueueSnackBar('Resume files uploaded successfully! Processing resumes...', {
        variant: SnackBarVariant.Success,
      });
      
      // Close the modal immediately - progress will be shown via upload progress snackbar
      onClose();
      
      // Trigger data refresh after a delay to allow processing to complete

    } catch (error) {
      onError((error as Error).message);
    } finally {
      setIsUploading(false);
    }
  }, [selectedFiles, files, setCurrentStepState, onError, nextStep, setPreviousStepState, currentStepState, currentJobId, currentJob, enqueueSnackBar, onClose]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <StyledContent>
      <h3>Upload Resume Files</h3>
      <p>Review the selected resume files and click upload to process them.</p>
      
      <StyledSelectAllContainer>
        <Checkbox
          checked={isAllSelected}
          indeterminate={isIndeterminate}
          onChange={handleSelectAll}
        />
        <StyledSelectAllLabel>
          {isAllSelected ? 'Deselect All' : 'Select All'} ({selectedFiles.size} of {files.length} selected)
        </StyledSelectAllLabel>
      </StyledSelectAllContainer>
      
      <StyledFileList>
        {files.map((file, index) => {
          const isSelected = selectedFiles.has(index);
          return (
            <StyledFileItem 
              key={index} 
              isSelected={isSelected}
              onClick={() => handleSelectFile(index)}
            >
              <Checkbox
                checked={isSelected}
                onChange={() => handleSelectFile(index)}
              />
              <StyledFileInfo>
                <StyledFileName>{file.name}</StyledFileName>
                <StyledFileSize>{formatFileSize(file.size)}</StyledFileSize>
              </StyledFileInfo>
            </StyledFileItem>
          );
        })}
      </StyledFileList>

      <StyledButtonContainer>
        <MainButton
          onClick={onBack}
          title="Back"
          variant="secondary"
          disabled={isUploading}
        />
        <MainButton
          onClick={handleUpload}
          title={isUploading ? "Uploading..." : `Upload ${selectedFiles.size} Resume${selectedFiles.size !== 1 ? 's' : ''}`}
          disabled={isUploading || selectedFiles.size === 0}
        />
      </StyledButtonContainer>
    </StyledContent>
  );
};
