import { Heading } from '@/spreadsheet-import/components/Heading';
import { SpreadsheetImportTable } from '@/spreadsheet-import/components/SpreadsheetImportTable';
import { StepNavigationButton } from '@/spreadsheet-import/components/StepNavigationButton';
import { useSpreadsheetImportInternal } from '@/spreadsheet-import/hooks/useSpreadsheetImportInternal';
import {
  ColumnType,
  Columns,
} from '@/spreadsheet-import/steps/components/MatchColumnsStep/MatchColumnsStep';
import { SpreadsheetImportStep } from '@/spreadsheet-import/steps/types/SpreadsheetImportStep';
import { SpreadsheetImportStepType } from '@/spreadsheet-import/steps/types/SpreadsheetImportStepType';
import {
  ImportValidationResult,
  ImportedStructuredRow,
} from '@/spreadsheet-import/types';
import { addErrorsAndRunHooks } from '@/spreadsheet-import/utils/dataMutations';
import {
  findJobMatch,
  useFindAllJobs,
} from '@/spreadsheet-import/utils/findJobMatch';

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
import { useRecoilState } from 'recoil';
import { isDefined } from 'twenty-shared';
import { Button, IconTrash, Toggle } from 'twenty-ui';
import { generateColumns } from './components/columns';
import { ImportedStructuredRowMetadata } from './types';

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

type ValidationStepProps<T extends string> = {
  initialData: ImportedStructuredRow<T>[];
  importedColumns: Columns<string>;
  file: File;
  onBack: () => void;
  setCurrentStepState: Dispatch<SetStateAction<SpreadsheetImportStep>>;
};

export const ValidationStep = <T extends string>({
  initialData,
  importedColumns,
  file,
  setCurrentStepState,
  onBack,
}: ValidationStepProps<T>) => {
  const { enqueueDialog } = useDialogManager();
  const { fields, onClose, onSubmit, rowHook, tableHook } =
    useSpreadsheetImportInternal<T>();

  // Add token pair state for API authorization
  const [tokenPair] = useRecoilState(tokenPairState);

  // Fetch all jobs - we'll use this for matching
  const { jobs, loading: jobsLoading } = useFindAllJobs();

  console.log('Got job in validation step', jobs);

  // Create a function to process data with job matching
  const processDataWithJobMatching = useCallback(
    (rowsToProcess: ImportedStructuredRow<T>[]) => {
      // First check if there's a column mapped to Jobs (ID)
      const jobIdField = fields.find(
        (field) =>
          field.key === 'jobs' ||
          field.label === 'Jobs (ID)' ||
          field.key === 'jobs',
      );

      console.log('Job ID field', jobIdField);
      if (isDefined(jobIdField) && isDefined(jobs?.length)) {
        console.log('Jobs loaded', jobs);
        // Find which column was mapped to jobId in importedColumns
        const mappedJobColumn = importedColumns.find(
          (col) =>
            (col.type === ColumnType.matched ||
              col.type === ColumnType.matchedSelect ||
              col.type === ColumnType.matchedSelectOptions ||
              col.type === ColumnType.matchedCheckbox) &&
            col.value === jobIdField?.key,
        );

        const jobIdColumnHeader = mappedJobColumn?.header;

        // Add some debugging to see what's happening
        console.log('Jobs loaded:', jobs);
        console.log('Job ID field:', jobIdField);
        console.log('Mapped column:', jobIdColumnHeader);
        console.log('Full mapped column info:', mappedJobColumn);

        // Process each row to match job names with IDs
        const processedRows = rowsToProcess.map((row) => {
          // Skip processing if the row already has a job ID (looks like a UUID)
          if (
            isDefined((row as any).jobs) &&
            typeof (row as any).jobs === 'string' &&
            (row as any).jobs.includes('-') === true
          ) {
            console.log('Row already has a job ID:', (row as any).jobs);
            return row;
          }

          // Get the job name value - try both the mapped column header and the direct 'jobs' field
          let jobNameValue = null;

          if (
            isDefined(jobIdColumnHeader) &&
            row[jobIdColumnHeader as keyof typeof row] !== undefined
          ) {
            jobNameValue = row[jobIdColumnHeader as keyof typeof row];
            console.log(
              `Found job value in mapped column ${jobIdColumnHeader}:`,
              jobNameValue,
            );
          } else if ('jobs' in row) {
            jobNameValue = (row as any)['jobs'];
            console.log('Found job value in direct jobs field:', jobNameValue);
          }

          // Only process if we have a job name value
          if (isDefined(jobNameValue) && typeof jobNameValue === 'string') {
            console.log('Trying to match job:', jobNameValue);
            const matchedJob = findJobMatch(jobNameValue, jobs);
            console.log('Match result:', matchedJob);

            if (isDefined(matchedJob)) {
              // Create a new row with the matched job ID
              const updatedRow = {
                ...row,
                // Always update the 'jobs' field with the matched ID
                jobs: matchedJob.id,
                // Add metadata about the match
                __jobMatch: {
                  originalName: jobNameValue,
                  matchedName: matchedJob.name,
                  matchedId: matchedJob.id,
                  arxenaSiteId: matchedJob.arxenaSiteId,
                  mappedColumn: jobIdColumnHeader || 'jobs',
                },
              };

              // If there's a mapped column that's different from 'jobs', update that too
              if (
                isDefined(jobIdColumnHeader) &&
                jobIdColumnHeader !== 'jobs'
              ) {
                // Use type assertion to fix the type error
                (updatedRow as any)[jobIdColumnHeader] = matchedJob.id;
              }

              console.log('Updated row:', updatedRow);
              return updatedRow;
            }
          }
          return row;
        });

        return processedRows;
      }

      // Default behavior if no job matching is needed
      return rowsToProcess;
    },
    [fields, jobs, importedColumns],
  );

  // Process initial data with job matching if jobs are available
  const processedInitialData = useMemo(() => {
    if (!jobsLoading && isDefined(jobs) && jobs.length > 0) {
      return processDataWithJobMatching(initialData);
    }
    return initialData;
  }, [initialData, jobs, jobsLoading, processDataWithJobMatching]);

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
      // Process the rows with job matching
      const processedRows = processDataWithJobMatching(rows);
      // Then add errors and run hooks
      setData(
        addErrorsAndRunHooks<T>(processedRows, fields, rowHook, tableHook),
      );
    },
    [setData, rowHook, tableHook, fields, processDataWithJobMatching],
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
          const hasBeenImported =
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
                column.key === 'select-row',
            ).length > 0;

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
                  (row as any).jobs.includes('-') === true
                ) {
                  console.log('Found job ID in jobs field:', (row as any).jobs);
                  return (row as any).jobs;
                }

                // If we have a mapped column that's different from the standard key
                if (
                  isDefined(mappedColumnHeader) &&
                  mappedColumnHeader !== column.key &&
                  row[mappedColumnHeader] !== undefined
                ) {
                  // Try to get the value from the mapped column
                  const jobValue = row[mappedColumnHeader];
                  console.log('Job value from mapped column:', jobValue);
                  return jobValue;
                }

                // Default fallback
                return row[column.key];
              },
              // Override the editor to make it read-only when a match is found
              renderEditCell: (props: any) => {
                const { row } = props;

                // If we have a job match, make it read-only
                if (
                  isDefined(row.__jobMatch) === true ||
                  ((row as any).jobs !== undefined &&
                    typeof (row as any).jobs === 'string' &&
                    (row as any).jobs.includes('-') === true)
                ) {
                  // Return a read-only version of the cell
                  return (
                    <div style={{ padding: '8px' }}>
                      {isDefined(row.__jobMatch)
                        ? row.__jobMatch.matchedId
                        : (row as any).jobs}
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

  const rowKeyGetter = useCallback(
    (row: ImportedStructuredRow<T> & ImportedStructuredRowMetadata) =>
      row.__index,
    [],
  );

  // Modify the uploadCandidatesToArxena function to match the data structure from useSpreadsheetRecordImport
  const uploadCandidatesToArxena = async (candidates: any[]) => {
    try {
      const url =
        process.env.NODE_ENV === 'production'
          ? 'https://arxena.com/'
          : 'http://localhost:5050';

      console.log('Uploading to Arxena URL:', url);

      const popup_data: Record<string, any> = {};

      // Get job info from the first candidate if available
      const singleCandidate = candidates[0];
      let job = null;

      // Try to get job info from the candidate data
      if (isDefined(singleCandidate)) {
        // Check for job match info first
        if (isDefined(singleCandidate.jobMatchInfo)) {
          job = {
            id: singleCandidate.jobMatchInfo.matchedId,
            name: singleCandidate.jobMatchInfo.matchedName,
            arxenaSiteId: singleCandidate.jobMatchInfo.arxenaSiteId,
          };
        }
        // Then check for Job Applied For field
        else if (
          isDefined(singleCandidate['Job Applied For']) &&
          isDefined(jobs)
        ) {
          const jobAppliedFor = singleCandidate['Job Applied For'];
          // Use the findJobMatch function that's already available
          job = findJobMatch(jobAppliedFor, jobs);
        }
      }

      const data_source = 'spreadsheet_import_twenty';
      popup_data['job_id'] = job?.arxenaSiteId;
      popup_data['job_name'] = job?.name;
      popup_data['twenty_job_id'] = job?.id;
      popup_data['job_data_source'] = data_source;
      // Make the API request to Arxena
      const response = await fetch(
        process.env.REACT_APP_SERVER_BASE_URL + '/upload_profiles',
        {
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
        },
      );

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
      !window.location.pathname.toLowerCase().includes('jobcandidate');

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
            cleanRow[header] = (row as Record<string, any>)[header];
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

  // Add this function to debug the data structure
  // const debugData = useCallback(() => {
  //   if (data.length > 0) {
  //     console.log('First row data:', data[0]);
  //     console.log('Available columns in data:', Object.keys(data[0]));
  //     // Check if job match metadata exists
  //     if (isDefined((data[0] as any).__jobMatch)) {
  //       console.log('Job match metadata found:', (data[0] as any).__jobMatch);
  //     } else {
  //       console.log('No job match metadata found');
  //     }

  //     // Check for the job ID field
  //     const jobIdField = fields.find((field) => field.key === 'jobs');
  //     if (isDefined(jobIdField)) {
  //       console.log('Job ID field:', jobIdField);

  //       // Find the mapped column
  //       const mappedColumn = importedColumns.find(
  //         (col) =>
  //           (col.type === ColumnType.matched ||
  //             col.type === ColumnType.matchedSelect ||
  //             col.type === ColumnType.matchedSelectOptions ||
  //             col.type === ColumnType.matchedCheckbox) &&
  //           col.value === jobIdField.key,
  //       );

  //       if (isDefined(mappedColumn)) {
  //         console.log('Mapped column for jobs:', mappedColumn);
  //         console.log(
  //           'Value in first row:',
  //           data[0][mappedColumn.header as keyof (typeof data)[number]],
  //         );
  //       } else {
  //         console.log('No mapped column found for jobs');
  //       }
  //     }
  //   }
  // }, [data, fields, importedColumns]);

  // Add a ref to track if we've applied job matching
  // eslint-disable-next-line @nx/workspace-no-state-useref
  const jobMatchingAppliedRef = useRef(false);

  // Call this in useEffect or directly after data is set
  // useMemo(() => {
  //   if (data.length > 0) {
  //     debugData();
  //   }
  // }, [data, debugData]);

  // Replace the problematic useMemo with useEffect
  useEffect(() => {
    if (
      data.length > 0 &&
      !jobsLoading &&
      isDefined(jobs) &&
      jobs.length > 0 &&
      !jobMatchingAppliedRef.current
    ) {
      console.log('Forcing update of data to apply job matching');
      jobMatchingAppliedRef.current = true;
      updateData(data);
    }
  }, [data, jobs, jobsLoading, updateData]);

  return (
    <>
      <StyledContent>
        <Heading
          title="Review your import"
          description="Correct the issues and fill the missing data."
        />
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
