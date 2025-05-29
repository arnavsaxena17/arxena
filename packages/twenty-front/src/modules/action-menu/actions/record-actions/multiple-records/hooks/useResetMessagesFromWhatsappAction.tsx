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

export const useResetMessagesFromWhatsappAction: ActionHookWithObjectMetadataItem = ({ objectMetadataItem }) => { 
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
    
  const [isResetMessagesFromWhatsappModalOpen, setIsResetMessagesFromWhatsappModalOpen] = useState(false);

  const handleResetMessagesFromWhatsappClick = useCallback(async () => {
    console.log('handleResetMessagesFromWhatsappClick::');
    try {
      let selectedRecords;

      if (isJobRoute && tableState) {
        selectedRecords = tableState.rawData.filter(record => 
          tableState.selectedRowIds.includes(record.id)
        );
      } else {
        selectedRecords = await fetchAllRecords();
      }
      
      if (!selectedRecords || selectedRecords.length === 0) {
        enqueueSnackBar('No records selected', {
          variant: SnackBarVariant.Error,
          duration: 3000,
        });
        return;
      }

      console.log('selectedRecords::', selectedRecords);

      try {
        await axios.post(
          `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/reset-messages-from-whatsapp`,
          { candidateIds: selectedRecords.map(record => record.id), },
          { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` }, }
        );
      } catch (error) {
        console.error(`Error resetting messages for record ${selectedRecords.map(record => record.id)}:`, error);
        enqueueSnackBar(`Failed to reset messages for ${selectedRecords.map(record => record.id)}`, {
          variant: SnackBarVariant.Error,
          duration: 3000,
        });
      }
      enqueueSnackBar('Messages reset successfully', {
        variant: SnackBarVariant.Success,
        duration: 3000,
      });

      setIsResetMessagesFromWhatsappModalOpen(false);
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
    setIsResetMessagesFromWhatsappModalOpen(true);
  };

  const confirmationModal = (
    <ConfirmationModal
      isOpen={isResetMessagesFromWhatsappModalOpen}
      setIsOpen={setIsResetMessagesFromWhatsappModalOpen}
      title={'Reset Messages from Whatsapp'}
      subtitle={`Are you sure you want to reset messages from Whatsapp?`}
      onConfirmClick={handleResetMessagesFromWhatsappClick}
      deleteButtonText={'Reset Messages from Whatsapp'}
      confirmButtonAccent='blue'
    />
  );

  return {
    shouldBeRegistered,
    onClick,
    ConfirmationModal: confirmationModal,
  };
};
