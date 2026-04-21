import styled from '@emotion/styled';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { jobIdAtom, jobsState } from '@/candidate-table/states/states';
import { Heading } from '@/spreadsheet-import/components/Heading';
import { StepNavigationButton } from '@/spreadsheet-import/components/StepNavigationButton';
import { useSpreadsheetImportInternal } from '@/spreadsheet-import/hooks/useSpreadsheetImportInternal';
import {
    Field,
    ImportedRow,
    ImportedStructuredRow,
} from '@/spreadsheet-import/types';
import { findUnmatchedRequiredFields } from '@/spreadsheet-import/utils/findUnmatchedRequiredFields';
import { normalizeTableData } from '@/spreadsheet-import/utils/normalizeTableData';
import { setColumn } from '@/spreadsheet-import/utils/setColumn';
import { setIgnoreColumn } from '@/spreadsheet-import/utils/setIgnoreColumn';
import { setSubColumn } from '@/spreadsheet-import/utils/setSubColumn';
// import { matchSpreadsheetData } from '@/spreadsheet-import/utils/simpleMatchingUtility';
import { matchSpreadsheetData } from '@/spreadsheet-import/utils/simpleMatchingUtility';
import { useDialogManager } from '@/ui/feedback/dialog-manager/hooks/useDialogManager';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';

import { Modal } from '@/ui/layout/modal/components/Modal';

import { UnmatchColumn } from '@/spreadsheet-import/steps/components/MatchColumnsStep/components/UnmatchColumn';
import { initialComputedColumnsSelector } from '@/spreadsheet-import/steps/components/MatchColumnsStep/components/states/initialComputedColumnsState';
import type { MatchColumnsStepProps } from '@/spreadsheet-import/steps/types/matchColumnsStepProps';
import { SpreadsheetImportStepType } from '@/spreadsheet-import/steps/types/SpreadsheetImportStepType';
import {
  ColumnType,
  type Column,
  type Columns,
} from '@/spreadsheet-import/types/columnTypes';
import { ScrollWrapper } from '@/ui/utilities/scroll/components/ScrollWrapper';
import { useRecoilState, useRecoilValue } from 'recoil';
import { ColumnGrid } from './components/ColumnGrid';
import { TemplateColumn } from './components/TemplateColumn';
import { UserTableColumn } from './components/UserTableColumn';

const StyledContent = styled(Modal.Content)`
  align-items: center;
  padding-left: ${({ theme }) => theme.spacing(6)};
  padding-right: ${({ theme }) => theme.spacing(6)};
`;

const StyledColumnsContainer = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  margin-bottom: ${({ theme }) => theme.spacing(4)};
`;

const StyledColumns = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
`;

const StyledColumn = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.regular};
`;

export const MatchColumnsStep = <T extends string>({
  data,
  headerValues,
  onBack,
  setCurrentStepState,
  setPreviousStepState,
  currentStepState,
  nextStep,
  onError,
  deduplicationStats,
}: MatchColumnsStepProps) => {
  const { enqueueDialog } = useDialogManager();
  const { enqueueSnackBar } = useSnackBar();
  const dataExample = data.slice(0, 2);
  const { fields, autoMapHeaders, autoMapDistance } =
    useSpreadsheetImportInternal<T>();
  const [isLoading, setIsLoading] = useState(false);
  const [columns, setColumns] = useRecoilState(
    initialComputedColumnsSelector(headerValues),
  );
  const currentJobId = useRecoilValue(jobIdAtom);
  const jobs = useRecoilValue(jobsState);
  const currentJob = useMemo(() => jobs.find(job => job.id === currentJobId) || null, [jobs, currentJobId]);

  const { matchColumnsStepHook } = useSpreadsheetImportInternal();
console.log('columns in match columns step::', columns);
console.log('header values in match columns step::', headerValues);
console.log('data in match columns step::', data);
console.log('fields in match columns step::', fields);
console.log('auto map headers in match columns step::', autoMapHeaders);
console.log('auto map distance in match columns step::', autoMapDistance);
console.log('current job in match columns step::', currentJob);
console.log('current job id in match columns step::', currentJobId);
  const onIgnore = useCallback(
    (columnIndex: number) => {
      setColumns(
        columns.map((column, index) =>
          columnIndex === index ? setIgnoreColumn<string>(column) : column,
        ),
      );
    },
    [columns, setColumns],
  );

  const onRevertIgnore = useCallback(
    (columnIndex: number) => {
      setColumns(
        columns.map((column, index) =>
          columnIndex === index ? setColumn(column) : column,
        ),
      );
    },
    [columns, setColumns],
  );

  const onChange = useCallback(
    (value: T, columnIndex: number) => {
      if (value === 'do-not-import' || value === 'id') {
        if (columns[columnIndex].type === ColumnType.ignored) {
          onRevertIgnore(columnIndex);
        } else {
          onIgnore(columnIndex);
        }
      } else {
        const field = fields.find(
          (field) => field.key === value,
        ) as unknown as Field<T>;
        console.log('Fields fields index to set columns::', field);
        const existingFieldIndex = columns.findIndex(
          (column) => 'value' in column && column.value === field.key,
        );
        console.log('Existing fields index to set columns::', existingFieldIndex);
        setColumns(
          columns.map<Column<string>>((column, index) => {
            console.log('column, field data to set columns::', column, field, data);
            if (columnIndex === index) {
              return setColumn(column, field, data);
            } else if (index === existingFieldIndex) {
              enqueueSnackBar('Another column unselected', {
                detailedMessage: 'Columns cannot duplicate',
                variant: SnackBarVariant.Error,
              });
              return setColumn(column);
            } else {
              return column;
            }
          }),
        );
      }
    },
    [
      columns,
      onRevertIgnore,
      onIgnore,
      fields,
      setColumns,
      data,
      enqueueSnackBar,
    ],
  );

  const handleContinue = useCallback(
    async (
      values: ImportedStructuredRow<string>[],
      rawData: ImportedRow[],
      columns: Columns<string>,
    ) => {
      try {
        // Filter out any columns with value="id"
        const filteredColumns = columns.map(column => {
          if ('value' in column && column.value === 'id') {
            return setIgnoreColumn(column);
          }
          return column;
        });
        
        // Ensure the Default Job Name column is mapped to Jobs (ID) field
        const defaultJobNameColumnIndex = filteredColumns.findIndex(
          column => column.header === 'Default Job Name'
        );
        
        if (defaultJobNameColumnIndex !== -1) {
          const jobField = fields.find(
            field => field.key === 'jobs' || field.key === 'Jobs (ID)'
          ) as Field<T> | undefined;
          
          if (jobField && filteredColumns[defaultJobNameColumnIndex].type !== ColumnType.matched) {
            filteredColumns[defaultJobNameColumnIndex] = setColumn(
              filteredColumns[defaultJobNameColumnIndex],
              jobField,
              rawData
            );
          }
        }
        
        // Ensure values have the Default Job Name data
        if (defaultJobNameColumnIndex !== -1 && currentJob) {
          // Make sure each row has the Default Job Name value
          const updatedValues = values.map(row => {
            const newRow = { ...row };
            // Set both the jobs field and Default Job Name field
            (newRow as any)['jobs'] = `${currentJob.name || ''}`;
            (newRow as any)['Default Job Name'] = `${currentJob.name || ''}`;
            return newRow;
          });
          
          values = updatedValues;
        }
        
        const data = await matchColumnsStepHook(values, rawData, filteredColumns);
        setCurrentStepState({
          type: SpreadsheetImportStepType.validateData,
          data,
          importedColumns: filteredColumns,
          deduplicationStats,
        });
        setPreviousStepState(currentStepState);
        nextStep();
      } catch (e) {
        onError((e as Error).message);
      }
    },
    [
      onError,
      matchColumnsStepHook,
      nextStep,
      setPreviousStepState,
      setCurrentStepState,
      currentStepState,
      fields,
      currentJob,
    ],
  );

  const onSubChange = useCallback(
    (value: string, columnIndex: number, entry: string) => {
      setColumns(
        columns.map((column, index) =>
          columnIndex === index && 'matchedOptions' in column
            ? setSubColumn(column, entry, value)
            : column,
        ),
      );
    },
    [columns, setColumns],
  );
  console.log('fields', fields);
  const unmatchedRequiredFields = useMemo(
    () => findUnmatchedRequiredFields(fields, columns),
    [fields, columns],
  );

  const handleAlertOnContinue = useCallback(async () => {
    setIsLoading(true);
    await handleContinue(
      normalizeTableData(columns, data, fields),
      data,
      columns,
    );
    setIsLoading(false);
  }, [handleContinue, columns, data, fields]);

  const handleOnContinue = useCallback(async () => {
    console.log(
      'handleOnContinue unmatchedRequiredFields',
      unmatchedRequiredFields,
    );

    // Use simplified validation with the matching utility
    const result = matchSpreadsheetData(
      headerValues.filter(h => h !== undefined) as string[],
      fields,
      data,
      {
        autoMapDistance,
        customMappings: currentJob ? {
          'Default Job Name': 'jobTitle',
          'Job Name': 'jobTitle',
          'jobName': 'jobTitle'
        } : {},
        requiredFields: ['name'],
        validateData: true
      }
    );

    // Check for missing required fields
    const hasRequiredFields = result.summary.requiredFieldsMatched;
    const hasValidMatches = result.validation.isValid;

    if (!hasRequiredFields) {
      // Only show the actual required fields that are missing, not all unmatched columns
      const requiredFields = ['name',];
      const matchedFieldKeys = result.matches
        .filter((match: any) => match.match && match.isValid)
        .map((match: any) => match.match.fieldKey);
      
      const missingRequiredFields = requiredFields.filter(field => !matchedFieldKeys.includes(field));
      
      enqueueSnackBar(
        `Missing required fields: ${missingRequiredFields.join(', ')}`,
        {
          variant: SnackBarVariant.Error,
        },
      );
      return;
    }

    if (!hasValidMatches) {
      enqueueSnackBar(
        `Validation errors: ${result.validation.errors.join(', ')}`,
        {
          variant: SnackBarVariant.Error,
        },
      );
      return;
    }

    if (unmatchedRequiredFields.length > 0) {
      enqueueDialog({
        title: 'Not all columns matched',
        message:
          'There are required columns that are not matched or ignored. Do you want to continue?',
        children: (
          <StyledColumnsContainer>
            <StyledColumns>Columns not matched:</StyledColumns>
            {unmatchedRequiredFields.map((field) => (
              <StyledColumn key={field}>{field}</StyledColumn>
            ))}
          </StyledColumnsContainer>
        ),
        buttons: [
          { title: 'Cancel' },
          {
            title: 'Continue',
            onClick: handleAlertOnContinue,
            variant: 'primary',
            role: 'confirm',
          },
        ],
      });
    } else {
      setIsLoading(true);
      await handleContinue(
        normalizeTableData(columns, data, fields),
        data,
        columns,
      );
      setIsLoading(false);
    }
  }, [
    unmatchedRequiredFields,
    enqueueDialog,
    handleAlertOnContinue,
    handleContinue,
    columns,
    data,
    fields,
    enqueueSnackBar,
    currentJob,
    headerValues,
    autoMapDistance,
  ]);

  useEffect(() => {
    const isInitialColumnsState = columns.every(
      (column) => column.type === ColumnType.empty,
    );
    
    // Check if we've already added a Default Job Name column to avoid infinite loops
    const defaultJobNameColumnExists = columns.some(
      column => column.header === 'Default Job Name'
    );
    
    console.log('isInitialColumnsState', isInitialColumnsState);
    console.log('autoMapHeaders', autoMapHeaders);
    
    if (autoMapHeaders && isInitialColumnsState && !defaultJobNameColumnExists) {
      // Prepare headers and data - add Default Job Name if current job exists
      let processedHeaders = [...headerValues];
      let processedData = [...data];
      
      if (currentJob && !headerValues.includes('Default Job Name')) {
        processedHeaders = [...headerValues, 'Default Job Name'];
        processedData = data.map(row => [...row, `${currentJob.name || ''}`]);
      }
      
      // Use the simplified matching utility
      const result = matchSpreadsheetData(
        processedHeaders.filter(h => h !== undefined) as string[],
        fields,
        processedData,
        {
          autoMapDistance,
          customMappings: currentJob ? {
            'Default Job Name': 'jobTitle',
            'Job Name': 'jobTitle',
            'jobName': 'jobTitle',
            'companyName': 'jobCompanyName',
            'Company Name': 'jobCompanyName',
            'company': 'jobCompanyName'
          } : {
            'companyName': 'jobCompanyName',
            'Company Name': 'jobCompanyName',
            'company': 'jobCompanyName'
          },
          requiredFields: ['name', 'Email (email)', 'Phone number (phoneNumber)'],
          validateData: true
        }
      );
      
      // Convert matches to column format
      const newColumns: Column<string>[] = result.matches.map((match: any, index: number) => {
        const baseColumn: Column<string> = {
          type: ColumnType.empty,
          index,
          header: match.header
        };
        
        if (match.match && match.isValid) {
          const field = fields.find(f => f.key === match.match!.fieldKey);
          if (field) {
            return setColumn(baseColumn, field as Field<string>, processedData);
          }
        }
        
        return baseColumn;
      });
      
      // Auto-ignore any ID columns
      const processedColumns = newColumns.map(column => {
        if ('value' in column && column.value === 'id') {
          return setIgnoreColumn(column);
        }
        return column;
      });
      
      console.log('Simplified matching result:', {
        totalColumns: result.summary.totalColumns,
        matchedColumns: result.summary.matchedColumns,
        unmatchedColumns: result.summary.unmatchedColumns,
        validation: result.validation
      });
      
      setColumns(processedColumns);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMapHeaders, autoMapDistance]);

  return (
    <>
      <ScrollWrapper
        contextProviderName="modalContent"
        componentInstanceId="scroll-wrapper-modal-content"
        heightMode="full"
      >
        <StyledContent>
          <Heading
            title="Match Columns"
            description="Select the correct field for each column you'd like to import."
          />
          <ColumnGrid
            columns={columns}
            renderUserColumn={(columns, columnIndex) => (
              <UserTableColumn
                column={columns[columnIndex]}
                importedRow={dataExample.map(
                  (row) => row[columns[columnIndex].index],
                )}
              />
            )}
            renderTemplateColumn={(columns, columnIndex) => (
              <TemplateColumn
                columns={columns}
                columnIndex={columnIndex}
                onChange={onChange}
              />
            )}
            renderUnmatchedColumn={(columns, columnIndex) => (
              <UnmatchColumn
                columns={columns}
                columnIndex={columnIndex}
                onSubChange={onSubChange}
              />
            )}
          />
        </StyledContent>
      </ScrollWrapper>
      <StepNavigationButton
        onClick={handleOnContinue}
        isLoading={isLoading}
        title="Next Step"
        onBack={() => {
          onBack?.();
          setColumns([]);
        }}
      />
    </>
  );
};
