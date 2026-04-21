import type { ImportedRow } from '@/spreadsheet-import/types/importedRow';
import type { SpreadsheetImportStep } from '@/spreadsheet-import/steps/types/SpreadsheetImportStep';
import type { DeduplicationStats } from '@/spreadsheet-import/utils/mergeWorkbooks';

export type MatchColumnsStepProps = {
  data: ImportedRow[];
  headerValues: ImportedRow;
  onBack?: () => void;
  setCurrentStepState: (currentStepState: SpreadsheetImportStep) => void;
  setPreviousStepState: (currentStepState: SpreadsheetImportStep) => void;
  currentStepState: SpreadsheetImportStep;
  nextStep: () => void;
  onError: (message: string) => void;
  deduplicationStats?: DeduplicationStats;
};
