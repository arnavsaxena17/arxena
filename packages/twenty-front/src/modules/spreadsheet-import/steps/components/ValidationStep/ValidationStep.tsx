import { Heading } from '@/spreadsheet-import/components/Heading';
import { SpreadsheetImportTable } from '@/spreadsheet-import/components/SpreadsheetImportTable';
import { StepNavigationButton } from '@/spreadsheet-import/components/StepNavigationButton';
import { useSpreadsheetImportInternal } from '@/spreadsheet-import/hooks/useSpreadsheetImportInternal';
import { SpreadsheetImportStep } from '@/spreadsheet-import/steps/types/SpreadsheetImportStep';
import { SpreadsheetImportStepType } from '@/spreadsheet-import/steps/types/SpreadsheetImportStepType';
import {
  ImportValidationResult,
  ImportedStructuredRow,
} from '@/spreadsheet-import/types';
import {
  ColumnType,
  type Columns,
} from '@/spreadsheet-import/types/columnTypes';
import { addErrorsAndRunHooks } from '@/spreadsheet-import/utils/dataMutations';
import { DeduplicationStats } from '@/spreadsheet-import/utils/mergeWorkbooks';
import { isPhoneNumberField, isValidPhoneNumber } from '@/spreadsheet-import/utils/normalizeTableData';

import { useDialogManager } from '@/ui/feedback/dialog-manager/hooks/useDialogManager';
import { Modal } from '@/ui/layout/modal/components/Modal';
import styled from '@emotion/styled';
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
// @ts-expect-error Todo: remove usage of react-data-grid`
import { RowsChangeData } from 'react-data-grid';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { jobIdAtom, jobsState } from '@/candidate-table/states/states';
import { useRecoilState, useRecoilValue } from 'recoil';
import { isDefined } from 'twenty-shared';
import { Button, IconTrash, Toggle } from 'twenty-ui';
import { generateColumns } from './components/columns';
import { ImportedStructuredRowMetadata } from './types';

const twenty_server_mappings = [
  {
    domain: "http://localhost:5050",
    mapped_domain: "http://localhost:3000",
  },
  {
    domain: "https://arxena.com",
    mapped_domain: "https://app.arxena.com",
  },
];

const StyledContent = styled(Modal.Content)`
  padding-left: ${({ theme }) => theme.spacing(6)};
  padding-right: ${({ theme }) => theme.spacing(6)};
`;

const StyledToolbar = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.spacing(4)};
  margin-top: ${({ theme }) => theme.spacing(8)};
`;

const StyledStatsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-bottom: ${({ theme }) => theme.spacing(4)};
`;

const StyledStatsRow = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(4)};
`;

const StyledStatItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: ${({ theme }) => theme.spacing(2)};
  background-color: ${({ theme }) => theme.background.transparent.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  min-width: 80px;
`;

const StyledStatNumber = styled.div`
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledStatLabel = styled.div`
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.regular};
  color: ${({ theme }) => theme.font.color.secondary};
  text-align: center;
`;

const StyledErrorStatNumber = styled(StyledStatNumber)`
  color: ${({ theme }) => theme.color.red};
`;

const StyledValidStatNumber = styled(StyledStatNumber)`
  color: ${({ theme }) => theme.color.green};
`;

const StyledSummaryMessage = styled.div`
  padding: ${({ theme }) => theme.spacing(3)};
  background-color: ${({ theme }) => theme.background.transparent.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  margin-bottom: ${({ theme }) => theme.spacing(4)};
`;

const StyledSummaryText = styled.div`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
  text-align: center;
`;

const StyledErrorToggle = styled.div`
  align-items: center;
  display: flex;
  flex-direction: row;
`;

const StyledErrorToggleDescription = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.regular};
  margin-left: ${({ theme }) => theme.spacing(2)};
`;

const StyledScrollContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  height: 0px;
  width: 100%;
`;

const StyledNoRowsContainer = styled.div`
  display: flex;
  grid-column: 1/-1;
  justify-content: center;
  margin-top: ${({ theme }) => theme.spacing(8)};
`;

const StyledDeduplicationStats = styled.div`
  background-color: ${({ theme }) => theme.background.transparent.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  padding: ${({ theme }) => theme.spacing(4)};
  margin-bottom: ${({ theme }) => theme.spacing(4)};
`;

const StyledDeduplicationTitle = styled.div`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
`;

const StyledDeduplicationRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing(1)};
`;

const StyledDeduplicationLabel = styled.span`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledDeduplicationValue = styled.span`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledDeduplicationKey = styled.span`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.tertiary};
  font-style: italic;
`;

type ValidationStepProps<T extends string> = {
  initialData: ImportedStructuredRow<T>[];
  importedColumns: Columns<string>;
  file: File;
  onBack: () => void;
  setCurrentStepState: Dispatch<SetStateAction<SpreadsheetImportStep>>;
  deduplicationStats?: DeduplicationStats;
};

export const ValidationStep = <T extends string>({
  initialData,
  importedColumns,
  file,
  setCurrentStepState,
  onBack,
  deduplicationStats,
}: ValidationStepProps<T>) => {
  const { enqueueDialog } = useDialogManager();
  const { fields, onClose, onSubmit, rowHook, tableHook } =
    useSpreadsheetImportInternal<T>();

  // Add token pair state for API authorization
  const [tokenPair] = useRecoilState(tokenPairState);

  // Get current job state
  const [jobIdFromAtom] = useRecoilState(jobIdAtom);
  const jobs = useRecoilValue(jobsState);
  
  // Find current job from jobs state
  const currentJob = jobs.find(job => job.id === jobIdFromAtom);
  
  console.log('Current job from state:', currentJob);
  console.log('jobIdFromAtom in ValidationStep:', jobIdFromAtom);

  // With this more robust UUID detection:
const isValidUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

  // Create a function to process data with current job assignment
  const processDataWithCurrentJob = useCallback(
    (rowsToProcess: ImportedStructuredRow<T>[]) => {
      console.log('=== processDataWithCurrentJob called ===');
      console.log('Current job:', currentJob);
      console.log('Job ID from atom:', jobIdFromAtom);
      
      // First, filter out rows with invalid phone numbers
      const rowsWithValidPhoneNumbers = rowsToProcess.filter((row) => {
        // Check if this row has phone number fields (including country code fields)
        const phoneFields = [
          'Phone number (phones)', 
          'phoneNumber', 
          'PrimaryPhoneNumber', 
          'primaryPhoneNumber', 
          'phoneNumber PrimaryPhoneNumber',
          'Phone country code (phones)',
          'phoneCountryCode',
          'countryCode',
          'phoneCode'
        ];
        
        for (const phoneField of phoneFields) {
          if (row[phoneField as keyof typeof row] !== undefined) {
            const phoneValue = row[phoneField as keyof typeof row];
            // If phone number exists but is not valid, filter out this row
            if (phoneValue !== undefined && !isValidPhoneNumber(phoneValue)) {
              console.log('Filtering out row with invalid phone number:', phoneValue, 'for field:', phoneField);
              return false;
            }
          }
        }
        return true;
      });
      
      console.log('Rows before phone validation:', rowsToProcess.length);
      console.log('Rows after phone validation:', rowsWithValidPhoneNumbers.length);
      
      // If we have a current job, assign it to all rows
      if (isDefined(currentJob) && jobIdFromAtom !== 'job-id') {
        console.log('Assigning current job to all rows:', currentJob.name);
        
        const processedRows = rowsWithValidPhoneNumbers.map((row) => {
          // Skip processing if the row already has a job ID (looks like a UUID)
          if (isDefined((row as any).jobs) && typeof (row as any).jobs === 'string' && isValidUUID((row as any).jobs)) {
            console.log('Row already has a job ID:', (row as any).jobs);
            return row;
          }

          // Create a new row with the current job ID
          const updatedRow = {
            ...row,
            // Always update the 'jobs' field with the current job ID
            jobs: currentJob.id,
            // Add metadata about the job assignment
            __jobMatch: {
              originalName: 'Current Job',
              matchedName: currentJob.name,
              matchedId: currentJob.id,
              arxenaSiteId: currentJob.pathPosition || currentJob.id,
              mappedColumn: 'Current Job Assignment',
            },
          };

          return updatedRow;
        });

        return processedRows;
      }
      
      console.log('No current job available, returning original rows');
      return rowsWithValidPhoneNumbers;
    },
    [currentJob, jobIdFromAtom],
  );

  // Process initial data with current job assignment
  const processedInitialData = useMemo(() => {
    // Only process if we have a current job
    if (isDefined(currentJob) && jobIdFromAtom !== 'job-id') {
      console.log('Processing data with current job:', currentJob.name);
      return processDataWithCurrentJob(initialData);
    }
    console.log('Skipping job processing - no current job available:', { currentJob, jobIdFromAtom });
    return initialData;
  }, [initialData, currentJob, jobIdFromAtom, processDataWithCurrentJob]);
  
  
  // Now use the processed data for initial state
  const [data, setData] = useState<
    (ImportedStructuredRow<T> & ImportedStructuredRowMetadata)[]
  >(
    useMemo(
      () =>
        addErrorsAndRunHooks<T>(
          processedInitialData,
          fields,
          rowHook,
          tableHook,
        ),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [processedInitialData, fields, rowHook, tableHook],
    ),
  );
  const [selectedRows, setSelectedRows] = useState<
    ReadonlySet<number | string>
  >(new Set());
  const [filterByErrors, setFilterByErrors] = useState(false);
  const [showUnmatchedColumns, setShowUnmatchedColumns] = useState(false);

  const updateData = useCallback(
    (rows: typeof data) => {
      console.log('Updating data', rows);
      // Process the rows with current job assignment
      const processedRows = processDataWithCurrentJob(rows);
      console.log('Processed rows', processedRows);
      // Then add errors and run hooks
      setData(
        addErrorsAndRunHooks<T>(processedRows, fields, rowHook, tableHook),
      );
    },
    [setData, rowHook, tableHook, fields, processDataWithCurrentJob],
  );

  const deleteSelectedRows = () => {
    if (selectedRows.size > 0) {
      const newData = data.filter((value) => !selectedRows.has(value.__index));
      updateData(newData);
      setSelectedRows(new Set());
    }
  };

  const updateRow = useCallback(
    (
      rows: typeof data,
      changedData?: RowsChangeData<(typeof data)[number]>,
    ) => {
      console.log('Updating row', changedData);
      const changes = changedData?.indexes.reduce(
        (acc: any, index: any) => {
          const realIndex = data.findIndex(
            (value) => value.__index === rows[index].__index,
          );
          acc[realIndex] = rows[index];
          return acc;
        },
        {} as Record<number, (typeof data)[number]>,
      );
      const newData = Object.assign([], data, changes);
      updateData(newData);
    },
    [data, updateData],
  );

  const columns = useMemo(
    () =>
      generateColumns(fields)
        .map((column) => {
          let hasBeenImported =
            importedColumns.filter(
              (importColumn) =>
                (importColumn.type === ColumnType.matched &&
                  importColumn.value === column.key) ||
                (importColumn.type === ColumnType.matchedSelect &&
                  importColumn.value === column.key) ||
                (importColumn.type === ColumnType.matchedSelectOptions &&
                  importColumn.value === column.key) ||
                (importColumn.type === ColumnType.matchedCheckbox &&
                  importColumn.value === column.key) ||
                column.key === 'select-row' ||
                column.key === '__errors-column',
            ).length > 0;

          // Special check for Default Job Name column
          const hasDefaultJobNameColumn = importedColumns.some(
            importColumn => importColumn.header === 'Default Job Name'
          );

          // Find the mapped column header for this field
          const mappedColumnHeader = importedColumns.find(
            (importColumn) =>
              (importColumn.type === ColumnType.matched ||
                importColumn.type === ColumnType.matchedSelect ||
                importColumn.type === ColumnType.matchedSelectOptions ||
                importColumn.type === ColumnType.matchedCheckbox) &&
              importColumn.value === column.key,
          )?.header;

          console.log(`Column ${column.key} mapped to: ${mappedColumnHeader}`);

          // Add special rendering for job ID columns
          if (column.key === 'jobs') {
            // Set hasBeenImported to true if we have a Default Job Name column
            if (hasDefaultJobNameColumn) {
              hasBeenImported = true;
            }
            
            // Adjust key as needed
            const columnWithCustomRender = {
              ...column,
              renderCell: (props: any) => {
                const { row } = props;
                console.log('Rendering job cell for row:', row);

                // Check for job match metadata
                if (isDefined(row.__jobMatch)) {
                  console.log('Found job match metadata:', row.__jobMatch);
                  return (
                    <div>
                      <div>{row.__jobMatch.matchedId}</div>
                      <div style={{ fontSize: 'small', color: 'gray' }}>
                        Matched: {row.__jobMatch.matchedName}
                      </div>
                    </div>
                  );
                }

                // If the row has a jobs field that looks like a UUID (matched ID)
                if (
                  (row as any).jobs !== undefined &&
                  typeof (row as any).jobs === 'string' &&
                  isValidUUID((row as any).jobs)
                ) {
                  console.log('Found job ID in jobs field:', (row as any).jobs);
                  return (row as any).jobs;
                }

                // Check for Default Job Name column 
                if (
                  (row as any)['Default Job Name'] !== undefined &&
                  typeof (row as any)['Default Job Name'] === 'string'
                ) {
                  console.log('Found job in Default Job Name:', (row as any)['Default Job Name']);
                  return (row as any)['Default Job Name'];
                }

                if (
                  isDefined(mappedColumnHeader) &&
                  mappedColumnHeader !== column.key &&
                  row[mappedColumnHeader] !== undefined
                ) {
                  const jobValue = row[mappedColumnHeader];
                  console.log('Job value from mapped column:', jobValue);
                  return jobValue;
                }

                return row[column.key];
              },
              renderEditCell: (props: any) => {
                const { row } = props;

                if (
                  isDefined(row.__jobMatch) === true ||
                  ((row as any).jobs !== undefined &&
                    typeof (row as any).jobs === 'string' &&
                    isValidUUID((row as any).jobs)) ||
                  ((row as any)['Default Job Name'] !== undefined &&
                    typeof (row as any)['Default Job Name'] === 'string')
                ) {
                  return (
                    <div style={{ padding: '8px' }}>
                      {isDefined(row.__jobMatch)
                        ? row.__jobMatch.matchedId
                        : (row as any).jobs || (row as any)['Default Job Name']}
                    </div>
                  );
                }

                // Otherwise, use the default editor
                return props.defaultEditor;
              },
            };

            if (!hasBeenImported && !showUnmatchedColumns) return null;
            return columnWithCustomRender;
          }

          if (!hasBeenImported && !showUnmatchedColumns) return null;
          return column;
        })
        .filter(Boolean),
    [fields, importedColumns, showUnmatchedColumns, data],
  );

  const tableData = useMemo(() => {
    if (filterByErrors) {
      return data.filter((value) => {
        if (isDefined(value?.__errors)) {
          return Object.values(value.__errors)?.filter(
            (err) => err.level === 'error',
          ).length;
        }
        return false;
      });
    }
    return data;
  }, [data, filterByErrors]);

  // Calculate statistics for display
  const statistics = useMemo(() => {
    const totalRows = data.length;
    const validRows = data.filter((value) => {
      if (isDefined(value?.__errors)) {
        return !Object.values(value.__errors)?.filter(
          (err) => err.level === 'error',
        ).length;
      }
      return true;
    }).length;
    const errorRows = totalRows - validRows;
    
    // Count rows with job matches
    const rowsWithJobMatches = data.filter((value) => 
      isDefined((value as any).__jobMatch) || 
      ((value as any).jobs !== undefined && 
       typeof (value as any).jobs === 'string' && 
       isValidUUID((value as any).jobs))
    ).length;

    return {
      totalRows,
      validRows,
      errorRows,
      rowsWithJobMatches,
    };
  }, [data]);

  const rowKeyGetter = useCallback(
    (row: ImportedStructuredRow<T> & ImportedStructuredRowMetadata) =>
      row.__index,
    [],
  );

  // Modify the uploadCandidatesToArxena function to match the data structure from useSpreadsheetRecordImport
  const uploadCandidatesToArxena = async (candidates: any[]) => {
    try {
      const base_url =
        process.env.NODE_ENV === 'production'
          ? 'https://arxena.com'
          : 'http://localhost:5050';
      const twenty_server_base_url = twenty_server_mappings.filter((mapping) => mapping.domain === base_url)[0]?.mapped_domain; 
      // const url =
      const url = twenty_server_base_url;
      // const twenty_server_base_url = twenty_server_mappings.filter((mapping) => mapping.domain === base_url)[0]?.mapped_domain; 
        // process.env.NODE_ENV === 'production'
        //   ? 'https://arxena.com'
        //   : 'http://localhost:5050';

      console.log('Uploading to Arxena URL:', url);

      const popup_data: Record<string, any> = {};

      // Use current job from state
      let job = null;
      
      if (isDefined(currentJob) && jobIdFromAtom !== 'job-id') {
        job = {
          id: currentJob.id,
          name: currentJob.name,
          arxenaSiteId: currentJob.pathPosition || currentJob.id,
        };
        console.log('Using current job from state:', job);
      }

      const data_source = 'spreadsheet_import';
      popup_data['job_id'] = job?.arxenaSiteId;
      popup_data['job_name'] = job?.name;
      popup_data['twenty_job_id'] = job?.id;
      popup_data['job_data_source'] = data_source;
      
      // Debug logging
      console.log('Final job info for upload:', {
        job,
        jobIdFromAtom,
        currentJob,
        popup_data
      });
      // Make the API request to Arxena
      // const twenty_server_base_url = twenty_server_mappings.filter((mapping) => mapping.domain === base_url)[0]?.mapped_domain; 
      // const response = await fetch(url + '/upload_profiles', {
      const response = await fetch(twenty_server_base_url + '/candidate-sourcing/upload-profiles', {
      // const response = await fetch(url + '/upload_profiles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenPair?.accessToken?.token}` || '',
        },
        body: JSON.stringify({
          candidates,
          popup_data,
          data_source,
          job: job ? { id: job.id, name: job.name } : null,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseText = await response.text();
      if (!responseText) {
        return [];
      }

      const data = JSON.parse(responseText);
      console.log('Arxena upload successful:', data);
      return data;
    } catch (error) {
      console.error('Error uploading candidates to Arxena:', error);
      throw error;
    }
  };

  // Modify the submitData function to use the same data structure as useSpreadsheetRecordImport
  const submitData = async () => {
    const calculatedData = data.reduce(
      (acc, value) => {
        const { __index, __errors, ...values } = value;
        if (isDefined(__errors)) {
          for (const key in __errors) {
            if (__errors[key].level === 'error') {
              acc.invalidStructuredRows.push(
                values as unknown as ImportedStructuredRow<T>,
              );
              return acc;
            }
          }
        }
        acc.validStructuredRows.push(
          values as unknown as ImportedStructuredRow<T>,
        );
        return acc;
      },
      {
        validStructuredRows: [] as ImportedStructuredRow<T>[],
        invalidStructuredRows: [] as ImportedStructuredRow<T>[],
        allStructuredRows: data,
      } satisfies ImportValidationResult<T>,
    );

    // Check if this is a candidate import by looking for specific fields
    // const isCandidateImport = fields.some(
    //   (field) =>
    //     field.key === 'candidate' ||
    //     (typeof field.label === 'string' &&
    //       field.label.toLowerCase().includes('candidate')),
    // );

    const isCandidateImport =
      window.location.pathname.toLowerCase().includes('candidate') &&
      !window.location.pathname.toLowerCase().includes('jobcandidate') ||
      window.location.pathname.toLowerCase().includes('/job/');

    setCurrentStepState({
      type: SpreadsheetImportStepType.loading,
    });
    console.log('isCandidateImport', isCandidateImport);
    if (isCandidateImport) {
      try {
        console.log('Uploading candidates to Arxena:', data);
        const headers = Object.keys(data[0]).filter(
          (key) => !key.startsWith('__') && key !== '__jobMatch',
        );
        const candidatesForArxena = data.map((row) => {
          const cleanRow: Record<string, any> = {};
          headers.forEach((header) => {
            const value = (row as Record<string, any>)[header];
            
            // Special handling for phone number fields - only include if valid
            if (isPhoneNumberField(header)) {
              if (isValidPhoneNumber(value)) {
                cleanRow[header] = value;
              }
              // Skip invalid phone numbers
            } else {
              cleanRow[header] = value;
            }
          });
          if (isDefined((row as any).__jobMatch)) {
            const jobMatch = (row as any).__jobMatch;
            if (isDefined(jobMatch.matchedId)) {
              cleanRow['jobs'] = jobMatch.matchedId;
              cleanRow['Job Applied For'] = jobMatch.matchedName;
            }
          }
          return cleanRow;
        });
        console.log('Uploading candidates to Arxena:', candidatesForArxena);
        try {
          await uploadCandidatesToArxena(candidatesForArxena);
          onClose();
          return;
        } catch (error) {
          console.error('Error uploading to Arxena:', error);
          onClose();
          return;
        }
      } catch (error) {
        console.error('Error uploading to Arxena:', error);
      }
    }

    // Standard submission flow for non-candidate objects or if Arxena upload fails
    await onSubmit(calculatedData, file);
    onClose();
  };

  const onContinue = () => {
    const invalidData = data.find((value) => {
      if (isDefined(value?.__errors)) {
        return !!Object.values(value.__errors)?.filter(
          (err) => err.level === 'error',
        ).length;
      }
      return false;
    });
    if (!invalidData) {
      submitData();
    } else {
      enqueueDialog({
        title: 'Finish flow with errors',
        message:
          'There are still some rows that contain errors. Rows with errors will be ignored when submitting.',
        buttons: [
          { title: 'Cancel' },
          {
            title: 'Submit',
            variant: 'primary',
            onClick: submitData,
            role: 'confirm',
          },
        ],
      });
    }
  };

  // Add a ref to track if we've applied job matching
  // eslint-disable-next-line @nx/workspace-no-state-useref
  const jobMatchingAppliedRef = useRef(false);

  // Replace the problematic useMemo with useEffect
  useEffect(() => {
    if (
      data.length > 0 &&
      isDefined(currentJob) &&
      jobIdFromAtom !== 'job-id' &&
      !jobMatchingAppliedRef.current
    ) {
      console.log('Forcing update of data to apply current job assignment');
      jobMatchingAppliedRef.current = true;
      updateData(data);
    }
  }, [data, currentJob, jobIdFromAtom, updateData]);

  // Early return after all hooks are declared
  if (!currentJob || jobIdFromAtom === 'job-id') {
    return <div>Loading current job...</div>;
  }

  return (
    <>
      <StyledContent>
        <Heading
          title="Review your import"
          description="Correct the issues and fill the missing data."
        />
        
        {/* Statistics Display */}
        {/* <StyledStatsContainer>
          <StyledStatsRow>
            <StyledStatItem>
              <StyledStatNumber>{statistics.totalRows}</StyledStatNumber>
              <StyledStatLabel>Total Rows</StyledStatLabel>
            </StyledStatItem>
            <StyledStatItem>
              <StyledValidStatNumber>{statistics.validRows}</StyledValidStatNumber>
              <StyledStatLabel>Valid Rows</StyledStatLabel>
            </StyledStatItem>
            <StyledStatItem>
              <StyledErrorStatNumber>{statistics.errorRows}</StyledErrorStatNumber>
              <StyledStatLabel>Rows with Errors</StyledStatLabel>
            </StyledStatItem>
            <StyledStatItem>
              <StyledStatNumber>{statistics.rowsWithJobMatches}</StyledStatNumber>
              <StyledStatLabel>Job Matched</StyledStatLabel>
            </StyledStatItem>
          </StyledStatsRow>
        </StyledStatsContainer> */}

        {/* Summary Message */}
        <StyledSummaryMessage>
          <StyledSummaryText>
            {statistics.errorRows === 0 
              ? `✅ All ${statistics.totalRows} rows are ready for import`
              : `⚠️ ${statistics.validRows} of ${statistics.totalRows} rows are ready for import. ${statistics.errorRows} rows have errors that need to be fixed.`
            }
          </StyledSummaryText>
        </StyledSummaryMessage>

        {/* Deduplication Statistics */}
        {deduplicationStats && (
          <StyledDeduplicationStats>
            <StyledDeduplicationTitle>
              📊 File Merge & Deduplication Summary
            </StyledDeduplicationTitle>
            <StyledDeduplicationRow>
              <StyledDeduplicationLabel>Files uploaded:</StyledDeduplicationLabel>
              <StyledDeduplicationValue>{deduplicationStats.totalFiles}</StyledDeduplicationValue>
            </StyledDeduplicationRow>
            <StyledDeduplicationRow>
              <StyledDeduplicationLabel>Total candidates before deduplication:</StyledDeduplicationLabel>
              <StyledDeduplicationValue>{deduplicationStats.totalCandidates}</StyledDeduplicationValue>
            </StyledDeduplicationRow>
            <StyledDeduplicationRow>
              <StyledDeduplicationLabel>Unique candidates after deduplication:</StyledDeduplicationLabel>
              <StyledDeduplicationValue>{deduplicationStats.deduplicatedCandidates}</StyledDeduplicationValue>
            </StyledDeduplicationRow>
            {deduplicationStats.duplicatesRemoved > 0 && (
              <StyledDeduplicationRow>
                <StyledDeduplicationLabel>Duplicates removed:</StyledDeduplicationLabel>
                <StyledDeduplicationValue>{deduplicationStats.duplicatesRemoved}</StyledDeduplicationValue>
              </StyledDeduplicationRow>
            )}
            {deduplicationStats.deduplicationKey !== 'none' && (
              <StyledDeduplicationRow>
                <StyledDeduplicationLabel>Deduplication method:</StyledDeduplicationLabel>
                <StyledDeduplicationValue>
                  Based on {deduplicationStats.deduplicationKey}
                  <StyledDeduplicationKey>
                    {deduplicationStats.deduplicationKey === 'email' ? ' (email address)' : ' (phone number)'}
                  </StyledDeduplicationKey>
                </StyledDeduplicationValue>
              </StyledDeduplicationRow>
            )}
          </StyledDeduplicationStats>
        )}

        <StyledToolbar>
          <StyledErrorToggle>
            <Toggle
              value={filterByErrors}
              onChange={() => setFilterByErrors(!filterByErrors)}
            />
            <StyledErrorToggleDescription>
              Show only rows with errors
            </StyledErrorToggleDescription>
          </StyledErrorToggle>
          <StyledErrorToggle>
            <Toggle
              value={showUnmatchedColumns}
              onChange={() => setShowUnmatchedColumns(!showUnmatchedColumns)}
            />
            <StyledErrorToggleDescription>
              Show unmatched columns
            </StyledErrorToggleDescription>
          </StyledErrorToggle>
          <Button
            Icon={IconTrash}
            title="Remove"
            accent="danger"
            onClick={deleteSelectedRows}
            disabled={selectedRows.size === 0}
          />
        </StyledToolbar>
        <StyledScrollContainer>
          <SpreadsheetImportTable
            rowKeyGetter={rowKeyGetter}
            rows={tableData}
            onRowsChange={updateRow}
            columns={columns}
            selectedRows={selectedRows}
            onSelectedRowsChange={setSelectedRows as any} // TODO: replace 'any'
            components={{
              noRowsFallback: (
                <StyledNoRowsContainer>
                  {filterByErrors
                    ? 'No data containing errors'
                    : 'No data found'}
                </StyledNoRowsContainer>
              ),
            }}
          />
        </StyledScrollContainer>
      </StyledContent>
      <StepNavigationButton
        onClick={onContinue}
        onBack={onBack}
        title="Confirm"
      />
    </>
  );
};
