import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
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
import { isDefined } from 'twenty-shared';

export const usePopulateShortlistAction: ActionHookWithObjectMetadataItem = ({ objectMetadataItem }) => { 
  const { enqueueSnackBar } = useSnackBar();
  const [isPopulateShortlistModalOpen, setIsPopulateShortlistModalOpen] = useState(false);
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
    
  const { sendCVsToClient } = useSendCVsToClient();

  const resetState = useCallback(() => {
    setIsProcessing(false);
  }, []);

  const handlePopulateShortlistClick = useCallback(async () => {
    if (isProcessing) {
      enqueueSnackBar('A shortlist population is already in progress', {
        variant: SnackBarVariant.Warning,
        duration: 3000,
      });
      return;
    }

    try {
      setIsProcessing(true);
      const recordsForShortlist = await fetchAllRecordIds();
      
      if (!recordsForShortlist || recordsForShortlist.length === 0) {
        enqueueSnackBar('No records selected for shortlist', {
          variant: SnackBarVariant.Warning,
          duration: 3000,
        });
        return;
      }

      const recordIdsForShortlist = recordsForShortlist.map((record) => record.id);
      await sendCVsToClient(recordIdsForShortlist, 'create-shortlist');
      
      enqueueSnackBar('Shortlist populated successfully', {
        variant: SnackBarVariant.Success,
        duration: 3000,
      });
      
      setIsPopulateShortlistModalOpen(false);
    } catch (error) {
      console.error('Error populating shortlist:', error);
      enqueueSnackBar(error instanceof Error ? error.message : 'Failed to populate shortlist', {
        variant: SnackBarVariant.Error,
        duration: 5000,
      });
    } finally {
      setIsProcessing(false);
    }
  }, [fetchAllRecordIds, sendCVsToClient, enqueueSnackBar, isProcessing]);

  const onClick = () => {
    if (!shouldBeRegistered) {
      return;
    }
    resetState();
    setIsPopulateShortlistModalOpen(true);
  };

  const confirmationModal = (
    <ConfirmationModal
      isOpen={isPopulateShortlistModalOpen}
      setIsOpen={(isOpen) => {
        setIsPopulateShortlistModalOpen(isOpen);
        if (!isOpen) {
          resetState();
        }
      }}
      title={'Populate Shortlist'}
      subtitle={`Are you sure you want to populate the shortlist for ${contextStoreNumberOfSelectedRecords} selected record(s)?`}
      onConfirmClick={handlePopulateShortlistClick}
      deleteButtonText={'Populate Shortlist'}
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
