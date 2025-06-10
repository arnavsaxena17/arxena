import { useCallback, useState } from 'react';
import { useRecoilState } from 'recoil';
import { RecruiterDetails } from '../components/JobDetailsForm';
import {
  ArxJDFormStepperState,
  arxJDFormStepperState,
  ArxJDFormStepType,
} from '../states/arxJDFormStepperState';
import { ParsedJD } from '../types/ParsedJD';

// Default form steps, always including the first three
const DEFAULT_FORM_STEPS = [
  ArxJDFormStepType.UploadJD,
  ArxJDFormStepType.JobDetails,
  ArxJDFormStepType.ChatConfiguration,
  ArxJDFormStepType.VideoInterview,
  ArxJDFormStepType.MeetingScheduling,
];

type ValidationResult = {
  isValid: boolean;
  message: string;
};

export const useArxJDFormStepper = (initialStep = 0) => {
  const [{ activeStep }, setArxJDFormStepper] = useRecoilState(
    arxJDFormStepperState,
  );
  const [validationMessage, setValidationMessage] = useState<string>('');

  // We'll use the default steps for navigation logic
  // The actual available steps will be determined in the ArxJDFormStepper component
  // based on the parsedJD configuration
  const FORM_STEPS = DEFAULT_FORM_STEPS;

  const validateJobDetails = (parsedJD: ParsedJD | null, recruiterDetails: RecruiterDetails | null): ValidationResult => {
    if (!parsedJD) {
      return { isValid: false, message: 'Job details are missing' };
    }

    const missingFields: string[] = [];

    // Check mandatory job fields
    if (!parsedJD.name?.trim()) {
      missingFields.push('Job Title');
    }
    if (!parsedJD.description?.trim()) {
      missingFields.push('Short One Line Pitch');
    }

    // Check recruiter fields if they are shown
    if (recruiterDetails?.showRecruiterFields) {
      if (!recruiterDetails.missingRecruiterInfo.phoneNumber?.trim()) {
        missingFields.push("Recruiter's Phone Number");
      }
      if (!recruiterDetails.missingRecruiterInfo.jobTitle?.trim()) {
        missingFields.push("Recruiter's Job Title");
      }
    }

    if (missingFields.length > 0) {
      return {
        isValid: false,
        message: `Please fill in the following required fields: ${missingFields.join(', ')}`,
      };
    }

    return { isValid: true, message: '' };
  };

  const nextStep = useCallback((parsedJD?: ParsedJD | null, recruiterDetails?: RecruiterDetails | null) => {
    console.log('nextStep called, current activeStep:', activeStep);

    // Only validate on the JobDetails step
    if (activeStep === 1 && parsedJD && recruiterDetails) {
      const validation = validateJobDetails(parsedJD, recruiterDetails);
      if (!validation.isValid) {
        setValidationMessage(validation.message);
        return;
      }
    }

    setValidationMessage(''); // Clear validation message on successful next step
    setArxJDFormStepper((prev: ArxJDFormStepperState) => {
      const newActiveStep = Math.min(prev.activeStep + 1, DEFAULT_FORM_STEPS.length - 1);
      console.log('Setting activeStep from', prev.activeStep, 'to', newActiveStep);
      return {
        ...prev,
        activeStep: newActiveStep,
      };
    });
  }, [activeStep, setArxJDFormStepper]);

  const prevStep = useCallback(() => {
    console.log('prevStep called, current activeStep:', activeStep);
    setValidationMessage(''); // Clear validation message when going back
    setArxJDFormStepper((prev: ArxJDFormStepperState) => {
      const newActiveStep = Math.max(prev.activeStep - 1, 0);
      console.log('Setting activeStep from', prev.activeStep, 'to', newActiveStep);
      return {
        ...prev,
        activeStep: newActiveStep,
      };
    });
  }, [activeStep, setArxJDFormStepper]);

  const setStep = useCallback(
    (step: number) => {
      setValidationMessage(''); // Clear validation message when setting step
      setArxJDFormStepper((prev: ArxJDFormStepperState) => ({
        ...prev,
        activeStep: Math.max(0, Math.min(step, DEFAULT_FORM_STEPS.length - 1)),
      }));
    },
    [setArxJDFormStepper],
  );

  const reset = useCallback(
    (stepToResetTo = initialStep) => {
      // Only update state if needed to avoid circular updates
      if (activeStep !== stepToResetTo) {
        setValidationMessage(''); // Clear validation message on reset
        setArxJDFormStepper((prev: ArxJDFormStepperState) => ({
          ...prev,
          activeStep: stepToResetTo,
        }));
      }
    },
    [activeStep, initialStep, setArxJDFormStepper],
  );

  // Calculate current step only - totalSteps should be determined by the component
  // based on the actual flow configuration
  const currentStep = activeStep + 1;

  return {
    nextStep,
    prevStep,
    setStep,
    reset,
    activeStep,
    currentStep,
    availableSteps: DEFAULT_FORM_STEPS,
    currentStepType: DEFAULT_FORM_STEPS[activeStep],
    isFirstStep: activeStep === 0,
    isLastStep: activeStep === DEFAULT_FORM_STEPS.length - 1,
    validationMessage,
  };
};
