import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { searchResultsState } from '@/candidate-search/states/searchResultsState';
import { tableStateAtom } from '@/candidate-table/states/states';
import { contextStoreFiltersComponentState } from '@/context-store/states/contextStoreFiltersComponentState';
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { computeContextStoreFilters } from '@/context-store/utils/computeContextStoreFilters';
import { DEFAULT_QUERY_PAGE_SIZE } from '@/object-record/constants/DefaultQueryPageSize';
import { useLazyFetchAllRecords } from '@/object-record/hooks/useLazyFetchAllRecords';
import { useFilterValueDependencies } from '@/object-record/record-filter/hooks/useFilterValueDependencies';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { useSetRecoilComponentStateV2 } from '@/ui/utilities/state/component-state/hooks/useSetRecoilComponentStateV2';
import axios from 'axios';
import { useCallback, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRecoilValue } from 'recoil';

export const useStopChatWithCandidatesAction: ActionHookWithObjectMetadataItem =
  ({ objectMetadataItem }) => {
    const location = useLocation();
    const isJobRoute = location.pathname.includes('/job/');
    const tableState = useRecoilValue(tableStateAtom);
    const searchResults = useRecoilValue(searchResultsState);
    const tokenPair = useRecoilValue(tokenPairState);
    const { enqueueSnackBar } = useSnackBar();

    const contextStoreNumberOfSelectedRecords = useRecoilComponentValueV2(
      contextStoreNumberOfSelectedRecordsComponentState,
    );

    const setNumberOfSelectedRecords = useSetRecoilComponentStateV2(
      contextStoreNumberOfSelectedRecordsComponentState,
    );

    const contextStoreTargetedRecordsRule = useRecoilComponentValueV2(
      contextStoreTargetedRecordsRuleComponentState,
    );

    const setTargetedRecordsRule = useSetRecoilComponentStateV2(
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
    const [isStopChatWithCandidatesModalOpen, setIsStopChatWithCandidatesModalOpen] =
      useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const numberOfSelectedRecords = isJobRoute
      ? (tableState?.selectedRowIds?.length ?? 0)
      : (contextStoreNumberOfSelectedRecords ?? 0);

    const resetState = useCallback(() => {
      setIsProcessing(false);
      setNumberOfSelectedRecords(0);
      setTargetedRecordsRule({
        mode: 'selection',
        selectedRecordIds: [],
      });
    }, [setNumberOfSelectedRecords, setTargetedRecordsRule]);

    const validateAndGetRecordIds = useCallback(async () => {
      let recordsToStopChat;

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

        recordsToStopChat = [...databaseCandidates, ...searchCandidates];
      } else {
        recordsToStopChat = await fetchAllRecordIds();
      }

      if (!recordsToStopChat || recordsToStopChat.length === 0) {
        throw new Error('No candidates selected to stop chat with');
      }

      const recordIdsToStopChat = recordsToStopChat
        .map(
          (record) =>
            (record as { tempId?: string; id: string | null }).tempId ||
            record.id,
        )
        .filter((id): id is string => id !== null && id !== undefined);

      return recordIdsToStopChat;
    }, [isJobRoute, tableState, searchResults, fetchAllRecordIds]);

    const handleStopChatWithCandidatesClick = useCallback(async () => {
      if (isProcessing) {
        enqueueSnackBar('Stop chat operation is already in progress', {
          variant: SnackBarVariant.Warning,
          duration: 3000,
        });
        return;
      }

      try {
        setIsProcessing(true);
        const recordIdsToStopChat = await validateAndGetRecordIds();

        await Promise.all(
          recordIdsToStopChat.map((candidateId) =>
            axios.post(
              `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/stop-chat`,
              { candidateId },
              {
                headers: {
                  Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
                },
              },
            ),
          ),
        );

        enqueueSnackBar(
          `Chat stopped successfully for ${recordIdsToStopChat.length} candidate(s)`,
          {
            variant: SnackBarVariant.Success,
            duration: 5000,
          },
        );
        setIsStopChatWithCandidatesModalOpen(false);
        resetState();
      } catch (error) {
        console.error('Error stopping chats:', error);
        enqueueSnackBar(
          error instanceof Error ? error.message : 'Error stopping chats',
          {
            variant: SnackBarVariant.Error,
            duration: 5000,
          },
        );
      } finally {
        setIsProcessing(false);
      }
    }, [
      isProcessing,
      validateAndGetRecordIds,
      tokenPair?.accessToken?.token,
      enqueueSnackBar,
      resetState,
    ]);

    const onClick = useCallback(async () => {
      if (!shouldBeRegistered || isProcessing) {
        return;
      }

      try {
        setIsProcessing(true);
        await validateAndGetRecordIds();
        setIsStopChatWithCandidatesModalOpen(true);
      } catch (error) {
        console.error('Error validating candidates:', error);
        enqueueSnackBar(
          error instanceof Error ? error.message : 'Error validating candidates',
          {
            variant: SnackBarVariant.Error,
            duration: 5000,
          },
        );
      } finally {
        setIsProcessing(false);
      }
    }, [shouldBeRegistered, isProcessing, validateAndGetRecordIds, enqueueSnackBar]);

    const confirmationModal = (
      <ConfirmationModal
        isOpen={isStopChatWithCandidatesModalOpen}
        setIsOpen={(isOpen) => {
          setIsStopChatWithCandidatesModalOpen(isOpen);
          if (!isOpen) {
            resetState();
          }
        }}
        title={'Stop Chat'}
        subtitle={`Are you sure you want to stop chat with ${numberOfSelectedRecords} selected candidate(s)?`}
        onConfirmClick={handleStopChatWithCandidatesClick}
        deleteButtonText={'Stop Chat'}
        confirmButtonAccent="blue"
        loading={isProcessing}
      />
    );

    return {
      shouldBeRegistered,
      onClick,
      ConfirmationModal: confirmationModal,
      isLoading: isProcessing,
    };
  };
