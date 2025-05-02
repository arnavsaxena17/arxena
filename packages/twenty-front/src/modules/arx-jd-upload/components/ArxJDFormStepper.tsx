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
import { JobDetailsForm, RecruiterDetails } from './JobDetailsForm';
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
  onRecruiterInfoChange?: (recruiterDetails: RecruiterDetails) => void;
  isEditMode?: boolean;
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
  onRecruiterInfoChange,
  isEditMode = false,
}) => {
  const theme = useTheme();
  const { activeStep, nextStep, prevStep, setStep, availableSteps, currentStepType, isFirstStep, isLastStep } =
    useArxJDFormStepper();
  
  // For debugging
  console.log('ArxJDFormStepper rendering with activeStep:', activeStep, 'currentStepType:', currentStepType);
  
  // Generate the available steps based on selected chat flow options
  const getCustomFormSteps = () => {
    // Always include the upload step, regardless of edit mode
    // This ensures consistency with ArxJDStepBar and ArxJDStepperContainer
    const customSteps = [ArxJDFormStepType.UploadJD];
      
    if (parsedJD !== null) {
      customSteps.push(ArxJDFormStepType.JobDetails);
      customSteps.push(ArxJDFormStepType.ChatConfiguration);

      if (parsedJD.chatFlow.order.videoInterview) {
        customSteps.push(ArxJDFormStepType.VideoInterview);
      }

      if (parsedJD.chatFlow.order.meetingScheduling) {
        customSteps.push(ArxJDFormStepType.MeetingScheduling);
      }
    }
    return customSteps;
  };

  // Get the actual steps based on the selected options
  const customAvailableSteps = getCustomFormSteps();
  
  // Get current step info - for child components
  const currentStep = activeStep + 1;
  const totalSteps = customAvailableSteps.length;
  
  console.log('ArxJDFormStepper - customAvailableSteps:', customAvailableSteps, 'currentStep:', currentStep, 'totalSteps:', totalSteps);
  
  // Recalculate steps whenever chat flow order changes
  useEffect(() => {
    // This effect will re-execute when parsedJD or its chatFlow settings change
    // No need to do anything here, as customAvailableSteps will be recalculated
    // on every render
  }, [
    parsedJD?.chatFlow?.order?.videoInterview,
    parsedJD?.chatFlow?.order?.meetingScheduling
  ]);

  // Adjust the step if needed (e.g., if a step was removed but we're on it)
  useEffect(() => {
    // Only check if parsedJD is not null
    if (parsedJD !== null) {
      const currentSteps = customAvailableSteps;
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
  }, [parsedJD, activeStep, setStep, customAvailableSteps]);

  // Automatically move to step 2 when parsedJD becomes available (after upload)
  // We use a ref to track if we've already auto-advanced, to prevent loops
  // eslint-disable-next-line @nx/workspace-no-state-useref
  const hasAutoAdvancedRef = useRef(false);

  // Note: We're disabling auto-advancing here and will let the user 
  // manually navigate to the next step using the Continue button
  
  // Handle step navigation
  const handleNext = () => {
    if (activeStep < customAvailableSteps.length - 1) {
      nextStep();
    } else if (onSubmit !== undefined) {
      onSubmit();
    }
  };

  // Render the appropriate step content
  const renderStepContent = () => {
    // If we're in edit mode and no parsedJD yet, show loading
    if (isEditMode && !parsedJD) {
      return (
        <StyledContentWrapper>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            Loading job details...
          </div>
        </StyledContentWrapper>
      );
    }
    
    // For debugging
    console.log('Rendering step content for step:', activeStep, 'of type:', currentStepType);
    
    // Use activeStep to determine which component to render
    if (activeStep === 0) {
      return (
        <ArxJDUploadStep
          getRootProps={getRootProps || (() => ({}))}
          getInputProps={getInputProps || (() => ({}))}
          isDragActive={isDragActive || false}
          isUploading={isUploading}
          error={error}
          onNext={handleNext}
          canAdvance={parsedJD !== null && parsedJD.name !== ''}
          isEditMode={isEditMode}
          parsedJD={parsedJD}
          currentStep={currentStep}
          totalSteps={totalSteps}
          onRemoveFile={() => {
            // Handle file removal
            if (handleFileUpload) {
              // In edit mode, we can't set parsedJD to null, so create a blank one
              if (isEditMode && parsedJD) {
                // Create a blank version but preserve the ID and other essential properties
                const blankJD = {
                  ...parsedJD,
                  name: '',
                  description: '',
                  jobLocation: '',
                  salaryBracket: '',
                  specificCriteria: '',
                  pathPosition: '',
                  companyName: '',
                  companyDetails: '',
                  // Preserve ID and all chat flow configurations, videoInterview, and meetingScheduling settings
                };
                setParsedJD(blankJD);
              } else if (!isEditMode && onCancel) {
                // Only call onCancel (which closes the modal) in non-edit mode
                onCancel();
              }
            }
          }}
        />
      );
    }
    else if (activeStep === 1) {
      return (
        <StyledContentWrapper>
          <ArxJDStepHeading
            title="Job Details"
            description="Review and edit the job details"
            currentStep={currentStep}
            totalSteps={totalSteps}
          />
          <JobDetailsForm 
            parsedJD={parsedJD} 
            setParsedJD={setParsedJD} 
            onRecruiterInfoChange={onRecruiterInfoChange}
          />
        </StyledContentWrapper>
      );
    }
    else if (activeStep === 2) {
      return (
        <StyledContentWrapper>
          <ArxJDStepHeading
            title="Candidate Engagement Process"
            description="Configure the engagement process and screening questions"
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
    }
    else if (activeStep === 3) {
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
    }
    else if (activeStep === 4) {
      return (
        <StyledContentWrapper>
          <ArxJDStepHeading
            title="Scheduling"
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
    }

    return null;
  };

  return (
    <StyledStepContent>
      {renderStepContent()}
    </StyledStepContent>
  );
};