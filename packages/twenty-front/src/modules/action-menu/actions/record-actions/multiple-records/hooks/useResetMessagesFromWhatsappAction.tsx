import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { tableStateAtom } from '@/candidate-table/states/states';
import { searchResultsState } from '@/candidate-search/states/searchResultsState';
import { contextStoreFiltersComponentState } from '@/context-store/states/contextStoreFiltersComponentState';
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { computeContextStoreFilters } from '@/context-store/utils/computeContextStoreFilters';
import { BACKEND_BATCH_REQUEST_MAX_COUNT } from '@/object-record/constants/BackendBatchRequestMaxCount';
import { DEFAULT_QUERY_PAGE_SIZE } from '@/object-record/constants/DefaultQueryPageSize';
import { useLazyFetchAllRecords } from '@/object-record/hooks/useLazyFetchAllRecords';
import { useFilterValueDependencies } from '@/object-record/record-filter/hooks/useFilterValueDependencies';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import axios from 'axios';
import { useCallback, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { isDefined } from 'twenty-shared';

export const useResetMessagesFromWhatsappAction: ActionHookWithObjectMetadataItem = ({ objectMetadataItem }) => { 
  const location = useLocation();
  const isJobRoute = location.pathname.includes('/job/');
  const tableState = useRecoilValue(tableStateAtom);
  const searchResults = useRecoilValue(searchResultsState);
  const tokenPair = useRecoilValue(tokenPairState);
  const { enqueueSnackBar } = useSnackBar();
  const [isResetMessagesFromWhatsappModalOpen, setIsResetMessagesFromWhatsappModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
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
    
  const { fetchAllRecords } = useLazyFetchAllRecords({
    objectNameSingular: objectMetadataItem.nameSingular,
    filter: graphqlFilter,
    limit: DEFAULT_QUERY_PAGE_SIZE,
  });

  const isRemoteObject = objectMetadataItem.isRemote;
  const shouldBeRegistered =
    !isRemoteObject &&
    isDefined(contextStoreNumberOfSelectedRecords) &&
    contextStoreNumberOfSelectedRecords < BACKEND_BATCH_REQUEST_MAX_COUNT &&
    contextStoreNumberOfSelectedRecords > 0;

  const resetState = useCallback(() => {
    setIsProcessing(false);
  }, []);

  const handleResetMessagesFromWhatsappClick = useCallback(async () => {
    if (isProcessing) {
      enqueueSnackBar('A message reset operation is already in progress', {
        variant: SnackBarVariant.Warning,
        duration: 3000,
      });
      return;
    }

    try {
      setIsProcessing(true);
      let selectedRecords;

      if (isJobRoute && tableState?.selectedRowIds?.length > 0) {
        const selectedIdsSet = new Set(tableState.selectedRowIds);
        
        // Filter database candidates (from rawData) - match by id
        const databaseCandidates = tableState.rawData.filter(record => 
          selectedIdsSet.has(record.id)
        );
        
        // Filter LinkedIn/search candidates (from searchResults) - match by id first, then tempId
        // Since selectedRowIds now prefers permanent id, check id first
        const searchCandidates = searchResults.filter((record) => {
          const recordId = record?.id;
          const recordTempId = record?.tempId;
          // Check if selectedRowIds contains either the permanent id or tempId
          return (recordId && selectedIdsSet.has(recordId)) || 
                 (recordTempId && selectedIdsSet.has(recordTempId));
        });
        
        // Merge both types of candidates
        selectedRecords = [...databaseCandidates, ...searchCandidates];
      } else {
        selectedRecords = await fetchAllRecords();
      }
      
      if (!selectedRecords || selectedRecords.length === 0) {
        enqueueSnackBar('No records selected', {
          variant: SnackBarVariant.Warning,
          duration: 3000,
        });
        return;
      }

      try {
        await axios.post(
          `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/reset-messages-from-whatsapp`,
          { candidateIds: selectedRecords.map(record => (record as { tempId?: string; id: string }).tempId || record.id) },
          { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` } }
        );

        enqueueSnackBar(`Successfully reset messages for ${selectedRecords.length} record(s)`, {
          variant: SnackBarVariant.Success,
          duration: 3000,
        });

        setIsResetMessagesFromWhatsappModalOpen(false);
      } catch (error) {
        console.error('Error resetting messages:', error);
        enqueueSnackBar(error instanceof Error ? error.message : 'Failed to reset messages', {
          variant: SnackBarVariant.Error,
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Error processing records:', error);
      enqueueSnackBar('Error processing records', {
        variant: SnackBarVariant.Error,
        duration: 5000,
      });
    } finally {
      setIsProcessing(false);
    }
  }, [
    isProcessing,
    isJobRoute,
    tableState,
    searchResults,
    fetchAllRecords,
    tokenPair?.accessToken?.token,
    enqueueSnackBar,
  ]);

  const onClick = useCallback(() => {
    console.log('Reset Messages from Whatsapp onClick triggered', {
      shouldBeRegistered,
      contextStoreNumberOfSelectedRecords,
      isRemoteObject,
    });

    // if (!shouldBeRegistered) {
    //   enqueueSnackBar('Cannot reset messages - no records selected or too many records selected', {
    //     variant: SnackBarVariant.Warning,
    //     duration: 3000,
    //   });
    //   return;
    // }
    
    resetState();
    setIsResetMessagesFromWhatsappModalOpen(true);
  }, [shouldBeRegistered, contextStoreNumberOfSelectedRecords, isRemoteObject, enqueueSnackBar, resetState]);

  const confirmationModal = (
    <ConfirmationModal
      isOpen={isResetMessagesFromWhatsappModalOpen}
      setIsOpen={(isOpen) => {
        console.log('Setting modal open state to:', isOpen);
        setIsResetMessagesFromWhatsappModalOpen(isOpen);
        if (!isOpen) {
          resetState();
        }
      }}
      title={'Reset Messages from Whatsapp'}
      subtitle={`Are you sure you want to reset messages from Whatsapp for ${contextStoreNumberOfSelectedRecords} selected record(s)?`}
      onConfirmClick={handleResetMessagesFromWhatsappClick}
      deleteButtonText={'Reset Messages from Whatsapp'}
      confirmButtonAccent='blue'
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
