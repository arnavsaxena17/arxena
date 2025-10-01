import styled from '@emotion/styled';
import { useCallback, useState } from 'react';
import { WorkBook } from 'xlsx-ugnis';

import { Modal } from '@/ui/layout/modal/components/Modal';
import { MainButton } from 'twenty-ui';

import { useSpreadsheetImportInternal } from '@/spreadsheet-import/hooks/useSpreadsheetImportInternal';
import { SpreadsheetImportStep } from '@/spreadsheet-import/steps/types/SpreadsheetImportStep';
import { SpreadsheetImportStepType } from '@/spreadsheet-import/steps/types/SpreadsheetImportStepType';
import { exceedsMaxRecords } from '@/spreadsheet-import/utils/exceedsMaxRecords';
import { mapWorkbook } from '@/spreadsheet-import/utils/mapWorkbook';
import { mergeWorkbooks, shouldMergeFiles } from '@/spreadsheet-import/utils/mergeWorkbooks';

const StyledContent = styled(Modal.Content)`
  padding: ${({ theme }) => theme.spacing(6)};
`;

const StyledFileList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-bottom: ${({ theme }) => theme.spacing(4)};
`;

const StyledSelectAllContainer = styled.div`
  display: flex;
  align-items: center;
  padding: ${({ theme }) => theme.spacing(2)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.medium};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
`;

const StyledSelectAllLabel = styled.label`
  display: flex;
  align-items: center;
  cursor: pointer;
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledSelectAllCheckbox = styled.input`
  margin-right: ${({ theme }) => theme.spacing(2)};
`;

const StyledFileItem = styled.div<{ isSelected: boolean; isResumeFile: boolean }>`
  display: flex;
  align-items: center;
  padding: ${({ theme }) => theme.spacing(3)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme, isSelected }) => 
    isSelected ? theme.background.transparent.medium : theme.background.primary};
  cursor: pointer;
  transition: all 0.2s ease;
  border-left: 4px solid ${({ theme, isResumeFile }) => 
    isResumeFile ? theme.color.blue : theme.color.green};

  &:hover {
    background-color: ${({ theme }) => theme.background.transparent.light};
  }
`;

const StyledFileName = styled.span`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
  margin-left: ${({ theme }) => theme.spacing(2)};
`;

const StyledFileSize = styled.span`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.tertiary};
  margin-left: auto;
`;

const StyledFileType = styled.span`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.secondary};
  margin-left: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  background-color: ${({ theme }) => theme.background.transparent.light};
  border-radius: ${({ theme }) => theme.border.radius.xs};
`;

const StyledCheckbox = styled.input`
  margin-right: ${({ theme }) => theme.spacing(2)};
`;

const StyledButtonContainer = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  justify-content: flex-end;
`;

type SelectFilesStepProps = {
  files: File[];
  workbooks: WorkBook[];
  setCurrentStepState: (data: any) => void;
  onError: (message: string) => void;
  nextStep: () => void;
  setPreviousStepState: (data: any) => void;
  onBack: () => void;
  currentStepState: SpreadsheetImportStep;
};

export const SelectFilesStep = ({
  files,
  workbooks,
  setCurrentStepState,
  onError,
  nextStep,
  setPreviousStepState,
  onBack,
  currentStepState,
}: SelectFilesStepProps) => {
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  
  const { maxRecords, uploadStepHook, selectHeaderStepHook, selectHeader } =
    useSpreadsheetImportInternal();

  const toggleFileSelection = useCallback((index: number) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedFiles(prev => {
      // If all files are selected, deselect all; otherwise, select all
      if (prev.size === files.length) {
        return new Set();
      } else {
        return new Set(files.map((_, index) => index));
      }
    });
  }, [files.length]);

  const isAllSelected = selectedFiles.size === files.length;
  const isIndeterminate = selectedFiles.size > 0 && selectedFiles.size < files.length;

  const handleContinue = useCallback(
    async (fileIndex: number) => {
      const file = files[fileIndex];
      
      // Check if the file is a resume file
      const isResumeFile = file.type === 'application/pdf' || 
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.type === 'application/msword' ||
        file.name.endsWith('.pdf') ||
        file.name.endsWith('.docx') ||
        file.name.endsWith('.doc');
      
      if (isResumeFile) {
        // Route resume files to uploadResumes step
        setCurrentStepState({
          type: SpreadsheetImportStepType.uploadResumes,
          files: [file],
        });
        setPreviousStepState(currentStepState);
        nextStep();
        return;
      }
      
      // Process spreadsheet files
      const workbook = workbooks[fileIndex];
      const isSingleSheet = workbook.SheetNames.length === 1;
      
      if (isSingleSheet) {
        if (
          maxRecords > 0 &&
          exceedsMaxRecords(workbook.Sheets[workbook.SheetNames[0]], maxRecords)
        ) {
          onError(`Too many records in ${file.name}. Up to ${maxRecords.toString()} allowed`);
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
      files,
      workbooks,
      onError,
      maxRecords,
      nextStep,
      selectHeader,
      selectHeaderStepHook,
      setPreviousStepState,
      setCurrentStepState,
      currentStepState,
      uploadStepHook,
    ],
  );

  const handleProcessSelected = useCallback(async () => {
    if (selectedFiles.size === 0) {
      onError('Please select at least one file to process');
      return;
    }

    setIsLoading(true);
    try {
      const selectedFileIndices = Array.from(selectedFiles);
      const selectedFilesList = selectedFileIndices.map(index => files[index]);
      
      // Check if all selected files are resume files
      const resumeFiles = selectedFilesList.filter(file => 
        file.type === 'application/pdf' || 
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.type === 'application/msword' ||
        file.name.endsWith('.pdf') ||
        file.name.endsWith('.docx') ||
        file.name.endsWith('.doc')
      );
      
      if (resumeFiles.length === selectedFilesList.length) {
        // All selected files are resume files, go to uploadResumes step
        setCurrentStepState({
          type: SpreadsheetImportStepType.uploadResumes,
          files: resumeFiles,
        });
        setPreviousStepState(currentStepState);
        nextStep();
      } else if (shouldMergeFiles(selectedFilesList)) {
        // Selected files should be merged
        const selectedWorkbooks = selectedFileIndices.map(index => workbooks[index]);
        const mergedWorkbook = mergeWorkbooks(selectedWorkbooks, selectedFilesList);
        
        // Process the merged workbook
        const isSingleSheet = mergedWorkbook.SheetNames.length === 1;
        
        if (isSingleSheet) {
          if (
            maxRecords > 0 &&
            exceedsMaxRecords(mergedWorkbook.Sheets[mergedWorkbook.SheetNames[0]], maxRecords)
          ) {
            onError(`Too many records in merged data. Up to ${maxRecords.toString()} allowed`);
            return;
          }
          
          try {
            const mappedWorkbook = await uploadStepHook(mapWorkbook(mergedWorkbook));

            if (selectHeader) {
              setCurrentStepState({
                type: SpreadsheetImportStepType.selectHeader,
                data: mappedWorkbook,
                file: selectedFilesList[0], // Use first file as reference
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
                file: selectedFilesList[0], // Use first file as reference
              });
            }
          } catch (e) {
            onError((e as Error).message);
            return;
          }
        } else {
          setCurrentStepState({
            type: SpreadsheetImportStepType.selectSheet,
            workbook: mergedWorkbook,
            file: selectedFilesList[0], // Use first file as reference
          });
        }
        
        setPreviousStepState(currentStepState);
        nextStep();
      } else {
        // Process the first selected file (mixed or spreadsheet files)
        const firstSelectedIndex = selectedFileIndices[0];
        await handleContinue(firstSelectedIndex);
      }
    } finally {
      setIsLoading(false);
    }
  }, [
    selectedFiles, 
    files, 
    workbooks,
    setCurrentStepState, 
    currentStepState, 
    nextStep, 
    setPreviousStepState, 
    handleContinue, 
    onError,
    maxRecords,
    uploadStepHook,
    selectHeader,
    selectHeaderStepHook
  ]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileType = (file: File) => {
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) return 'Resume';
    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) return 'Resume';
    if (file.type === 'application/msword' || file.name.endsWith('.doc')) return 'Resume';
    if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.name.endsWith('.xlsx')) return 'Excel';
    if (file.type === 'application/vnd.ms-excel' || file.name.endsWith('.xls')) return 'Excel';
    if (file.type === 'text/csv' || file.name.endsWith('.csv')) return 'CSV';
    if (file.type === 'application/json' || file.name.endsWith('.json')) return 'JSON';
    return 'Unknown';
  };

  const isResumeFile = (file: File) => {
    return file.type === 'application/pdf' || 
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.type === 'application/msword' ||
      file.name.endsWith('.pdf') ||
      file.name.endsWith('.docx') ||
      file.name.endsWith('.doc');
  };

  const getButtonText = () => {
    if (selectedFiles.size === 0) return 'Process Selected Files';
    
    const selectedFileIndices = Array.from(selectedFiles);
    const selectedFilesList = selectedFileIndices.map(index => files[index]);
    const resumeFiles = selectedFilesList.filter(isResumeFile);
    
    if (resumeFiles.length === selectedFilesList.length) {
      return 'Upload Resumes';
    } else if (shouldMergeFiles(selectedFilesList)) {
      return 'Merge & Process Files';
    } else if (resumeFiles.length > 0) {
      return 'Process Files';
    } else {
      return 'Process Files';
    }
  };

  return (
    <StyledContent>
      <h3>Select Files to Process</h3>
      <p>Choose which files you want to import. Multiple spreadsheet files (.xlsx, .xls, .csv, .json) will be automatically merged into a single dataset.</p>
      
      <StyledSelectAllContainer>
        <StyledSelectAllLabel>
          <StyledSelectAllCheckbox
            type="checkbox"
            checked={isAllSelected}
            ref={(input) => {
              if (input) input.indeterminate = isIndeterminate;
            }}
            onChange={toggleSelectAll}
          />
          Select All ({selectedFiles.size}/{files.length})
        </StyledSelectAllLabel>
      </StyledSelectAllContainer>
      
      <StyledFileList>
        {files.map((file, index) => (
          <StyledFileItem
            key={index}
            isSelected={selectedFiles.has(index)}
            isResumeFile={isResumeFile(file)}
            onClick={() => toggleFileSelection(index)}
          >
            <StyledCheckbox
              type="checkbox"
              checked={selectedFiles.has(index)}
              onChange={() => toggleFileSelection(index)}
            />
            <StyledFileName>{file.name}</StyledFileName>
            <StyledFileType>{getFileType(file)}</StyledFileType>
            <StyledFileSize>{formatFileSize(file.size)}</StyledFileSize>
          </StyledFileItem>
        ))}
      </StyledFileList>

      <StyledButtonContainer>
        <MainButton
          onClick={onBack}
          title="Back"
          variant="secondary"
        />
        <MainButton
          onClick={handleProcessSelected}
          title={getButtonText()}
          disabled={selectedFiles.size === 0 || isLoading}
        />
      </StyledButtonContainer>
    </StyledContent>
  );
};
