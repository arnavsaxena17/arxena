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
];

export const useArxJDFormStepper = (initialStep = 0) => {
  const [{ activeStep }, setArxJDFormStepper] = useRecoilState(
    arxJDFormStepperState,
  );

  // For now, we'll use all steps until we integrate with parsedJD
  // This will be updated in the ArxJDFormStepper component
  const FORM_STEPS = [
    ...DEFAULT_FORM_STEPS,
    ArxJDFormStepType.VideoInterview,
    ArxJDFormStepType.MeetingScheduling,
  ];

  const nextStep = () => {
    setArxJDFormStepper((prev: ArxJDFormStepperState) => ({
      ...prev,
      activeStep: Math.min(prev.activeStep + 1, FORM_STEPS.length - 1),
    }));
  };

  const prevStep = () => {
    setArxJDFormStepper((prev: ArxJDFormStepperState) => ({
      ...prev,
      activeStep: Math.max(prev.activeStep - 1, 0),
    }));
  };

  const setStep = (step: number) => {
    setArxJDFormStepper((prev: ArxJDFormStepperState) => ({
      ...prev,
      activeStep: Math.max(0, Math.min(step, FORM_STEPS.length - 1)),
    }));
  };

  const reset = (stepToResetTo = initialStep) => {
    // Only update state if needed to avoid circular updates
    if (activeStep !== stepToResetTo) {
      setArxJDFormStepper((prev: ArxJDFormStepperState) => ({
        ...prev,
        activeStep: stepToResetTo,
      }));
    }
  };

  return {
    nextStep,
    prevStep,
    setStep,
    reset,
    activeStep,
    currentStepType: FORM_STEPS[activeStep],
    isFirstStep: activeStep === 0,
    isLastStep: activeStep === FORM_STEPS.length - 1,
  };
};
