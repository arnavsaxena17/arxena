import styled from '@emotion/styled';
import { useCallback, useState } from 'react';
import { MOBILE_VIEWPORT } from 'twenty-ui';

import { useSpreadsheetImportInitialStep } from '@/spreadsheet-import/hooks/useSpreadsheetImportInitialStep';
import { useSpreadsheetImportInternal } from '@/spreadsheet-import/hooks/useSpreadsheetImportInternal';
import { SpreadsheetImportStep } from '@/spreadsheet-import/steps/types/SpreadsheetImportStep';
import { SpreadsheetImportStepType } from '@/spreadsheet-import/steps/types/SpreadsheetImportStepType';

import { StepBar } from '@/ui/navigation/step-bar/components/StepBar';
import { useStepBar } from '@/ui/navigation/step-bar/hooks/useStepBar';

import { Modal } from '@/ui/layout/modal/components/Modal';
import { SpreadsheetImportStepper } from './SpreadsheetImportStepper';

const StyledHeader = styled(Modal.Header)`
  background-color: ${({ theme }) => theme.background.secondary};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.medium};
  height: 60px;
  padding: 0px;
  padding-left: ${({ theme }) => theme.spacing(30)};
  padding-right: ${({ theme }) => theme.spacing(30)};
  @media (max-width: ${MOBILE_VIEWPORT}px) {
    padding-left: ${({ theme }) => theme.spacing(4)};
    padding-right: ${({ theme }) => theme.spacing(4)};
  }
`;

const stepTitles = {
  uploadStep: 'Upload files',
  selectFilesStep: 'Select files',
  uploadResumesStep: 'Upload resumes',
  matchColumnsStep: 'Match columns',
  validationStep: 'Validate data',
} as const;

export const SpreadsheetImportStepperContainer = () => {
  const { initialStepState } = useSpreadsheetImportInternal();
  const [currentStepState, setCurrentStepState] = useState<SpreadsheetImportStep | null>(null);

  // Check if we're in resume upload flow based on current step state
  const isResumeUploadFlow = currentStepState?.type === SpreadsheetImportStepType.uploadResumes ||
    (currentStepState?.type === SpreadsheetImportStepType.upload && 
     'files' in currentStepState && 
     Array.isArray(currentStepState.files) &&
     currentStepState.files.some((file: File) => 
       file.type === 'application/pdf' || 
       file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
       file.type === 'application/msword' ||
       file.name.endsWith('.pdf') ||
       file.name.endsWith('.docx') ||
       file.name.endsWith('.doc')
     ));

  const { steps, initialStep } = useSpreadsheetImportInitialStep(
    currentStepState?.type || initialStepState?.type,
  );

  const { nextStep, prevStep, activeStep } = useStepBar({
    initialStep,
  });

  // Determine display steps based on current flow
  const displaySteps = isResumeUploadFlow 
    ? ['uploadStep', 'uploadResumesStep'] as const
    : steps;

  const handleStepStateChange = useCallback((stepState: SpreadsheetImportStep) => {
    setCurrentStepState(stepState);
  }, []);

  return (
    <>
      <StyledHeader>
        <StepBar activeStep={activeStep}>
          {displaySteps.map((key) => (
            <StepBar.Step
              activeStep={activeStep}
              label={stepTitles[key]}
              key={key}
            />
          ))}
        </StepBar>
      </StyledHeader>
      <SpreadsheetImportStepper 
        nextStep={nextStep} 
        prevStep={prevStep} 
        onStepStateChange={handleStepStateChange}
      />
    </>
  );
};
