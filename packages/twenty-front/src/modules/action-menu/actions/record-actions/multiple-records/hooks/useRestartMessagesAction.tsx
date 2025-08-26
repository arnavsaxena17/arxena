import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { tableStateAtom } from '@/candidate-table/states/states';
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

export const useRestartMessagesAction: ActionHookWithObjectMetadataItem = ({ objectMetadataItem }) => { 
  const location = useLocation();
  const isJobRoute = location.pathname.includes('/job/');
  const tableState = useRecoilValue(tableStateAtom);
  const tokenPair = useRecoilValue(tokenPairState);
  const { enqueueSnackBar } = useSnackBar();
  const [isRestartMessagesModalOpen, setIsRestartMessagesModalOpen] = useState(false);
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

  const handleRestartMessagesClick = useCallback(async () => {
    console.log('handleRestartMessagesClick triggered', {
      isProcessing,
      isJobRoute,
      tableState,
    }); 
    if (isProcessing) {
      enqueueSnackBar('A message restart operation is already in progress', {
        variant: SnackBarVariant.Warning,
        duration: 3000,
      });
      return;
    }

    try {
      setIsProcessing(true);
      let selectedRecords;

      if (isJobRoute && tableState?.selectedRowIds?.length > 0) {
        console.log('Selected records for restart via UI', {
          selectedRowIds: tableState.selectedRowIds,
          rawData: tableState.rawData,
        });
        selectedRecords = tableState.rawData.filter(record => 
          tableState.selectedRowIds.includes(record.id)
        );
      } else {
        console.log('Fetching all records for restart via fetching hook', {
          filter: graphqlFilter,
          limit: DEFAULT_QUERY_PAGE_SIZE,
        });
        selectedRecords = await fetchAllRecords();
      }

      if (!selectedRecords || selectedRecords.length === 0) {
        enqueueSnackBar('No records selected', {
          variant: SnackBarVariant.Warning,
          duration: 3000,
        });
        return;
      }

      console.log('Selected records for restart', {
        selectedRecords,
      });

      let successCount = 0;
      let errorCount = 0;

      for (const record of selectedRecords) {
        console.log('Processing record for restart', {
          record,
        });
        if (!record.phoneNumber?.primaryPhoneNumber) {
          errorCount++;
          console.log('Record does not have a primary phone number', {
            record,
          });
          continue;

        }

        try {
          console.log('Posting to server', {
            record,
          });

          await axios.post(
            `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/start-interim-chat-prompt`,
            {
              interimChat: 'remindCandidate',
              candidateId: record.id,
            },
            {
              headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` },
            }
          );
          successCount++;
        } catch (error) {
          console.error(`Error restarting messages for record ${record.id}:`, error);
          errorCount++;
        }
      }
      console.log('Success count', successCount); 
      console.log('Error count', errorCount); 

      if (successCount > 0) {
        enqueueSnackBar(`Successfully restarted messages for ${successCount} record(s)${errorCount > 0 ? `, failed for ${errorCount} record(s)` : ''}`, {
          variant: successCount > 0 ? SnackBarVariant.Success : SnackBarVariant.Error,
          duration: 5000,
        });
        setIsRestartMessagesModalOpen(false);
      } else {
        enqueueSnackBar(`Failed to restart messages for all ${errorCount} record(s)`, {
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
    fetchAllRecords,
    tokenPair?.accessToken?.token,
    enqueueSnackBar,
  ]);

  const onClick = () => {
    console.log('Restart Messages onClick triggered', {
      shouldBeRegistered,
      contextStoreNumberOfSelectedRecords,
      isRemoteObject,
    });
    
    // if (!shouldBeRegistered) {
    //   enqueueSnackBar('Cannot restart messages - no records selected or too many records selected. Also not registered', {
    //     variant: SnackBarVariant.Warning,
    //     duration: 3000,
    //   });
    //   return;
    // }
    
    resetState();
    setIsRestartMessagesModalOpen(true);
  };

  const confirmationModal = (
    <ConfirmationModal
      isOpen={isRestartMessagesModalOpen}
      setIsOpen={(isOpen) => {
        setIsRestartMessagesModalOpen(isOpen);
        if (!isOpen) {
          resetState();
        }
      }}
      title={'Restart Messaging'}
      subtitle={`Are you sure you want to restart messaging for ${contextStoreNumberOfSelectedRecords} selected record(s)?`}
      onConfirmClick={handleRestartMessagesClick}
      deleteButtonText={'Restart Messaging'}
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
