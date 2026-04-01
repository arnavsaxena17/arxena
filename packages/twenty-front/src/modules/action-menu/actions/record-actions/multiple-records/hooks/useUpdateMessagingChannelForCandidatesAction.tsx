import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { searchResultsState } from '@/candidate-search/states/searchResultsState';
import { MESSAGING_CHANNEL_VALUES_FOR_BULK_UPDATE } from '@/candidate-table/constants/messagingChannelValues';
import { tableStateAtom } from '@/candidate-table/states/states';
import { contextStoreFiltersComponentState } from '@/context-store/states/contextStoreFiltersComponentState';
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { computeContextStoreFilters } from '@/context-store/utils/computeContextStoreFilters';
import { DEFAULT_QUERY_PAGE_SIZE } from '@/object-record/constants/DefaultQueryPageSize';
import { useLazyFetchAllRecords } from '@/object-record/hooks/useLazyFetchAllRecords';
import { useUpdateCandidateMessagingChannels } from '@/object-record/hooks/useUpdateCandidateMessagingChannels';
import { useFilterValueDependencies } from '@/object-record/record-filter/hooks/useFilterValueDependencies';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { useSetRecoilComponentStateV2 } from '@/ui/utilities/state/component-state/hooks/useSetRecoilComponentStateV2';
import styled from '@emotion/styled';
import { Trans } from '@lingui/react/macro';
import { useCallback, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRecoilValue } from 'recoil';

const StyledChannelPickerWrap = styled.div`
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

const defaultChannel = MESSAGING_CHANNEL_VALUES_FOR_BULK_UPDATE[0];

export const useUpdateMessagingChannelForCandidatesAction: ActionHookWithObjectMetadataItem =
  ({ objectMetadataItem }) => {
    const location = useLocation();
    const isJobRoute = location.pathname.includes('/job/');
    // eslint-disable-next-line @nx/workspace-matching-state-variable -- value is table row state; name differs from atom for clarity
    const tableState = useRecoilValue(tableStateAtom);
    const searchResults = useRecoilValue(searchResultsState);
    const { enqueueSnackBar } = useSnackBar();

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
    const [selectedMessagingChannel, setSelectedMessagingChannel] =
      useState<string>(defaultChannel);
    const [pendingCandidateIds, setPendingCandidateIds] = useState<
      string[] | null
    >(null);

    const resetState = useCallback(() => {
      setIsProcessing(false);
      setPendingCandidateIds(null);
      setSelectedMessagingChannel(defaultChannel);
      setNumberOfSelectedRecords(0);
      setTargetedRecordsRule({
        mode: 'selection',
        selectedRecordIds: [],
      });
    }, [setNumberOfSelectedRecords, setTargetedRecordsRule]);

    const { updateMessagingChannels, loading } =
      useUpdateCandidateMessagingChannels({
        onSuccess: (result) => {
          const failedPart =
            result.failed > 0 ? `, ${result.failed} could not be updated` : '';
          enqueueSnackBar(
            `Updated messaging channel for ${result.updated} candidate(s)${failedPart}`,
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
        },
        onError: (error) => {
          enqueueSnackBar(error.message, {
            variant: SnackBarVariant.Error,
            duration: 5000,
          });
          setIsProcessing(false);
        },
      });

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
      if (isProcessing || !pendingCandidateIds?.length) {
        return;
      }
      try {
        setIsProcessing(true);
        await updateMessagingChannels(
          pendingCandidateIds,
          selectedMessagingChannel,
        );
      } catch {
        setIsProcessing(false);
      }
    }, [
      isProcessing,
      pendingCandidateIds,
      selectedMessagingChannel,
      updateMessagingChannels,
    ]);

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
        setPendingCandidateIds(ids);
        setSelectedMessagingChannel(defaultChannel);
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
      enqueueSnackBar,
    ]);

    const modalSubtitle = (
      <StyledChannelPickerWrap>
        <span>
          <Trans>
            Choose the messaging channel to set for {numberOfSelectedRecords}{' '}
            selected candidate(s).
          </Trans>
        </span>
        <StyledSelect
          value={selectedMessagingChannel}
          onChange={(e) => setSelectedMessagingChannel(e.target.value)}
          aria-label="Messaging channel"
        >
          {MESSAGING_CHANNEL_VALUES_FOR_BULK_UPDATE.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </StyledSelect>
      </StyledChannelPickerWrap>
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
        title="Update messaging channel"
        subtitle={modalSubtitle}
        onConfirmClick={handleConfirm}
        deleteButtonText="Update channel"
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
