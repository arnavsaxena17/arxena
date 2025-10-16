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

export const useSyncChatsWithWhatsappAction: ActionHookWithObjectMetadataItem = ({ objectMetadataItem }) => { 
  const location = useLocation();
  const isJobRoute = location.pathname.includes('/job/');
  const tableState = useRecoilValue(tableStateAtom);
  const tokenPair = useRecoilValue(tokenPairState);
  const { enqueueSnackBar } = useSnackBar();
  const [isSyncChatsModalOpen, setIsSyncChatsModalOpen] = useState(false);
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

  const handleSyncChatsClick = useCallback(async () => {
    console.log('handleSyncChatsClick triggered', {
      isProcessing,
      isJobRoute,
      tableState,
    }); 
    
    if (isProcessing) {
      enqueueSnackBar('A sync operation is already in progress', {
        variant: SnackBarVariant.Warning,
        duration: 3000,
      });
      return;
    }

    try {
      setIsProcessing(true);
      let selectedRecords;

      if (isJobRoute && tableState?.selectedRowIds?.length > 0) {
        console.log('Selected records for sync via UI', {
          selectedRowIds: tableState.selectedRowIds,
          rawData: tableState.rawData,
        });
        selectedRecords = tableState.rawData.filter(record => 
          tableState.selectedRowIds.includes(record.id)
        );
      } else {
        console.log('Fetching all records for sync via fetching hook', {
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

      console.log('Selected records for sync', {
        selectedRecords,
      });

      let successCount = 0;
      let errorCount = 0;
      let totalSynced = 0;
      let totalSkipped = 0;
      let totalErrors = 0;

      for (const record of selectedRecords) {
        console.log('Processing record for sync', {
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
          console.log('Syncing chats for record', {
            record,
            phoneNumber: record.phoneNumber.primaryPhoneNumber,
          });
          console.log("process.env.REACT_APP_SERVER_BASE_URL::", process.env.REACT_APP_SERVER_BASE_URL);

          const response = await axios.post(
            `${process.env.REACT_APP_SERVER_BASE_URL}/baileys-whatsapp/sync-messages`,
            {
              phoneNumber: record.phoneNumber.primaryPhoneNumber,
              candidateId: record.id,
              limit: 50,
            },
            {
              headers: { 
                Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
                'Content-Type': 'application/json',
              }
            }
          );

          if (response.data.status === 'ok') {
            successCount++;
            totalSynced += response.data.data.synced || 0;
            totalSkipped += response.data.data.skipped || 0;
            totalErrors += response.data.data.errors || 0;
            
            console.log('Sync successful for record', {
              recordId: record.id,
              synced: response.data.data.synced,
              skipped: response.data.data.skipped,
              errors: response.data.data.errors,
            });
          } else {
            errorCount++;
            console.log('Sync failed for record', {
              recordId: record.id,
              error: response.data.message,
            });
          }
        } catch (error) {
          console.error(`Error syncing chats for record ${record.id}:`, error);
          errorCount++;
          totalErrors++;
        }
      }

      console.log('Sync completed', {
        successCount,
        errorCount,
        totalSynced,
        totalSkipped,
        totalErrors,
      });

      if (successCount > 0) {
        enqueueSnackBar(
          `Successfully synced chats for ${successCount} record(s). Synced: ${totalSynced}, Skipped: ${totalSkipped}, Errors: ${totalErrors}${errorCount > 0 ? `, Failed: ${errorCount}` : ''}`, 
          {
            variant: SnackBarVariant.Success,
            duration: 7000,
          }
        );
        setIsSyncChatsModalOpen(false);
      } else {
        enqueueSnackBar(`Failed to sync chats for all ${errorCount} record(s)`, {
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
    console.log('Sync Chats onClick triggered', {
      shouldBeRegistered,
      contextStoreNumberOfSelectedRecords,
      isRemoteObject,
    });
    
    resetState();
    setIsSyncChatsModalOpen(true);
  };

  const confirmationModal = (
    <ConfirmationModal
      isOpen={isSyncChatsModalOpen}
      setIsOpen={(isOpen) => {
        setIsSyncChatsModalOpen(isOpen);
        if (!isOpen) {
          resetState();
        }
      }}
      title={'Sync Chats with WhatsApp'}
      subtitle={`Are you sure you want to sync chats with WhatsApp for ${contextStoreNumberOfSelectedRecords} selected record(s)? This will fetch and save any new messages from WhatsApp to the database.`}
      onConfirmClick={handleSyncChatsClick}
      deleteButtonText={'Sync Chats'}
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
