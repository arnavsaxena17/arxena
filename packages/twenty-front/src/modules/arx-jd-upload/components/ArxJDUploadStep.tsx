import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';

import { ArxJDStepHeading } from './ArxJDStepHeading';
import { ArxJDStepNavigation } from './ArxJDStepNavigation';
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

type ArxJDUploadStepProps = {
  getRootProps: () => Record<string, any>;
  getInputProps: () => Record<string, any>;
  isDragActive: boolean;
  isUploading: boolean;
  error: string | null;
  onNext?: () => void;
  canAdvance?: boolean;
};

export const ArxJDUploadStep = ({
  getRootProps,
  getInputProps,
  isDragActive,
  isUploading,
  error,
  onNext,
  canAdvance = false,
}: ArxJDUploadStepProps) => {
  const theme = useTheme();

  return (
    <StyledContainer>
      <StyledContent>
        <ArxJDStepHeading
          title="Upload Job Description"
          description="Upload a job description file to get started"
          currentStep={1}
          totalSteps={3}
        />

        <StyledInstructions>
          <p>
            Please upload a job description file to begin. We support the
            following formats:
          </p>
          <StyledList>
            <StyledListItem>PDF (.pdf)</StyledListItem>
            <StyledListItem>Microsoft Word (.doc, .docx)</StyledListItem>
            <StyledListItem>Text (.txt)</StyledListItem>
          </StyledList>
          <p>Maximum file size: 10MB</p>
        </StyledInstructions>

        <UploadForm
          getRootProps={getRootProps}
          getInputProps={getInputProps}
          isDragActive={isDragActive}
          isUploading={isUploading}
          error={error}
          theme={theme}
        />
      </StyledContent>
      <ArxJDStepNavigation
        onNext={onNext}
        nextLabel="Continue"
        isNextDisabled={!canAdvance}
        showBackButton={false}
      />
    </StyledContainer>
  );
};
