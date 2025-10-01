import styled from '@emotion/styled';
import { useCallback, useState } from 'react';
import { WorkBook } from 'xlsx-ugnis';

import { Modal } from '@/ui/layout/modal/components/Modal';

import { useSpreadsheetImportInternal } from '@/spreadsheet-import/hooks/useSpreadsheetImportInternal';
import { SpreadsheetImportStep } from '@/spreadsheet-import/steps/types/SpreadsheetImportStep';
import { SpreadsheetImportStepType } from '@/spreadsheet-import/steps/types/SpreadsheetImportStepType';
import { exceedsMaxRecords } from '@/spreadsheet-import/utils/exceedsMaxRecords';
import { mapWorkbook } from '@/spreadsheet-import/utils/mapWorkbook';
import { shouldMergeFiles } from '@/spreadsheet-import/utils/mergeWorkbooks';
import { DropZone } from './components/DropZone';

const StyledContent = styled(Modal.Content)`
  padding: ${({ theme }) => theme.spacing(6)};
`;

type UploadStepProps = {
  setUploadedFiles: (files: File[]) => void;
  setCurrentStepState: (data: any) => void;
  onError: (message: string) => void;
  nextStep: () => void;
  setPreviousStepState: (data: any) => void;
  currentStepState: SpreadsheetImportStep;
};

export const UploadStep = ({
  setUploadedFiles,
  setCurrentStepState,
  onError,
  nextStep,
  setPreviousStepState,
  currentStepState,
}: UploadStepProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { maxRecords, uploadStepHook, selectHeaderStepHook, selectHeader } =
    useSpreadsheetImportInternal();

  const handleContinue = useCallback(
    async (workbooks: WorkBook[], files: File[]) => {
      setUploadedFiles(files);
      
      // Check if any files are resume files (pdf, doc, docx)
      const resumeFiles = files.filter(file => 
        file.type === 'application/pdf' || 
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.type === 'application/msword' ||
        file.name.endsWith('.pdf') ||
        file.name.endsWith('.docx') ||
        file.name.endsWith('.doc')
      );
      
      const spreadsheetFiles = files.filter(file => !resumeFiles.includes(file));
      
      // If we have resume files, go to resume upload step
      if (resumeFiles.length > 0) {
        setCurrentStepState({
          type: SpreadsheetImportStepType.uploadResumes,
          files: resumeFiles,
        });
        setPreviousStepState(currentStepState);
        nextStep();
        return;
      }
      
      // If multiple files and they should be merged, process them directly
      // Otherwise, go to file selection step
      if (files.length > 1) {
        if (shouldMergeFiles(files)) {
          // Files have been merged in DropZone, process the merged workbook
          const workbook = workbooks[0]; // Should be the merged workbook
          const isSingleSheet = workbook.SheetNames.length === 1;
          
          if (isSingleSheet) {
            if (
              maxRecords > 0 &&
              exceedsMaxRecords(workbook.Sheets[workbook.SheetNames[0]], maxRecords)
            ) {
              onError(`Too many records. Up to ${maxRecords.toString()} allowed`);
              return;
            }
            try {
              const mappedWorkbook = await uploadStepHook(mapWorkbook(workbook));

              if (selectHeader) {
                setCurrentStepState({
                  type: SpreadsheetImportStepType.selectHeader,
                  data: mappedWorkbook,
                  file: files[0], // Use first file as reference
                });
              } else {
                // Automatically select first row as header
                const trimmedData = mappedWorkbook.slice(1);

                const { importedRows: data, headerRow: headerValues } =
                  await selectHeaderStepHook(mappedWorkbook[0], trimmedData);

                setCurrentStepState({
                  type: SpreadsheetImportStepType.matchColumns,
                  data,
                  headerValues,
                  file: files[0], // Use first file as reference
                });
              }
            } catch (e) {
              onError((e as Error).message);
            }
          } else {
            setCurrentStepState({
              type: SpreadsheetImportStepType.selectSheet,
              workbook,
              file: files[0], // Use first file as reference
            });
          }
          setPreviousStepState(currentStepState);
          nextStep();
          return;
        } else {
          // Files should not be merged, go to file selection step
          setCurrentStepState({
            type: SpreadsheetImportStepType.selectFiles,
            files,
            workbooks,
          });
          setPreviousStepState(currentStepState);
          nextStep();
          return;
        }
      }

      // Single file processing (existing logic)
      const workbook = workbooks[0];
      const file = files[0];
      const isSingleSheet = workbook.SheetNames.length === 1;
      
      if (isSingleSheet) {
        if (
          maxRecords > 0 &&
          exceedsMaxRecords(workbook.Sheets[workbook.SheetNames[0]], maxRecords)
        ) {
          onError(`Too many records. Up to ${maxRecords.toString()} allowed`);
          return;
        }
        try {
          const mappedWorkbook = await uploadStepHook(mapWorkbook(workbook));

          if (selectHeader) {
            setCurrentStepState({
              type: SpreadsheetImportStepType.selectHeader,
              data: mappedWorkbook,
              file,
            });
          } else {
            // Automatically select first row as header
            const trimmedData = mappedWorkbook.slice(1);

            const { importedRows: data, headerRow: headerValues } =
              await selectHeaderStepHook(mappedWorkbook[0], trimmedData);

            setCurrentStepState({
              type: SpreadsheetImportStepType.matchColumns,
              data,
              headerValues,
              file,
            });
          }
        } catch (e) {
          onError((e as Error).message);
        }
      } else {
        setCurrentStepState({
          type: SpreadsheetImportStepType.selectSheet,
          workbook,
          file,
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
      setUploadedFiles,
      currentStepState,
      uploadStepHook,
    ],
  );

  const handleOnContinue = useCallback(
    async (workbooks: WorkBook[], files: File[]) => {
      setIsLoading(true);
      await handleContinue(workbooks, files);
      setIsLoading(false);
    },
    [handleContinue],
  );

  return (
    <StyledContent>
      <DropZone onContinue={handleOnContinue} isLoading={isLoading} />
    </StyledContent>
  );
};
