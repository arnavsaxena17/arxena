import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import { Button, IconTrash } from 'twenty-ui';

import { ParsedJD } from '../types/ParsedJD';
import { ArxJDStepHeading } from './ArxJDStepHeading';
import { UploadForm } from './UploadForm';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
  overflow: auto;
`;

const StyledContent = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledInstructions = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.md};
  line-height: 1.5;
  margin-bottom: ${({ theme }) => theme.spacing(4)};
`;

const StyledList = styled.ul`
  margin-top: ${({ theme }) => theme.spacing(2)};
  margin-left: ${({ theme }) => theme.spacing(4)};
  list-style-type: disc;
`;

const StyledListItem = styled.li`
  margin-bottom: ${({ theme }) => theme.spacing(1)};
`;

const StyledExistingFileSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-bottom: ${({ theme }) => theme.spacing(4)};
  padding: ${({ theme }) => theme.spacing(3)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
`;

const StyledFileInfo = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const StyledFileName = styled.div`
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledFileActions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledNextButton = styled(Button)`
  margin-top: ${({ theme }) => theme.spacing(4)};
  align-self: flex-end;
`;

type ArxJDUploadStepProps = {
  getRootProps: () => Record<string, any>;
  getInputProps: () => Record<string, any>;
  isDragActive: boolean;
  isUploading: boolean;
  error: string | null;
  onNext?: () => void;
  canAdvance?: boolean;
  isEditMode?: boolean;
  parsedJD?: ParsedJD | null;
  onRemoveFile?: () => void;
  totalSteps?: number;
  currentStep?: number;
};
export const ArxJDUploadStep = ({
  getRootProps,
  getInputProps,
  isDragActive,
  isUploading,
  error,
  onNext,
  canAdvance = false,
  isEditMode = false,
  parsedJD = null,
  onRemoveFile,
  totalSteps,
  currentStep = 1,
}: ArxJDUploadStepProps) => {
  const theme = useTheme();

  // Helper to extract filename from job data
  const getFileName = () => {
    // Return null if parsedJD is null or name is empty
    if (!parsedJD || !parsedJD.name || parsedJD.name.trim() === '') return null;
    
    // If we have a job code, use that as part of the displayed filename
    const jobCode = parsedJD.jobCode ? `${parsedJD.jobCode} - ` : '';
    return `${jobCode}${parsedJD.name}.pdf`;
  };

  // Show file info in both edit mode and when a file has been uploaded in create mode
  const fileName = getFileName();
  const hasFile = fileName !== null;

  return (
    <StyledContainer>
      <StyledContent>
        <ArxJDStepHeading
          title={isEditMode ? "Manage Job Description File" : "Upload Job Description"}
          // description={isEditMode 
            // ? "View, replace, or remove the current job description file" 
            // : "Upload a job description file to get started"}
          currentStep={currentStep}
          totalSteps={totalSteps}
        />

        {hasFile && (
          <StyledExistingFileSection>
            <h3>{isEditMode ? "Current Job Description File" : "Uploaded Job Description File"}</h3>
            <StyledFileInfo>
              <StyledFileName>{fileName}</StyledFileName>
              <StyledFileActions>
                <Button
                  variant="secondary"
                  accent="danger"
                  title="Remove"
                  Icon={IconTrash}
                  onClick={onRemoveFile}
                />
              </StyledFileActions>
            </StyledFileInfo>
          </StyledExistingFileSection>
        )}

        {!hasFile && (
          <>
            <StyledInstructions>
              {/* <p>Please upload a job description file to begin. We support the following formats:</p> */}
              {/* <StyledList>
                <StyledListItem>PDF (.pdf)</StyledListItem>
                <StyledListItem>Microsoft Word (.doc, .docx)</StyledListItem>
                <StyledListItem>Text (.txt)</StyledListItem>
              </StyledList>
              <p>Maximum file size: 10MB</p> */}
            </StyledInstructions>
            <UploadForm
              getRootProps={getRootProps}
              getInputProps={getInputProps}
              isDragActive={isDragActive}
              isUploading={isUploading}
              error={error}
              theme={theme}
              uploadButtonLabel="Upload File"
            />
          </>
        )}

        {/* Add Next button when file is uploaded in non-edit mode */}
        {hasFile && !isEditMode && onNext && (
          <StyledNextButton
            variant="primary"
            title="Continue to Job Details"
            onClick={onNext}
          >
            Continue to Job Details
          </StyledNextButton>
        )}
      </StyledContent>
    </StyledContainer>
  );
};
