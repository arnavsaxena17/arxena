import styled from '@emotion/styled';
import React from 'react';

import { useArxJDFormStepper } from '../hooks/useArxJDFormStepper';
import { ArxJDFormStepType } from '../states/arxJDFormStepperState';
import { FormComponentProps } from '../types/FormComponentProps';
import { ArxJDFormStepper } from './ArxJDFormStepper';
import { ArxJDModalLayout } from './ArxJDModalLayout';
import { ArxJDStepBar } from './ArxJDStepBar';
import { ArxJDStepNavigation } from './ArxJDStepNavigation';

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
}) => {
  const { activeStep, nextStep, prevStep } = useArxJDFormStepper();

  // Make sure parsedJD is not null when rendering the stepper
  if (!parsedJD) {
    return null;
  }

  // Get the available steps based on selected chat flow options
  const getAvailableSteps = () => {
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
  };

  const availableSteps = getAvailableSteps();
  const isLastStep = activeStep === availableSteps.length - 1;

  // Handle next button action
  const handleNext = () => {
    if (isLastStep) {
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
            setParsedJD({ ...parsedJD });
            // Then navigate to the next step
            nextStep();
          } else {
            // If no additional steps are selected, treat as last step
            onSubmit && onSubmit();
          }
        }
      } else {
        // For other steps, just go to the next one
        nextStep();
      }
    }
  };

  // Handle back button action
  const handleBack = () => {
    prevStep();
  };

  return (
    <ArxJDModalLayout
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      navigation={
        activeStep !== 0 && (
          <ArxJDStepNavigation
            onNext={handleNext}
            onBack={handleBack}
            nextLabel={isLastStep ? 'Finish' : 'Next'}
          />
        )
      }
    >
      <StyledContainer onClick={(e) => e.stopPropagation()}>
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
          />
        </StyledContent>
      </StyledContainer>
    </ArxJDModalLayout>
  );
};
