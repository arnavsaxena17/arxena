import styled from '@emotion/styled';
import React, { useCallback, useMemo, useState } from 'react';
import { Loader } from 'twenty-ui';

import { AssistantThread } from '@/assistant/types/assistant.types';
import {
  LinkedInSearchCategory,
  LinkedInSearchType
} from 'twenty-shared';
import { useArxJDFormStepper } from '../hooks/useArxJDFormStepper';
import { FormComponentProps } from '../types/FormComponentProps';
import type { AssistantThreadSummary } from '../types/ParsedJD';
import { ArxJDFormStepper } from './ArxJDFormStepper';
import { ArxJDModalLayout } from './ArxJDModalLayout';
import { ArxJDStepBar } from './ArxJDStepBar';
import { ArxJDStepNavigation } from './ArxJDStepNavigation';
import { RecruiterDetails } from './JobDetailsForm';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  /* top:5vh; */
  height: 90%;
  width: 100%;
`;

const StyledHeader = styled.div`
  align-items: center;
  background-color: ${({ theme }) => theme.background.secondary};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.medium};
  display: flex;
  height: 60px;
  min-height: 60px;
  padding: 0px;
  padding-left: ${({ theme }) => theme.spacing(6)};
  padding-right: ${({ theme }) => theme.spacing(6)};
`;

const StyledContent = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
`;

const StyledLoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  width: 100%;
  gap: ${({ theme }) => theme.spacing(4)};
`;

const StyledLoadingMessage = styled.div`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.medium};
`;

export type ArxJDStepperContainerProps = FormComponentProps & {
  onCancel?: () => void;
  onSubmit?: () => void;
  showFooter?: boolean;
  getRootProps?: () => Record<string, unknown>;
  getInputProps?: () => Record<string, unknown>;
  isDragActive?: boolean;
  isUploading?: boolean;
  error?: string | null;
  handleFileUpload?: (files: File[]) => Promise<void>;
  handleFileRemoval?: () => Promise<void>;
  isOpen: boolean;
  onClose: () => void;
  title: string;
  onRecruiterInfoChange?: (recruiterDetails: RecruiterDetails) => void;
  isEditMode?: boolean;
  onCreateJobFromName?: (jobName: string) => Promise<void>;
  onAssistantThreadUpdate?: (
    assistantThread: AssistantThread,
    assistantThreads: AssistantThreadSummary[],
    searchType: LinkedInSearchType,
    searchCategory: LinkedInSearchCategory,
    generatedParameters: unknown,
    resolvedParameters: unknown,
  ) => Promise<void>;
};

export const ArxJDStepperContainer: React.FC<ArxJDStepperContainerProps> = ({
  parsedJD,
  setParsedJD,
  onCancel,
  onSubmit,
  getRootProps,
  getInputProps,
  isDragActive,
  isUploading,
  error,
  handleFileUpload,
  handleFileRemoval,
  isOpen,
  onClose,
  title,
  onRecruiterInfoChange,
  isEditMode = false,
  onCreateJobFromName,
  onAssistantThreadUpdate,
}) => {
  const { activeStep, nextStep, prevStep, setStep, validationMessage, currentStepType, availableSteps: hookAvailableSteps } = useArxJDFormStepper(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recruiterDetails, setRecruiterDetails] = useState<RecruiterDetails | null>(null);

  // In edit mode, if we're still loading job data, show a spinner
  // This is different from the upload case because we want to stay in the stepper UI
  if (isEditMode && !parsedJD && isUploading) {
    return (
      <ArxJDModalLayout
        isOpen={isOpen}
        onClose={onClose}
        title={title}
        navigation={null}
      >
        <StyledLoadingContainer>
          <Loader />
          <StyledLoadingMessage>Loading job details...</StyledLoadingMessage>
        </StyledLoadingContainer>
      </ArxJDModalLayout>
    );
  }

  // When not in edit mode and parsedJD is null, we shouldn't show the stepper
  if (!parsedJD && !isEditMode) {
    return null;
  }

  // Use the available steps from the hook, which already handles LinkedIn Unipile Account ID condition
  const availableSteps = hookAvailableSteps;

  const isLastStep = activeStep === availableSteps.length - 1;

  // Handle next button action
  const handleNext = useCallback(() => {
    console.log('handleNext called, activeStep:', activeStep, 'isLastStep:', isLastStep);
    
    if (isLastStep) {
      console.log('This is the last step, submitting');
      setIsSubmitting(true);
      onSubmit && onSubmit();
    } else {
      console.log('Moving to next step');
      nextStep(parsedJD, recruiterDetails);
    }
  }, [activeStep, isLastStep, nextStep, onSubmit, parsedJD, recruiterDetails]);

  const handleBack = useCallback(() => {
    prevStep();
  }, [prevStep]);

  const handleRecruiterInfoChange = useCallback((details: RecruiterDetails) => {
    setRecruiterDetails(details);
    onRecruiterInfoChange?.(details);
  }, [onRecruiterInfoChange]);

  const navigationComponent = useMemo(() => {
    if ((activeStep === 0 && !isEditMode) || isSubmitting) {
      return null;
    }

    // Don't render default navigation for candidate search step - it handles its own navigation
    // if (currentStepType === ArxJDFormStepType.CandidateSearch) {
    //   return null;
    // }

    return (
      <ArxJDStepNavigation
        onNext={() => {
          handleNext();
        }}
        onBack={() => {
          handleBack();
        }}
        nextLabel={isLastStep ? 'Finish' : 'Next'}
        disableBack={activeStep === 0}
        validationMessage={validationMessage}
      />
    );
  }, [activeStep, handleBack, handleNext, isLastStep, isSubmitting, isEditMode, validationMessage, currentStepType]);

  return (
    <ArxJDModalLayout
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      navigation={navigationComponent}
    >
      <StyledContainer onClick={(e) => e.stopPropagation()}>
        {isSubmitting ? (
          <StyledLoadingContainer>
            <Loader />
            <StyledLoadingMessage>
              {isEditMode ? 'Updating job...' : 'Creating job process...'}
            </StyledLoadingMessage>
          </StyledLoadingContainer>
        ) : (
          <>
            <StyledHeader>
              <ArxJDStepBar activeStep={activeStep} parsedJD={parsedJD} isEditMode={isEditMode} availableSteps={availableSteps} />
            </StyledHeader>
            <StyledContent>
              <ArxJDFormStepper
                parsedJD={parsedJD}
                setParsedJD={setParsedJD}
                getRootProps={getRootProps}
                getInputProps={getInputProps}
                isDragActive={isDragActive}
                isUploading={isUploading}
                error={error}
                handleFileUpload={handleFileUpload}
                handleFileRemoval={handleFileRemoval}
                onCancel={onCancel}
                onSubmit={onSubmit}
                onRecruiterInfoChange={handleRecruiterInfoChange}
                isEditMode={isEditMode}
                onCreateJobFromName={onCreateJobFromName}
                onAssistantThreadUpdate={onAssistantThreadUpdate}
              />
            </StyledContent>
          </>
        )}
      </StyledContainer>
    </ArxJDModalLayout>
  );
};
