import { useCallback, useMemo, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { RecruiterDetails } from '../components/JobDetailsForm';
import { apiKeysState } from '../states/apiKeysState';
import {
  ArxJDFormStepperState,
  arxJDFormStepperState,
  ArxJDFormStepType,
} from '../states/arxJDFormStepperState';
import { ParsedJD } from '../types/ParsedJD';

// Base form steps in order; CandidateSearch will be conditionally included
const BASE_FORM_STEPS = [
  ArxJDFormStepType.UploadJD,
  ArxJDFormStepType.JobDetails,
  // ArxJDFormStepType.CandidateSearch,
  ArxJDFormStepType.ChatConfiguration,
  // ArxJDFormStepType.VideoInterview,
  // ArxJDFormStepType.MeetingScheduling,
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
  const apiKeys = useRecoilValue(apiKeysState);

  const hasLinkedInUnipileAccount = useMemo(() => {
    console.log('keys', apiKeys);
    const value = (apiKeys as any)?.linkedin_unipile_account_id;
    console.log('hasLinkedInUnipileAccount', value);
    return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
  }, [apiKeys]);

  // We'll use the default steps for navigation logic
  // The actual available steps will be determined in the ArxJDFormStepper component
  // based on the parsedJD configuration
  const FORM_STEPS = useMemo(() => {
    return BASE_FORM_STEPS.filter((step) => {
      if (step === ArxJDFormStepType.CandidateSearch) {
        return hasLinkedInUnipileAccount;
      }
      return true;
    });
  }, [hasLinkedInUnipileAccount]);

  console.log('FORM_STEPS', FORM_STEPS);
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

    console.log("Recrutier Details")
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
      const newActiveStep = Math.min(prev.activeStep + 1, FORM_STEPS.length - 1);
      console.log('Setting activeStep from', prev.activeStep, 'to', newActiveStep);
      return {
        ...prev,
        activeStep: newActiveStep,
      };
    });
  }, [activeStep, setArxJDFormStepper, FORM_STEPS.length]);

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
        activeStep: Math.max(0, Math.min(step, FORM_STEPS.length - 1)),
      }));
    },
    [setArxJDFormStepper, FORM_STEPS.length],
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
    availableSteps: FORM_STEPS,
    currentStepType: FORM_STEPS[activeStep],
    isFirstStep: activeStep === 0,
    isLastStep: activeStep === FORM_STEPS.length - 1,
    validationMessage,
  };
};
