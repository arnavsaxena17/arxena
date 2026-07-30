import { t } from '@lingui/core/macro';
import { useCallback, useState } from 'react';
import { type WorkBook } from 'xlsx-ugnis';

import { ModalContent } from 'twenty-ui/surfaces';

import { useComputeColumnSuggestionsAndAutoMatch } from '@/spreadsheet-import/hooks/useComputeColumnSuggestionsAndAutoMatch';
import { useSpreadsheetImportInternal } from '@/spreadsheet-import/hooks/useSpreadsheetImportInternal';
import { type SpreadsheetImportStep } from '@/spreadsheet-import/steps/types/SpreadsheetImportStep';
import { SpreadsheetImportStepType } from '@/spreadsheet-import/steps/types/SpreadsheetImportStepType';
import { isResumeUploadFile } from '@/spreadsheet-import/utils/arx/candidateSpreadsheetImport';
import { exceedsMaxRecords } from '@/spreadsheet-import/utils/exceedsMaxRecords';
import { mapWorkbook } from '@/spreadsheet-import/utils/mapWorkbook';
import { DropZone } from './components/DropZone';

type UploadStepProps = {
  setUploadedFile: (file: File) => void;
  setCurrentStepState: (data: any) => void;
  onError: (message: string) => void;
  nextStep: () => void;
  setPreviousStepState: (data: any) => void;
  currentStepState: SpreadsheetImportStep;
};

export const UploadStep = ({
  setUploadedFile,
  setCurrentStepState,
  onError,
  nextStep,
  setPreviousStepState,
  currentStepState,
}: UploadStepProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const {
    maxRecords,
    uploadStepHook,
    selectHeaderStepHook,
    selectHeader,
    enableUploadProgressSseWhileOpen,
  } = useSpreadsheetImportInternal();

  const computeColumnSuggestionsAndAutoMatch =
    useComputeColumnSuggestionsAndAutoMatch();

  const handleContinue = useCallback(
    async (workbook: WorkBook | null, files: File[]) => {
      const resumeFiles = files.filter(isResumeUploadFile);

      if (resumeFiles.length > 0 && enableUploadProgressSseWhileOpen === true) {
        setCurrentStepState({
          type: SpreadsheetImportStepType.uploadResumes,
          files: resumeFiles,
        });
        setPreviousStepState(currentStepState);
        nextStep();
        return;
      }

      if (!workbook || files.length === 0) {
        onError(t`No spreadsheet file found`);
        return;
      }

      const file = files[0];
      setUploadedFile(file);
      const isSingleSheet = workbook.SheetNames.length === 1;
      if (isSingleSheet) {
        if (
          maxRecords > 0 &&
          exceedsMaxRecords(workbook.Sheets[workbook.SheetNames[0]], maxRecords)
        ) {
          const maxRecordsString = maxRecords.toString();
          onError(t`Too many records. Up to ${maxRecordsString} allowed`);
          return;
        }
        try {
          const mappedWorkbook = await uploadStepHook(mapWorkbook(workbook));

          if (selectHeader) {
            setCurrentStepState({
              type: SpreadsheetImportStepType.selectHeader,
              data: mappedWorkbook,
            });
          } else {
            const trimmedData = mappedWorkbook.slice(1);

            const { importedRows: data, headerRow: headerValues } =
              await selectHeaderStepHook(mappedWorkbook[0], trimmedData);

            await computeColumnSuggestionsAndAutoMatch({
              headerValues,
              data,
            });

            setCurrentStepState({
              type: SpreadsheetImportStepType.matchColumns,
              data,
              headerValues,
            });
          }
        } catch (e) {
          onError((e as Error).message);
        }
      } else {
        setCurrentStepState({
          type: SpreadsheetImportStepType.selectSheet,
          workbook,
        });
      }
      setPreviousStepState(currentStepState);
      nextStep();
    },
    [
      onError,
      maxRecords,
      nextStep,
      selectHeader,
      selectHeaderStepHook,
      setPreviousStepState,
      setCurrentStepState,
      setUploadedFile,
      currentStepState,
      uploadStepHook,
      computeColumnSuggestionsAndAutoMatch,
      enableUploadProgressSseWhileOpen,
    ],
  );

  const handleOnContinue = useCallback(
    async (workbook: WorkBook | null, files: File[]) => {
      setIsLoading(true);
      await handleContinue(workbook, files);
      setIsLoading(false);
    },
    [handleContinue],
  );

  return (
    <ModalContent contentPadding={6}>
      <DropZone onContinue={handleOnContinue} isLoading={isLoading} />
    </ModalContent>
  );
};
