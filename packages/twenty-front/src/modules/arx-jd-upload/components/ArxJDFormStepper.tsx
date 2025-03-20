import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import React, { useEffect, useRef } from 'react';

import { useArxJDFormStepper } from '../hooks/useArxJDFormStepper';
import { ArxJDFormStepType } from '../states/arxJDFormStepperState';
import { FormComponentProps } from '../types/FormComponentProps';
import { ArxJDStepHeading } from './ArxJDStepHeading';
import { ArxJDUploadStep } from './ArxJDUploadStep';
import { ChatFlowSection } from './ChatFlowSection';
import { ChatQuestionsSection } from './ChatQuestionsSection';
import { JobDetailsForm } from './JobDetailsForm';
import { MeetingSchedulingSection } from './MeetingSchedulingSection';
import { VideoQuestionsSection } from './VideoQuestionsSection';

const StyledStepContent = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
  overflow-y: auto;
  max-height: 100%;
`;

const StyledContentWrapper = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: ${({ theme }) => theme.spacing(4)};
`;

export type ArxJDFormStepperProps = FormComponentProps & {
  // Add dropzone props to handle file uploads
  getRootProps?: () => Record<string, any>;
  getInputProps?: () => Record<string, any>;
  isDragActive?: boolean;
  isUploading?: boolean;
  error?: string | null;
  handleFileUpload?: (files: File[]) => void;
  onCancel?: () => void;
  onSubmit?: () => void;
};

export const ArxJDFormStepper: React.FC<ArxJDFormStepperProps> = ({
  parsedJD,
  setParsedJD,
  getRootProps,
  getInputProps,
  isDragActive,
  isUploading = false,
  error = null,
  handleFileUpload,
  onCancel,
  onSubmit,
}) => {
  const theme = useTheme();
  const { activeStep, nextStep, prevStep, setStep, isFirstStep, isLastStep } =
    useArxJDFormStepper();

  // Generate the available steps based on selected chat flow options
  const getFormSteps = () => {
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

  // Get the actual steps based on the selected options
  const availableSteps = getFormSteps();

  // Adjust the step if needed (e.g., if a step was removed but we're on it)
  useEffect(() => {
    // Only check if parsedJD is not null
    if (parsedJD !== null) {
      const currentSteps = availableSteps;
      const currentStepType = currentSteps[activeStep];

      // If we're on a step that no longer exists, go to the last available step
      if (activeStep >= currentSteps.length) {
        setStep(currentSteps.length - 1);
      }
      // If we're on the VideoInterview step but it's not selected in the chat flow
      else if (
        currentStepType === ArxJDFormStepType.VideoInterview &&
        !parsedJD.chatFlow.order.videoInterview
      ) {
        // Go to the next available step or the last step
        const nextAvailableStep = currentSteps.findIndex(
          (step) =>
            step === ArxJDFormStepType.MeetingScheduling &&
            parsedJD.chatFlow.order.meetingScheduling,
        );

        if (nextAvailableStep !== -1) {
          setStep(nextAvailableStep);
        } else {
          // If no next step is available, go to the last valid step
          setStep(currentSteps.indexOf(ArxJDFormStepType.ChatConfiguration));
        }
      }
      // If we're on the MeetingScheduling step but it's not selected in the chat flow
      else if (
        currentStepType === ArxJDFormStepType.MeetingScheduling &&
        !parsedJD.chatFlow.order.meetingScheduling
      ) {
        // Go to the previous available step
        const prevAvailableStep = currentSteps.findIndex(
          (step) =>
            step === ArxJDFormStepType.VideoInterview &&
            parsedJD.chatFlow.order.videoInterview,
        );

        if (prevAvailableStep !== -1) {
          setStep(prevAvailableStep);
        } else {
          // If no previous step is available, go to the chat configuration step
          setStep(currentSteps.indexOf(ArxJDFormStepType.ChatConfiguration));
        }
      }
    }
  }, [parsedJD, activeStep, setStep, availableSteps]);

  // Automatically move to step 2 when parsedJD becomes available (after upload)
  // We use a ref to track if we've already auto-advanced, to prevent loops
  // eslint-disable-next-line @nx/workspace-no-state-useref
  const hasAutoAdvancedRef = useRef(false);

  useEffect(() => {
    // Only advance to next step if:
    // 1. We have a non-null parsedJD
    // 2. We're on the first step (Upload)
    // 3. We haven't already auto-advanced for this parsedJD
    if (parsedJD !== null && activeStep === 0 && !hasAutoAdvancedRef.current) {
      console.log(
        'Auto-advancing to job details step because parsedJD is available:',
        parsedJD,
      );
      // Mark that we've auto-advanced to prevent loops
      hasAutoAdvancedRef.current = true;
      // Advance to the next step
      nextStep();
    }

    // Reset the auto-advance flag when parsedJD becomes null again
    // This allows the auto-advance to work the next time a JD is uploaded
    if (parsedJD === null) {
      hasAutoAdvancedRef.current = false;
    }
  }, [parsedJD, activeStep, nextStep]);

  // Get current step info
  const currentStep = activeStep + 1;
  const totalSteps = availableSteps.length;
  const currentStepType = availableSteps[activeStep];

  // Handle step navigation
  const handleNext = () => {
    if (activeStep < availableSteps.length - 1) {
      nextStep();
    } else if (onSubmit !== undefined) {
      onSubmit();
    }
  };

  // Render the appropriate step content
  const renderStepContent = () => {
    switch (currentStepType) {
      case ArxJDFormStepType.UploadJD:
        return (
          <ArxJDUploadStep
            getRootProps={getRootProps || (() => ({}))}
            getInputProps={getInputProps || (() => ({}))}
            isDragActive={isDragActive || false}
            isUploading={isUploading}
            error={error}
            onNext={handleNext}
            canAdvance={parsedJD !== null}
          />
        );

      case ArxJDFormStepType.JobDetails:
        return (
          <StyledContentWrapper>
            <ArxJDStepHeading
              title="Job Details"
              description="Review and edit the job details"
              currentStep={currentStep}
              totalSteps={totalSteps}
            />
            <JobDetailsForm parsedJD={parsedJD} setParsedJD={setParsedJD} />
          </StyledContentWrapper>
        );

      case ArxJDFormStepType.ChatConfiguration:
        return (
          <StyledContentWrapper>
            <ArxJDStepHeading
              title="Chat Configuration"
              description="Configure the chat flow and questions"
              currentStep={currentStep}
              totalSteps={totalSteps}
            />
            <ChatFlowSection parsedJD={parsedJD} setParsedJD={setParsedJD} />
            <ChatQuestionsSection
              parsedJD={parsedJD}
              setParsedJD={setParsedJD}
            />
          </StyledContentWrapper>
        );

      case ArxJDFormStepType.VideoInterview:
        return (
          <StyledContentWrapper>
            <ArxJDStepHeading
              title="Video Interview"
              description="Configure video interview questions"
              currentStep={currentStep}
              totalSteps={totalSteps}
            />
            <VideoQuestionsSection
              parsedJD={parsedJD}
              setParsedJD={setParsedJD}
            />
          </StyledContentWrapper>
        );

      case ArxJDFormStepType.MeetingScheduling:
        return (
          <StyledContentWrapper>
            <ArxJDStepHeading
              title="Meeting Scheduling"
              description="Configure meeting scheduling options"
              currentStep={currentStep}
              totalSteps={totalSteps}
            />
            <MeetingSchedulingSection
              parsedJD={parsedJD}
              setParsedJD={setParsedJD}
            />
          </StyledContentWrapper>
        );

      default:
        return null;
    }
  };

  // Render navigation buttons separately from content
  const renderNavigation = () => {
    // We no longer need to render navigation here
    // as it's being handled by the ArxJDStepperContainer
    return null;
  };

  return (
    <StyledStepContent>
      {renderStepContent()}
      {renderNavigation()}
    </StyledStepContent>
  );
};
