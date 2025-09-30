import { SpreadsheetImportStepType } from '@/spreadsheet-import/steps/types/SpreadsheetImportStepType';
import { useMemo } from 'react';

export const useSpreadsheetImportInitialStep = (
  initialStep?: SpreadsheetImportStepType,
) => {
  // Check if we're in resume upload flow
  const isResumeUploadFlow = initialStep === SpreadsheetImportStepType.uploadResumes;
  
  const steps = isResumeUploadFlow 
    ? ['uploadStep', 'uploadResumesStep'] as const
    : ['uploadStep', 'selectFilesStep', 'matchColumnsStep', 'validationStep'] as const;

  const initialStepNumber = useMemo(() => {
    switch (initialStep) {
      case SpreadsheetImportStepType.upload:
        return 0;
      case SpreadsheetImportStepType.selectFiles:
        return isResumeUploadFlow ? 1 : 1;
      case SpreadsheetImportStepType.selectSheet:
        return 0;
      case SpreadsheetImportStepType.selectHeader:
        return 0;
      case SpreadsheetImportStepType.matchColumns:
        return isResumeUploadFlow ? 1 : 2;
      case SpreadsheetImportStepType.validateData:
        return isResumeUploadFlow ? 1 : 3;
      case SpreadsheetImportStepType.uploadResumes:
        return 1;
      default:
        return -1;
    }
  }, [initialStep, isResumeUploadFlow]);

  return { steps, initialStep: initialStepNumber };
};
