import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { searchResultsState } from '@/candidate-search/states/searchResultsState';
import { tableStateAtom } from '@/candidate-table/states/states';
import { contextStoreFiltersComponentState } from '@/context-store/states/contextStoreFiltersComponentState';
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { computeContextStoreFilters } from '@/context-store/utils/computeContextStoreFilters';
import { DEFAULT_QUERY_PAGE_SIZE } from '@/object-record/constants/DefaultQueryPageSize';
import { useLazyFetchAllRecords } from '@/object-record/hooks/useLazyFetchAllRecords';
import { useStartChats } from '@/object-record/hooks/useStartChats';
import { useFilterValueDependencies } from '@/object-record/record-filter/hooks/useFilterValueDependencies';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { useSetRecoilComponentStateV2 } from '@/ui/utilities/state/component-state/hooks/useSetRecoilComponentStateV2';
import { useCallback, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { isDefined } from 'twenty-shared';

export const useStartChatWithCandidatesAction: ActionHookWithObjectMetadataItem =
  ({ objectMetadataItem }) => {
    const location = useLocation();
    const isJobRoute = location.pathname.includes('/job/');
    const tableState = useRecoilValue(tableStateAtom);
    const searchResults = useRecoilValue(searchResultsState);
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
    const [isStartChatWithCandidatesModalOpen, setIsStartChatWithCandidatesModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    
    const resetState = useCallback(() => {
      setIsProcessing(false);
      setNumberOfSelectedRecords(0);
      setTargetedRecordsRule({
        mode: 'selection',
        selectedRecordIds: [],
      });
    }, [setNumberOfSelectedRecords, setTargetedRecordsRule]);

    const { sendStartChatRequest, loading } = useStartChats({
      onSuccess: () => {
        enqueueSnackBar('Chats started successfully and candidates added to Google Contacts', {
          variant: SnackBarVariant.Success,
          duration: 5000,
        });
        setIsStartChatWithCandidatesModalOpen(false);
        resetState();
      },
      onError: (error) => {
        enqueueSnackBar(`Failed to start chats: ${error.message}`, {
          variant: SnackBarVariant.Error,
          duration: 5000,
        });
        setIsProcessing(false);
      },
    });

    const validateAndGetRecords = useCallback(async () => {
      let recordsToStartChat;
      console.log("tableState.selectedRowIds::", tableState.selectedRowIds);
      console.log("tableState.rawData::", tableState.rawData);
      console.log("searchResults::", searchResults);
      if (isJobRoute && tableState?.selectedRowIds?.length > 0) {
        const selectedIdsSet = new Set(tableState.selectedRowIds);
        
        // Filter database candidates (from rawData) - match by id
        const databaseCandidates = tableState.rawData.filter(record => 
          selectedIdsSet.has(record.id)
        );
        
        // Filter LinkedIn/search candidates (from searchResults) - match by id or tempId
        // selectedRowIds may contain either permanent UUIDs or LinkedIn IDs (tempIds)
        const searchCandidates = searchResults.filter((record: any) => {
          const recordId = record?.id;
          const recordTempId = (record as any)?.tempId;
          
          // Check if selectedRowIds contains the record's id or tempId
          const matches = (recordId && selectedIdsSet.has(recordId)) || 
                         (recordTempId && selectedIdsSet.has(recordTempId));
          
          if (!matches) {
            console.log('useStartChatWithCandidatesAction: Candidate not matched', {
              recordId,
              recordTempId,
              recordName: record?.name || record?.firstName,
              selectedIds: Array.from(selectedIdsSet)
            });
          }
          
          return matches;
        });
        
        console.log('useStartChatWithCandidatesAction: searchCandidates found', searchCandidates.length, 'candidates');
        
        // Merge both types of candidates
        recordsToStartChat = [...databaseCandidates, ...searchCandidates];
      } else {
        recordsToStartChat = await fetchAllRecordIds();
      }

      console.log("recordsToStartChat::", recordsToStartChat);
      if (!recordsToStartChat || recordsToStartChat.length === 0) {
        throw new Error('No candidates selected to start chat with');
      }

      const recordIdsToStartChat = recordsToStartChat.map((record: any) => 
        (record as any)?.tempId || record.id
      );

      const jobIds = recordsToStartChat
        .filter((record: any) => isDefined((record as any)?.jobsId))
        .map((record: any) => (record as any)?.jobsId);

      if (jobIds.length === 0) {
        throw new Error('No job associated with selected candidates. Please associate candidates with a job first.');
      }

      return { recordIdsToStartChat, jobIds };
    }, [isJobRoute, tableState, searchResults, fetchAllRecordIds, objectMetadataItem.nameSingular]);

    const handleStartChatWithCandidatesClick = useCallback(async () => {
      if (isProcessing) {
        enqueueSnackBar('Chat initiation is already in progress', {
          variant: SnackBarVariant.Warning,
          duration: 3000,
        });
        return;
      }

      try {
        setIsProcessing(true);
        const { recordIdsToStartChat, jobIds } = await validateAndGetRecords();
        
        await sendStartChatRequest(
          recordIdsToStartChat,
          objectMetadataItem.nameSingular,
          jobIds
        );
      } catch (error) {
        console.error('Error starting chats:', error);
        enqueueSnackBar(error instanceof Error ? error.message : 'Error starting chats', {
          variant: SnackBarVariant.Error,
          duration: 5000,
        });
      } finally {
        setIsProcessing(false);
      }
    }, [
      isProcessing,
      validateAndGetRecords,
      sendStartChatRequest,
      objectMetadataItem.nameSingular,
      enqueueSnackBar
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
        await validateAndGetRecords();
        setIsStartChatWithCandidatesModalOpen(true);
      } catch (error) {
        console.error('Error validating candidates:', error);
        enqueueSnackBar(error instanceof Error ? error.message : 'Error validating candidates', {
          variant: SnackBarVariant.Error,
          duration: 5000,
        });
      } finally {
        setIsProcessing(false);
      }
    }, [shouldBeRegistered, isProcessing, validateAndGetRecords, enqueueSnackBar]);

    const confirmationModal = (
      <ConfirmationModal
        isOpen={isStartChatWithCandidatesModalOpen}
        setIsOpen={(isOpen) => {
          setIsStartChatWithCandidatesModalOpen(isOpen);
          if (!isOpen) {
            resetState();
          }
        }}
        title={'Start Chat'}
        subtitle={`Are you sure you want to start a chat with ${contextStoreNumberOfSelectedRecords} selected candidate(s)?`}
        onConfirmClick={handleStartChatWithCandidatesClick}
        deleteButtonText={'Start Chat'}
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
