import styled from '@emotion/styled';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { jobIdAtom, jobsState } from '@/candidate-table/states';
import { Heading } from '@/spreadsheet-import/components/Heading';
import { StepNavigationButton } from '@/spreadsheet-import/components/StepNavigationButton';
import { useSpreadsheetImportInternal } from '@/spreadsheet-import/hooks/useSpreadsheetImportInternal';
import {
  Field,
  ImportedRow,
  ImportedStructuredRow,
} from '@/spreadsheet-import/types';
import { findUnmatchedRequiredFields } from '@/spreadsheet-import/utils/findUnmatchedRequiredFields';
import { getMatchedColumns } from '@/spreadsheet-import/utils/getMatchedColumns';
import { normalizeTableData } from '@/spreadsheet-import/utils/normalizeTableData';
import { setColumn } from '@/spreadsheet-import/utils/setColumn';
import { setIgnoreColumn } from '@/spreadsheet-import/utils/setIgnoreColumn';
import { setSubColumn } from '@/spreadsheet-import/utils/setSubColumn';
import { useDialogManager } from '@/ui/feedback/dialog-manager/hooks/useDialogManager';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';

import { Modal } from '@/ui/layout/modal/components/Modal';

import { UnmatchColumn } from '@/spreadsheet-import/steps/components/MatchColumnsStep/components/UnmatchColumn';
import { initialComputedColumnsSelector } from '@/spreadsheet-import/steps/components/MatchColumnsStep/components/states/initialComputedColumnsState';
import { SpreadsheetImportStep } from '@/spreadsheet-import/steps/types/SpreadsheetImportStep';
import { SpreadsheetImportStepType } from '@/spreadsheet-import/steps/types/SpreadsheetImportStepType';
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

export type MatchColumnsStepProps = {
  data: ImportedRow[];
  headerValues: ImportedRow;
  onBack?: () => void;
  setCurrentStepState: (currentStepState: SpreadsheetImportStep) => void;
  setPreviousStepState: (currentStepState: SpreadsheetImportStep) => void;
  currentStepState: SpreadsheetImportStep;
  nextStep: () => void;
  onError: (message: string) => void;
};

export enum ColumnType {
  empty,
  ignored,
  matched,
  matchedCheckbox,
  matchedSelect,
  matchedSelectOptions,
}

export type MatchedOptions<T> = {
  entry: string;
  value?: T;
};

type EmptyColumn = { type: ColumnType.empty; index: number; header: string };

type IgnoredColumn = {
  type: ColumnType.ignored;
  index: number;
  header: string;
};

type MatchedColumn<T> = {
  type: ColumnType.matched;
  index: number;
  header: string;
  value: T;
};

type MatchedSwitchColumn<T> = {
  type: ColumnType.matchedCheckbox;
  index: number;
  header: string;
  value: T;
};

export type MatchedSelectColumn<T> = {
  type: ColumnType.matchedSelect;
  index: number;
  header: string;
  value: T;
  matchedOptions: Partial<MatchedOptions<T>>[];
};

export type MatchedSelectOptionsColumn<T> = {
  type: ColumnType.matchedSelectOptions;
  index: number;
  header: string;
  value: T;
  matchedOptions: MatchedOptions<T>[];
};

export type Column<T extends string> =
  | EmptyColumn
  | IgnoredColumn
  | MatchedColumn<T>
  | MatchedSwitchColumn<T>
  | MatchedSelectColumn<T>
  | MatchedSelectOptionsColumn<T>;

export type Columns<T extends string> = Column<T>[];

export const MatchColumnsStep = <T extends string>({
  data,
  headerValues,
  onBack,
  setCurrentStepState,
  setPreviousStepState,
  currentStepState,
  nextStep,
  onError,
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
        console.log('Fields::', field);
        const existingFieldIndex = columns.findIndex(
          (column) => 'value' in column && column.value === field.key,
        );
        console.log('Existing fields index:', existingFieldIndex);
        setColumns(
          columns.map<Column<string>>((column, index) => {
            console.log('column, field data', column, field, data);
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

    // Check if Jobs (ID) and phone number columns are matched
    let hasJobsColumn = columns.some(
      (column) =>
        column.type !== ColumnType.empty &&
        column.type !== ColumnType.ignored &&
        'value' in column &&
        (column.value === 'Jobs (ID)' ||
          column.header === 'Jobs (ID)' ||
          column.value === 'jobs' ||
          column.header === 'jobs' ||
          column.header === 'Default Job Name'),
    );

    console.log('these are columns', columns);
    const hasPhoneNumberColumn = columns.some(
      (column) =>
        column.type !== ColumnType.empty &&
        column.type !== ColumnType.ignored &&
        'value' in column &&
        (column.value === 'Phone number (phoneNumber)' ||
          column.value === 'phoneNumber' ||
          column.value === 'PrimaryPhoneNumber' ||
          column.value === 'primaryPhoneNumber' ||
          column.header === 'Phone Number' ||
          column.header === 'phoneNumber PrimaryPhoneNumber' ||
          column.value === 'phoneNumber PrimaryPhoneNumber' ||
          column.header === 'Phone Number (phoneNumber)' ||
          column.header === 'Phone'),
    );

    // If we have a current job and no Jobs column, we can add a Default Job Name column
    if (!hasJobsColumn && currentJob) {
      // Add a new column for Default Job Name
      const newColumnIndex = columns.length;
      const newColumn: Column<string> = {
        type: ColumnType.empty,
        index: newColumnIndex,
        header: 'Default Job Name'
      };
      
      // Update data with default job values
      const newData = data.map(row => [...row, `${currentJob.name || ''}`]);
      
      // Find the Jobs field
      const jobField = fields.find(
        field => field.key === 'jobs' || field.key === 'Jobs (ID)'
      ) as Field<T> | undefined;
      
      if (jobField) {
        // Set the column to match with Jobs field
        const mappedColumn = setColumn(newColumn, jobField, newData);
        setColumns([...columns, mappedColumn]);
        hasJobsColumn = true;
      }
    }

    if (!hasJobsColumn || !hasPhoneNumberColumn) {
      const missingColumns = [];
      if (!hasJobsColumn) missingColumns.push('Jobs (ID)');
      if (!hasPhoneNumberColumn) missingColumns.push('Phone Number');

      enqueueSnackBar(
        `Missing required columns: ${missingColumns.join(', ')}`,
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
    setColumns,
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
    
    if (autoMapHeaders && isInitialColumnsState && !defaultJobNameColumnExists && currentJob) {
      // Create custom mappings for phone number field
      const customMappings: Record<string, string> = {
        'phoneNumber PrimaryPhoneNumber': 'Phone number (phoneNumber)'
      };
      
      // Create a new column for Default Job Name
      // Add column header to headerValues
      const newHeaderValues = [...headerValues, 'Default Job Name'];
      
      // Add default job name column to data
      const newData = data.map(row => [...row, `${currentJob.name || ''}`]);
      
      // Update header index for new column
      const newColumnIndex = headerValues.length;
      
      // Get matched columns including the new column
      const matchedColumns = getMatchedColumns(
        [...columns, {
          type: ColumnType.empty,
          index: newColumnIndex,
          header: 'Default Job Name'
        }],
        fields,
        newData,
        autoMapDistance,
        customMappings
      );
      
      // Auto-ignore any ID columns      
      const processedColumns = matchedColumns.map(column => {
        if ('value' in column && column.value === 'id') {
          return setIgnoreColumn(column);
        }
        return column;
      });
      
      console.log('matchedColumns with default job', processedColumns);
      setColumns(processedColumns);
    } else if (autoMapHeaders && isInitialColumnsState && !defaultJobNameColumnExists) {
      // No current job, just process normally
      const customMappings: Record<string, string> = {
        'phoneNumber PrimaryPhoneNumber': 'Phone number (phoneNumber)'
      };
      
      const matchedColumns = getMatchedColumns(
        columns,
        fields,
        data,
        autoMapDistance,
        customMappings
      );

      // Auto-ignore any ID columns      
      const processedColumns = matchedColumns.map(column => {
        if ('value' in column && column.value === 'id') {
          return setIgnoreColumn(column);
        }
        return column;
      });
      
      console.log('matchedColumns', processedColumns);
      setColumns(processedColumns);
    }
    
    // This part should run only once when defaultJobNameColumnExists is false
    if (currentJob && !defaultJobNameColumnExists) {
      // Find if there's a Jobs column already that we can set the value for
      const jobsColumnIndex = columns.findIndex(
        (column) => 
          column.type !== ColumnType.ignored && 
          (column.header === 'Jobs (ID)' || 
           column.header === 'jobs' || 
           column.header === 'Default Job Name' ||
           (column.type !== ColumnType.empty && 'value' in column && 
            (column.value === 'Jobs (ID)' || column.value === 'jobs')))
      );
      
      if (jobsColumnIndex !== -1) {
        // Jobs column exists, set the default value with the current job ID and name
        const jobsData = data.map(row => {
          const newRow = [...row];
          newRow[columns[jobsColumnIndex].index] = `${currentJob.name || ''}`;
          return newRow;
        });
        
        const jobField = fields.find(
          (field) => field.key === 'jobs' || field.key === 'Jobs (ID)'
        ) as Field<T> | undefined;
        
        if (jobField) {
          setColumns(
            columns.map((column, index) => 
              index === jobsColumnIndex ? setColumn(column, jobField, jobsData) : column
            )
          );
        }
      }
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
