import { useCallback, useMemo, useState } from 'react';

import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';

import { RecruiterDetails } from '../components/ProjectDetailsForm';
import { apiKeysState } from '../states/apiKeysState';
import {
  ArxJDFormStepperState,
  arxJDFormStepperState,
  ArxJDFormStepType,
} from '../states/arxJDFormStepperState';
import { ParsedJD } from '../types/ParsedJD';

const BASE_FORM_STEPS = [
  ArxJDFormStepType.UploadJD,
  ArxJDFormStepType.JobDetails,
  ArxJDFormStepType.ChatConfiguration,
];

type ValidationResult = {
  isValid: boolean;
  message: string;
};

export const useArxJDFormStepper = (initialStep = 0) => {
  const [{ activeStep }, setArxJDFormStepper] = useAtomState(
    arxJDFormStepperState,
  );
  const [validationMessage, setValidationMessage] = useState<string>('');
  const apiKeys = useAtomStateValue(apiKeysState);

  const hasLinkedInUnipileAccount = useMemo(() => {
    console.log('keys', apiKeys);
    const value = (apiKeys as Record<string, unknown>)?.linkedin_unipile_account_id;
    console.log('hasLinkedInUnipileAccount', value);
    return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
  }, [apiKeys]);

  const FORM_STEPS = useMemo(() => {
    return BASE_FORM_STEPS.filter((step) => {
      if (step === ArxJDFormStepType.CandidateSearch) {
        return hasLinkedInUnipileAccount;
      }
      return true;
    });
  }, [hasLinkedInUnipileAccount]);

  console.log('FORM_STEPS', FORM_STEPS);
  const validateJobDetails = (
    parsedJD: ParsedJD | null,
    recruiterDetails: RecruiterDetails | null,
  ): ValidationResult => {
    if (!parsedJD) {
      return { isValid: false, message: 'Project details are missing' };
    }

    const missingFields: string[] = [];

    if (!parsedJD.name?.trim()) {
      missingFields.push('Job Title');
    }
    if (!parsedJD.description?.trim()) {
      missingFields.push('Short One Line Pitch');
    }

    if (missingFields.length > 0) {
      return {
        isValid: false,
        message: `Please fill in the following required fields: ${missingFields.join(', ')}`,
      };
    }

    return { isValid: true, message: '' };
  };

  const nextStep = useCallback(
    (
      parsedJD?: ParsedJD | null,
      recruiterDetails?: RecruiterDetails | null,
    ) => {
      console.log('nextStep called, current activeStep:', activeStep);

      if (activeStep === 1 && parsedJD && recruiterDetails) {
        const validation = validateJobDetails(parsedJD, recruiterDetails);
        if (!validation.isValid) {
          setValidationMessage(validation.message);
          return;
        }
      }

      setValidationMessage('');
      setArxJDFormStepper((prev: ArxJDFormStepperState) => {
        const newActiveStep = Math.min(
          prev.activeStep + 1,
          FORM_STEPS.length - 1,
        );
        console.log(
          'Setting activeStep from',
          prev.activeStep,
          'to',
          newActiveStep,
        );
        return {
          ...prev,
          activeStep: newActiveStep,
        };
      });
    },
    [activeStep, setArxJDFormStepper, FORM_STEPS.length],
  );

  const prevStep = useCallback(() => {
    console.log('prevStep called, current activeStep:', activeStep);
    setValidationMessage('');
    setArxJDFormStepper((prev: ArxJDFormStepperState) => {
      const newActiveStep = Math.max(prev.activeStep - 1, 0);
      console.log(
        'Setting activeStep from',
        prev.activeStep,
        'to',
        newActiveStep,
      );
      return {
        ...prev,
        activeStep: newActiveStep,
      };
    });
  }, [activeStep, setArxJDFormStepper]);

  const setStep = useCallback(
    (step: number) => {
      setValidationMessage('');
      setArxJDFormStepper((prev: ArxJDFormStepperState) => ({
        ...prev,
        activeStep: Math.max(0, Math.min(step, FORM_STEPS.length - 1)),
      }));
    },
    [setArxJDFormStepper, FORM_STEPS.length],
  );

  const reset = useCallback(
    (stepToResetTo = initialStep) => {
      if (activeStep !== stepToResetTo) {
        setValidationMessage('');
        setArxJDFormStepper((prev: ArxJDFormStepperState) => ({
          ...prev,
          activeStep: stepToResetTo,
        }));
      }
    },
    [activeStep, initialStep, setArxJDFormStepper],
  );

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
