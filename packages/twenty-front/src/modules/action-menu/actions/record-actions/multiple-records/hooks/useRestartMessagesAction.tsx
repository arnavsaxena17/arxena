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
    
  const [isRestartMessagesModalOpen, setIsRestartMessagesModalOpen] = useState(false);

  const handleRestartMessagesClick = useCallback(async () => {
    try {
      let selectedRecords;

      if (isJobRoute && tableState) {
        selectedRecords = tableState.rawData.filter(record => 
          tableState.selectedRowIds.includes(record.id)
        );
      } else {
        selectedRecords = await fetchAllRecords();
      }
      console.log('selectedRecords::', selectedRecords);
      if (!selectedRecords || selectedRecords.length === 0) {
        enqueueSnackBar('No records selected', {
          variant: SnackBarVariant.Error,
          duration: 3000,
        });
        return;
      }
      // Process each selected record
      for (const record of selectedRecords) {
        if (!record.people.phones.primaryPhoneNumber) {
          console.warn(`Skipping record ${record.id}: No phone number found`);
          continue;
        }

        try {
          await axios.post(
            `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/start-interim-chat-prompt`,
            {
              interimChat: 'remindCandidate', // Using 'restart' as the interim chat type for restarting messages
              phoneNumber: record.people.phones.primaryPhoneNumber,
            },
            {
              headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` },
            }
          );
        } catch (error) {
          console.error(`Error restarting messages for record ${record.id}:`, error);
          enqueueSnackBar(`Failed to restart messages for ${record.phone}`, {
            variant: SnackBarVariant.Error,
            duration: 3000,
          });
        }
      }

      enqueueSnackBar('Messages restarted successfully', {
        variant: SnackBarVariant.Success,
        duration: 3000,
      });
      setIsRestartMessagesModalOpen(false);
    } catch (error) {
      console.error('Error processing records:', error);
      enqueueSnackBar('Error processing records', {
        variant: SnackBarVariant.Error,
        duration: 3000,
      });
    }
  }, [fetchAllRecords, isJobRoute, tableState, tokenPair, enqueueSnackBar]);

  const onClick = () => {
    if (!shouldBeRegistered) {
      return;
    }
    setIsRestartMessagesModalOpen(true);
  };

  const confirmationModal = (
    <ConfirmationModal
      isOpen={isRestartMessagesModalOpen}
      setIsOpen={setIsRestartMessagesModalOpen}
      title={'Restart Messaging'}
      subtitle={`Are you sure you want to restart with candidates?`}
      onConfirmClick={handleRestartMessagesClick}
      deleteButtonText={'Restart Messaging'}
      confirmButtonAccent='blue'
    />
  );

  return {
    shouldBeRegistered,
    onClick,
    ConfirmationModal: confirmationModal,
  };
};
