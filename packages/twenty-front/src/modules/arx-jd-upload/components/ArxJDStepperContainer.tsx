import styled from '@emotion/styled';
import React, { useCallback, useMemo, useState } from 'react';
import { Loader } from 'twenty-ui';

import { useArxJDFormStepper } from '../hooks/useArxJDFormStepper';
import { ArxJDFormStepType } from '../states/arxJDFormStepperState';
import { FormComponentProps } from '../types/FormComponentProps';
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
  getRootProps?: () => Record<string, any>;
  getInputProps?: () => Record<string, any>;
  isDragActive?: boolean;
  isUploading?: boolean;
  error?: string | null;
  handleFileUpload?: (files: File[]) => Promise<void>;
  isOpen: boolean;
  onClose: () => void;
  title: string;
  onRecruiterInfoChange?: (recruiterDetails: RecruiterDetails) => void;
  isEditMode?: boolean;
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
  isOpen,
  onClose,
  title,
  onRecruiterInfoChange,
  isEditMode = false,
}) => {
  const { activeStep, nextStep, prevStep, setStep } = useArxJDFormStepper();
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Get the available steps based on selected chat flow options - memoized to prevent recalculation
  const availableSteps = useMemo(() => {
    // Always include the UploadJD step, regardless of edit mode
    // In edit mode, we'll show the current file with options to replace or remove it
    const steps = [ArxJDFormStepType.UploadJD];

    // Add job details and chat config steps
    steps.push(ArxJDFormStepType.JobDetails);
    steps.push(ArxJDFormStepType.ChatConfiguration);

    // Only proceed with other steps if we have a parsedJD
    if (parsedJD) {
      // Add VideoInterview step if selected
      if (parsedJD.chatFlow.order.videoInterview) {
        steps.push(ArxJDFormStepType.VideoInterview);
      }

      // Add MeetingScheduling step if selected
      if (parsedJD.chatFlow.order.meetingScheduling) {
        steps.push(ArxJDFormStepType.MeetingScheduling);
      }
    }

    return steps;
  }, [parsedJD]);

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
      nextStep();
    }
  }, [activeStep, isLastStep, nextStep, onSubmit]);

  // Handle back button action
  const handleBack = useCallback(() => {
    prevStep();
  }, [prevStep]);

  // Memoize the navigation component to prevent re-renders
  const navigationComponent = useMemo(() => {
    // Don't show navigation on first step (except in edit mode) or when submitting
    if ((activeStep === 0 && !isEditMode) || isSubmitting) {
      return null;
    }
    
    console.log('Creating navigation component for step:', activeStep, 'isLastStep:', isLastStep);
    
    return (
      <ArxJDStepNavigation
        onNext={() => {
          console.log('Next button clicked, calling handleNext');
          handleNext();
        }}
        onBack={() => {
          console.log('Back button clicked, calling handleBack');
          handleBack();
        }}
        nextLabel={isLastStep ? 'Finish' : 'Next'}
        disableBack={activeStep === 0} // Disable back button on first step in edit mode
      />
    );
  }, [activeStep, handleBack, handleNext, isLastStep, isSubmitting, isEditMode]);

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
              <ArxJDStepBar activeStep={activeStep} parsedJD={parsedJD} isEditMode={isEditMode} />
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
                onCancel={onCancel}
                onSubmit={onSubmit}
                onRecruiterInfoChange={onRecruiterInfoChange}
                isEditMode={isEditMode}
              />
            </StyledContent>
          </>
        )}
      </StyledContainer>
    </ArxJDModalLayout>
  );
};
