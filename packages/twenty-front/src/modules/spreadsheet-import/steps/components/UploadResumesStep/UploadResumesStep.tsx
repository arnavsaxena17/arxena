import { styled } from '@linaria/react';
import { useCallback, useState } from 'react';

import { tokenPairState } from '@/auth/states/tokenPairState';
import {
    projectIdAtom,
    projectsState,
} from '@/candidate-table/states/states';
import { useSpreadsheetImportInternal } from '@/spreadsheet-import/hooks/useSpreadsheetImportInternal';
import { type SpreadsheetImportStep } from '@/spreadsheet-import/steps/types/SpreadsheetImportStep';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { Checkbox, MainButton } from 'twenty-ui/input';
import { ModalContent } from 'twenty-ui/surfaces';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

const StyledInner = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  width: 100%;
`;

const StyledFileList = styled.div`
  margin: ${themeCssVariables.spacing[4]} 0;
  width: 100%;
`;

const StyledFileItem = styled.div<{ isSelected: boolean }>`
  align-items: center;
  background-color: ${({ isSelected }) =>
    isSelected
      ? themeCssVariables.background.transparent.strong
      : themeCssVariables.background.primary};
  border: 1px solid
    ${({ isSelected }) =>
      isSelected
        ? themeCssVariables.border.color.strong
        : themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  margin-bottom: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[3]};
  transition: all 0.2s ease;

  &:hover {
    background-color: ${themeCssVariables.background.transparent.strong};
    border-color: ${themeCssVariables.border.color.strong};
  }
`;

const StyledFileInfo = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  margin-left: ${themeCssVariables.spacing[3]};
`;

const StyledFileName = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  margin-bottom: ${themeCssVariables.spacing[1]};
`;

const StyledFileSize = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
`;

const StyledButtonContainer = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: flex-end;
  margin-top: ${themeCssVariables.spacing[4]};
`;

const StyledSelectAllContainer = styled.div`
  align-items: center;
  background-color: ${themeCssVariables.background.secondary};
  border-radius: ${themeCssVariables.border.radius.sm};
  display: flex;
  margin-bottom: ${themeCssVariables.spacing[3]};
  padding: ${themeCssVariables.spacing[2]};
  width: 100%;
`;

const StyledSelectAllLabel = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  margin-left: ${themeCssVariables.spacing[2]};
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
  onError,
  onBack,
}: UploadResumesStepProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(
    new Set(files.map((_, index) => index)),
  );

  const projectId = useAtomStateValue(projectIdAtom);
  const projects = useAtomStateValue(projectsState);
  const currentProject = projects.find(
    (project) => project.id === projectId,
  );
  const tokenPair = useAtomStateValue(tokenPairState);

  const { onClose } = useSpreadsheetImportInternal();
  const { enqueueSuccessSnackBar } = useSnackBar();

  const isAllSelected = selectedFiles.size === files.length;
  const isIndeterminate =
    selectedFiles.size > 0 && selectedFiles.size < files.length;

  const handleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(files.map((_, index) => index)));
    }
  }, [isAllSelected, files]);

  const handleSelectFile = useCallback(
    (index: number) => {
      const nextSelectedFiles = new Set(selectedFiles);
      if (nextSelectedFiles.has(index)) {
        nextSelectedFiles.delete(index);
      } else {
        nextSelectedFiles.add(index);
      }
      setSelectedFiles(nextSelectedFiles);
    },
    [selectedFiles],
  );

  const handleUpload = useCallback(async () => {
    if (selectedFiles.size === 0) {
      onError('Please select at least one file to upload');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      const selectedFilesArray = Array.from(selectedFiles).map(
        (index) => files[index],
      );
      const apiToken = tokenPair?.accessOrWorkspaceAgnosticToken?.token;

      selectedFilesArray.forEach((file) => {
        formData.append('resume', file);
      });

      const resolvedProjectId = projectId || 'temp-project-id';
      const jobName = currentProject?.name || 'Resume Upload';
      formData.append('projectId', resolvedProjectId);
      formData.append('jobName', jobName);

      const response = await fetch(`${REACT_APP_SERVER_BASE_URL}/resume-upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload resumes');
      }

      await response.json();

      enqueueSuccessSnackBar({
        message:
          'Resume files uploaded successfully! Processing resumes...',
      });
      onClose();
    } catch (error) {
      onError((error as Error).message);
    } finally {
      setIsUploading(false);
    }
  }, [
    selectedFiles,
    files,
    onError,
    projectId,
    currentProject,
    tokenPair,
    enqueueSuccessSnackBar,
    onClose,
  ]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const kilobyte = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const sizeIndex = Math.floor(Math.log(bytes) / Math.log(kilobyte));
    return `${parseFloat((bytes / Math.pow(kilobyte, sizeIndex)).toFixed(2))} ${sizes[sizeIndex]}`;
  };

  return (
    <ModalContent contentPadding={6}>
      <StyledInner>
        <h3>Upload Resume Files</h3>
        <p>
          Review the selected resume files and click upload to process them.
        </p>

        <StyledSelectAllContainer>
          <Checkbox
            checked={isAllSelected}
            indeterminate={isIndeterminate}
            onChange={handleSelectAll}
          />
          <StyledSelectAllLabel>
            {isAllSelected ? 'Deselect All' : 'Select All'} (
            {selectedFiles.size} of {files.length} selected)
          </StyledSelectAllLabel>
        </StyledSelectAllContainer>

        <StyledFileList>
          {files.map((file, index) => {
            const isSelected = selectedFiles.has(index);
            return (
              <StyledFileItem
                key={`${file.name}-${index}`}
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
            title={
              isUploading
                ? 'Uploading...'
                : `Upload ${selectedFiles.size} Resume${selectedFiles.size !== 1 ? 's' : ''}`
            }
            disabled={isUploading || selectedFiles.size === 0}
          />
        </StyledButtonContainer>
      </StyledInner>
    </ModalContent>
  );
};
