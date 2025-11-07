import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { tableStateAtom } from '@/candidate-table/states/states';
import { searchResultsState } from '@/candidate-search/states/searchResultsState';
import { contextStoreFiltersComponentState } from '@/context-store/states/contextStoreFiltersComponentState';
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { computeContextStoreFilters } from '@/context-store/utils/computeContextStoreFilters';
import { BACKEND_BATCH_REQUEST_MAX_COUNT } from '@/object-record/constants/BackendBatchRequestMaxCount';
import { DEFAULT_QUERY_PAGE_SIZE } from '@/object-record/constants/DefaultQueryPageSize';
import { useLazyFetchAllRecords } from '@/object-record/hooks/useLazyFetchAllRecords';
import { useSendCVsToClient } from '@/object-record/hooks/useSendCVsToClient';
import { useFilterValueDependencies } from '@/object-record/record-filter/hooks/useFilterValueDependencies';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { useCallback, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { isDefined } from 'twenty-shared';

export const useShareChatBasedShortlistAction: ActionHookWithObjectMetadataItem =
  ({ objectMetadataItem }) => {
    const { enqueueSnackBar } = useSnackBar();
    const tableState = useRecoilValue(tableStateAtom);
    const searchResults = useRecoilValue(searchResultsState);
    const contextStoreNumberOfSelectedRecords = useRecoilComponentValueV2(
      contextStoreNumberOfSelectedRecordsComponentState,
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
      recordGqlFields: { id: true },
    });

    const isRemoteObject = objectMetadataItem.isRemote;
    const shouldBeRegistered =
      !isRemoteObject &&
      isDefined(contextStoreNumberOfSelectedRecords) &&
      contextStoreNumberOfSelectedRecords < BACKEND_BATCH_REQUEST_MAX_COUNT &&
      contextStoreNumberOfSelectedRecords > 0;

    const [isShareChatBasedShortlistModalOpen, setIsShareChatBasedShortlistModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const { sendCVsToClient } = useSendCVsToClient();

    const resetState = useCallback(() => {
      setIsProcessing(false);
    }, []);

    const handleShareChatBasedShortlistClick = useCallback(async () => {
      console.log('handleShareChatBasedShortlistClick triggered');
      if (isProcessing) {
        enqueueSnackBar('A shortlist sharing operation is already in progress', {
          variant: SnackBarVariant.Warning,
          duration: 3000,
        });
        return;
      }

      try {
        setIsProcessing(true);
        let recordsToShare;

      if (tableState?.selectedRowIds?.length > 0) {
        const selectedIdsSet = new Set(tableState.selectedRowIds);
        
        // Filter database candidates (from rawData) - match by id
        const databaseCandidates = tableState.rawData.filter(record => 
          selectedIdsSet.has(record.id)
        );
        
        // Filter LinkedIn/search candidates (from searchResults) - match by tempId or id
        const searchCandidates = searchResults.filter(record => {
          const candidateId = record?.tempId || record?.id;
          return candidateId && selectedIdsSet.has(candidateId);
        });
        
        // Merge both types of candidates
        recordsToShare = [...databaseCandidates, ...searchCandidates];
      } else {
        recordsToShare = await fetchAllRecordIds();
      }


        console.log('recordsToShare', recordsToShare);
        if (!recordsToShare || recordsToShare.length === 0) {
          enqueueSnackBar('No records selected for sharing', {
            variant: SnackBarVariant.Warning,
            duration: 3000,
          });
          return;
        }

        const recordIdsToShare: string[] = recordsToShare.map(
          (record) => record.id,
        );
        await sendCVsToClient(recordIdsToShare, 'chat-based-shortlist-delivery');
        
        enqueueSnackBar('Shortlist shared successfully', {
          variant: SnackBarVariant.Success,
          duration: 3000,
        });
        
        setIsShareChatBasedShortlistModalOpen(false);
      } catch (error) {
        console.error('Error sharing shortlist:', error);
        enqueueSnackBar(error instanceof Error ? error.message : 'Failed to share shortlist', {
          variant: SnackBarVariant.Error,
          duration: 5000,
        });
      } finally {
        setIsProcessing(false);
      }
    }, [sendCVsToClient, fetchAllRecordIds, enqueueSnackBar, isProcessing, tableState, searchResults]);

    const onClick = () => {
        console.log('tableState', tableState);
      console.log('Share Chat Based Shortlist onClick triggered', {
        shouldBeRegistered,
        contextStoreNumberOfSelectedRecords,
        isRemoteObject,
      });

      // if (!shouldBeRegistered) {
      //   enqueueSnackBar('Cannot share shortlist - no records selected or too many records selected', {
      //     variant: SnackBarVariant.Warning,
      //     duration: 3000,
      //   });
      //   return;
      // }
      resetState();
      setIsShareChatBasedShortlistModalOpen(true);
    };

    const confirmationModal = (
      <ConfirmationModal
        isOpen={isShareChatBasedShortlistModalOpen}
        setIsOpen={(isOpen) => {
          setIsShareChatBasedShortlistModalOpen(isOpen);
          if (!isOpen) {
            resetState();
          }
        }}
        title={'Share Chat-based Shortlist'}
        subtitle={`Are you sure you want to share this chat-based shortlist for ${contextStoreNumberOfSelectedRecords} selected record(s)?`}
        onConfirmClick={handleShareChatBasedShortlistClick}
        deleteButtonText={'Share Shortlist'}
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
