import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { searchResultsState } from '@/candidate-search/states/searchResultsState';
import { dataTableRefreshFunctionState } from '@/candidate-table/states/dataTableRefreshFunctionState';
import { tableStateAtom } from '@/candidate-table/states/states';
import { contextStoreFiltersComponentState } from '@/context-store/states/contextStoreFiltersComponentState';
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { computeContextStoreFilters } from '@/context-store/utils/computeContextStoreFilters';
import { DEFAULT_QUERY_PAGE_SIZE } from '@/object-record/constants/DefaultQueryPageSize';
import { useLazyFetchAllRecords } from '@/object-record/hooks/useLazyFetchAllRecords';
import { useMoveCandidatesToJob } from '@/object-record/hooks/useMoveCandidatesToJob';
import { useFilterValueDependencies } from '@/object-record/record-filter/hooks/useFilterValueDependencies';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { useSetRecoilComponentStateV2 } from '@/ui/utilities/state/component-state/hooks/useSetRecoilComponentStateV2';
import styled from '@emotion/styled';
import { Trans } from '@lingui/react/macro';
import axios from 'axios';
import { useCallback, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRecoilValue } from 'recoil';

type JobListItem = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt?: string;
  searchName?: string;
};

const StyledJobPickerWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  width: 100%;
  text-align: left;
`;

const StyledSelect = styled.select`
  background: ${({ theme }) => theme.background.secondary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  box-sizing: border-box;
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
  padding: ${({ theme }) => theme.spacing(2)};
  width: 100%;
`;

const jobLabel = (job: JobListItem) =>
  job.searchName?.trim() || job.name?.trim() || job.id;

export const useMoveCandidatesToAnotherJobAction: ActionHookWithObjectMetadataItem =
  ({ objectMetadataItem }) => {
    const location = useLocation();
    const isJobRoute = location.pathname.includes('/job/');
    // eslint-disable-next-line @nx/workspace-matching-state-variable -- value is table row state; name differs from atom for clarity
    const tableState = useRecoilValue(tableStateAtom);
    const searchResults = useRecoilValue(searchResultsState);
    const { enqueueSnackBar } = useSnackBar();
    const tokenPair = useRecoilValue(tokenPairState);
    const dataTableRefreshFunction = useRecoilValue(
      dataTableRefreshFunctionState,
    );

    const contextStoreNumberOfSelectedRecords = useRecoilComponentValueV2(
      contextStoreNumberOfSelectedRecordsComponentState,
    );

    const setNumberOfSelectedRecords = useSetRecoilComponentStateV2(
      contextStoreNumberOfSelectedRecordsComponentState,
    );

    const setTargetedRecordsRule = useSetRecoilComponentStateV2(
      contextStoreTargetedRecordsRuleComponentState,
    );

    const contextStoreTargetedRecordsRule = useRecoilComponentValueV2(
      contextStoreTargetedRecordsRuleComponentState,
    );

    const contextStoreFilters = useRecoilComponentValueV2(
      contextStoreFiltersComponentState,
    );

    const { filterValueDependencies } = useFilterValueDependencies();

    const graphqlFilter = computeContextStoreFilters(
      contextStoreTargetedRecordsRule,
      contextStoreFilters,
      objectMetadataItem,
      filterValueDependencies,
    );

    const { fetchAllRecords: fetchAllRecordIds } = useLazyFetchAllRecords({
      objectNameSingular: objectMetadataItem.nameSingular,
      filter: graphqlFilter,
      limit: DEFAULT_QUERY_PAGE_SIZE,
    });

    const shouldBeRegistered = true;

    const numberOfSelectedRecords = isJobRoute
      ? (tableState?.selectedRowIds?.length ?? 0)
      : (contextStoreNumberOfSelectedRecords ?? 0);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [modalJobs, setModalJobs] = useState<JobListItem[]>([]);
    const [selectedJobId, setSelectedJobId] = useState('');
    const [pendingCandidateIds, setPendingCandidateIds] = useState<
      string[] | null
    >(null);

    const resetState = useCallback(() => {
      setIsProcessing(false);
      setPendingCandidateIds(null);
      setModalJobs([]);
      setSelectedJobId('');
      setNumberOfSelectedRecords(0);
      setTargetedRecordsRule({
        mode: 'selection',
        selectedRecordIds: [],
      });
    }, [setNumberOfSelectedRecords, setTargetedRecordsRule]);

    const { moveCandidatesToJob, loading } = useMoveCandidatesToJob({
      onSuccess: async (result) => {
        const failedPart =
          result.failed > 0 ? `, ${result.failed} could not be updated` : '';
        enqueueSnackBar(
          `Moved ${result.updated} candidate(s) to the selected job${failedPart}`,
          {
            variant:
              result.failed > 0
                ? SnackBarVariant.Warning
                : SnackBarVariant.Success,
            duration: 5000,
          },
        );
        setIsModalOpen(false);
        resetState();
        if (dataTableRefreshFunction != null) {
          try {
            await dataTableRefreshFunction();
          } catch {
            enqueueSnackBar(
              'Candidates were updated but the table could not refresh automatically.',
              {
                variant: SnackBarVariant.Warning,
                duration: 5000,
              },
            );
          }
        }
      },
      onError: (error) => {
        enqueueSnackBar(error.message, {
          variant: SnackBarVariant.Error,
          duration: 5000,
        });
        setIsProcessing(false);
      },
    });

    const fetchJobsForModal = useCallback(async (): Promise<JobListItem[]> => {
      const response = await axios.post(
        `${process.env.REACT_APP_SERVER_BASE_URL}/candidate-sourcing/get-all-jobs`,
        {},
        {
          headers: {
            Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
          },
        },
      );
      const raw = response?.data?.jobs as
        | Array<{ node: JobListItem }>
        | undefined;
      if (!raw?.length) {
        return [];
      }
      return raw
        .map((e) => e.node)
        .sort((a, b) => {
          if (a?.isActive !== b?.isActive) {
            return b?.isActive ? -1 : 1;
          }
          return (
            new Date(b?.createdAt ?? 0).getTime() -
            new Date(a?.createdAt ?? 0).getTime()
          );
        });
    }, [tokenPair?.accessToken?.token]);

    const activeJobs = useMemo(
      () => modalJobs.filter((j) => j.isActive),
      [modalJobs],
    );
    const inactiveJobs = useMemo(
      () => modalJobs.filter((j) => !j.isActive),
      [modalJobs],
    );

    const validateAndGetCandidateIds = useCallback(async () => {
      let records;
      if (isJobRoute && tableState?.selectedRowIds?.length > 0) {
        const selectedIdsSet = new Set(tableState.selectedRowIds);
        const databaseCandidates = tableState.rawData.filter((record) =>
          selectedIdsSet.has(record.id),
        );
        const searchCandidates = searchResults.filter((record) => {
          const recordId = record?.id;
          const recordTempId = record?.tempId;
          return (
            (recordId && selectedIdsSet.has(recordId)) ||
            (recordTempId && selectedIdsSet.has(recordTempId))
          );
        });
        records = [...databaseCandidates, ...searchCandidates];
      } else {
        records = await fetchAllRecordIds();
      }

      if (!records || records.length === 0) {
        throw new Error('No candidates selected');
      }

      const candidateIds = [
        ...new Set(
          records
            .map((record) => {
              type RecordWithTemp = { tempId?: string; id?: string | null };
              const r = record as RecordWithTemp;
              return r.tempId || r.id;
            })
            .filter((id): id is string => id !== null && id !== undefined),
        ),
      ];

      if (candidateIds.length === 0) {
        throw new Error('No valid candidate ids for update');
      }

      return candidateIds;
    }, [isJobRoute, tableState, searchResults, fetchAllRecordIds]);

    const handleConfirm = useCallback(async () => {
      if (isProcessing || !pendingCandidateIds?.length || !selectedJobId) {
        return;
      }
      try {
        setIsProcessing(true);
        await moveCandidatesToJob(pendingCandidateIds, selectedJobId);
      } catch {
        setIsProcessing(false);
      }
    }, [isProcessing, pendingCandidateIds, selectedJobId, moveCandidatesToJob]);

    const onClick = useCallback(async () => {
      if (!shouldBeRegistered) {
        return;
      }
      if (isProcessing) {
        return;
      }
      try {
        setIsProcessing(true);
        const ids = await validateAndGetCandidateIds();
        const jobs = await fetchJobsForModal();
        if (jobs.length === 0) {
          enqueueSnackBar('No jobs are available to move candidates to.', {
            variant: SnackBarVariant.Warning,
            duration: 5000,
          });
          return;
        }
        setModalJobs(jobs);
        const active = jobs.filter((j) => j.isActive);
        const defaultId = active[0]?.id ?? jobs[0]?.id ?? '';
        setSelectedJobId(defaultId);
        setPendingCandidateIds(ids);
        setIsModalOpen(true);
      } catch (error) {
        enqueueSnackBar(
          error instanceof Error
            ? error.message
            : 'Error validating candidates',
          {
            variant: SnackBarVariant.Error,
            duration: 5000,
          },
        );
      } finally {
        setIsProcessing(false);
      }
    }, [
      shouldBeRegistered,
      isProcessing,
      validateAndGetCandidateIds,
      fetchJobsForModal,
      enqueueSnackBar,
    ]);

    const modalSubtitle = (
      <StyledJobPickerWrap>
        <span>
          <Trans>
            Choose the job to assign for {numberOfSelectedRecords} selected
            candidate(s). Their job link will be updated to this job.
          </Trans>
        </span>
        <StyledSelect
          value={selectedJobId}
          onChange={(e) => setSelectedJobId(e.target.value)}
          aria-label="Target job"
          disabled={modalJobs.length === 0}
        >
          {activeJobs.length > 0 && (
            <optgroup label="Active jobs">
              {activeJobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {jobLabel(job)}
                </option>
              ))}
            </optgroup>
          )}
          {inactiveJobs.length > 0 && (
            <optgroup label="Inactive jobs">
              {inactiveJobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {jobLabel(job)}
                </option>
              ))}
            </optgroup>
          )}
        </StyledSelect>
      </StyledJobPickerWrap>
    );

    const confirmationModal = (
      <ConfirmationModal
        isOpen={isModalOpen}
        setIsOpen={(open) => {
          setIsModalOpen(open);
          if (!open) {
            resetState();
          }
        }}
        title="Move candidates to another job"
        subtitle={modalSubtitle}
        onConfirmClick={handleConfirm}
        deleteButtonText="Move to job"
        confirmButtonAccent="blue"
        loading={isProcessing || loading}
      />
    );

    return {
      shouldBeRegistered,
      onClick,
      ConfirmationModal: confirmationModal,
      isLoading: isProcessing || loading,
    };
  };
