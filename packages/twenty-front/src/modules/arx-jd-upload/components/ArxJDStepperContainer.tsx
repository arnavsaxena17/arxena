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
}) => {
  const { activeStep, nextStep, prevStep } = useArxJDFormStepper();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Make sure parsedJD is not null when rendering the stepper
  if (!parsedJD) {
    return null;
  }

  // Get the available steps based on selected chat flow options - memoized to prevent recalculation
  const availableSteps = useMemo(() => {
    // Always start with Upload JD step
    const steps = [ArxJDFormStepType.UploadJD];

    // Only add other steps if we have a parsedJD (file uploaded)
    if (parsedJD !== null) {
      steps.push(ArxJDFormStepType.JobDetails);
      steps.push(ArxJDFormStepType.ChatConfiguration);

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
    if (isLastStep) {
      setIsSubmitting(true);
      onSubmit && onSubmit();
    } else {
      // Get the current step type
      const currentStepType = availableSteps[activeStep];

      // If we're on the chat configuration step, we need to determine the next step
      // based on the selected options
      if (currentStepType === ArxJDFormStepType.ChatConfiguration) {
        // Find the index of the next available step
        const nextStepIndex = activeStep + 1;

        // If there's a next step available, go to it
        if (nextStepIndex < availableSteps.length) {
          nextStep();
        } else {
          // If there's no next step, but we should have one based on the configuration,
          // update the available steps and then navigate
          if (
            parsedJD.chatFlow.order.videoInterview ||
            parsedJD.chatFlow.order.meetingScheduling
          ) {
            // Force a re-render to update the available steps
            setParsedJD({...parsedJD});
            // Then navigate to the next step
            nextStep();
          } else {
            // If no additional steps are selected, treat as last step
            setIsSubmitting(true);
            onSubmit && onSubmit();
          }
        }
      } else {
        // For other steps, just go to the next one
        nextStep();
      }
    }
  }, [activeStep, availableSteps, isLastStep, nextStep, onSubmit, parsedJD, setParsedJD]);

  // Handle back button action
  const handleBack = useCallback(() => {
    prevStep();
  }, [prevStep]);

  // Memoize the navigation component to prevent re-renders
  const navigationComponent = useMemo(() => {
    if (activeStep === 0 || isSubmitting) {
      return null;
    }
    
    return (
      <ArxJDStepNavigation
        onNext={handleNext}
        onBack={handleBack}
        nextLabel={isLastStep ? 'Finish' : 'Next'}
      />
    );
  }, [activeStep, handleBack, handleNext, isLastStep, isSubmitting]);

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
            <StyledLoadingMessage>Creating job process...</StyledLoadingMessage>
          </StyledLoadingContainer>
        ) : (
          <>
            <StyledHeader>
              <ArxJDStepBar activeStep={activeStep} parsedJD={parsedJD} />
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
              />
            </StyledContent>
          </>
        )}
      </StyledContainer>
    </ArxJDModalLayout>
  );
};
