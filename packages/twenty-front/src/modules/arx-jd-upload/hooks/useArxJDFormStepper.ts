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
    console.log('nextStep called, current activeStep:', activeStep);
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
  };
};
