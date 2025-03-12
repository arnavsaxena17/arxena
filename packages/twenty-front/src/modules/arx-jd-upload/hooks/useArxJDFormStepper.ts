import { useCallback } from 'react';
import { useRecoilState } from 'recoil';
import {
  arxJDFormStepperState,
  ArxJDFormStepperState,
  ArxJDFormStepType,
} from '../states/arxJDFormStepperState';

// Default form steps, always including the first three
const DEFAULT_FORM_STEPS = [
  ArxJDFormStepType.UploadJD,
  ArxJDFormStepType.JobDetails,
  ArxJDFormStepType.ChatConfiguration,
  ArxJDFormStepType.VideoInterview,
  ArxJDFormStepType.MeetingScheduling,
];

export const useArxJDFormStepper = (initialStep = 0) => {
  const [{ activeStep }, setArxJDFormStepper] = useRecoilState(
    arxJDFormStepperState,
  );

  // We'll use the default steps for navigation logic
  // The actual available steps will be determined in the ArxJDFormStepper component
  // based on the parsedJD configuration
  const FORM_STEPS = DEFAULT_FORM_STEPS;

  const nextStep = useCallback(() => {
    setArxJDFormStepper((prev: ArxJDFormStepperState) => ({
      ...prev,
      activeStep: Math.min(prev.activeStep + 1, FORM_STEPS.length - 1),
    }));
  }, [setArxJDFormStepper]);

  const prevStep = useCallback(() => {
    setArxJDFormStepper((prev: ArxJDFormStepperState) => ({
      ...prev,
      activeStep: Math.max(prev.activeStep - 1, 0),
    }));
  }, [setArxJDFormStepper]);

  const setStep = useCallback(
    (step: number) => {
      setArxJDFormStepper((prev: ArxJDFormStepperState) => ({
        ...prev,
        activeStep: Math.max(0, Math.min(step, FORM_STEPS.length - 1)),
      }));
    },
    [setArxJDFormStepper],
  );

  const reset = useCallback(
    (stepToResetTo = initialStep) => {
      // Only update state if needed to avoid circular updates
      if (activeStep !== stepToResetTo) {
        setArxJDFormStepper((prev: ArxJDFormStepperState) => ({
          ...prev,
          activeStep: stepToResetTo,
        }));
      }
    },
    [activeStep, initialStep, setArxJDFormStepper],
  );

  // Calculate current step and total steps for display
  const currentStep = activeStep + 1;
  const totalSteps = FORM_STEPS.length;

  return {
    nextStep,
    prevStep,
    setStep,
    reset,
    activeStep,
    currentStep,
    totalSteps,
    availableSteps: FORM_STEPS,
    currentStepType: FORM_STEPS[activeStep],
    isFirstStep: activeStep === 0,
    isLastStep: activeStep === FORM_STEPS.length - 1,
  };
};
