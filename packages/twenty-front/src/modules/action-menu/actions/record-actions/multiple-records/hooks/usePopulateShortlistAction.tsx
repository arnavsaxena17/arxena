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
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { useCallback, useState } from 'react';
import { isDefined } from 'twenty-shared';

export const usePopulateShortlistAction: ActionHookWithObjectMetadataItem = ({ objectMetadataItem }) => { 
    
  
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
    
    const [isPopulateShortlistModalOpen, setIsPopulateShortlistModalOpen] = useState(false);
    const { sendCVsToClient } = useSendCVsToClient();

    console.log("The objectMetadataItem is::", objectMetadataItem);
    const handlePopulateShortlistClick = useCallback(async () => {
      const recordsForShortlist = await fetchAllRecordIds();
      const recordIdsForShortlist:string[] = recordsForShortlist.map((record) => record.id);
      console.log("Records selected::", recordsForShortlist, "Record IDs selected::", recordIdsForShortlist);
      await sendCVsToClient(recordIdsForShortlist, 'create-shortlist');
    }, [fetchAllRecordIds, sendCVsToClient]);

    const onClick = () => {
      if (!shouldBeRegistered) {
      return;
      }
      setIsPopulateShortlistModalOpen(true);
    };

    const confirmationModal = (
      <ConfirmationModal
      isOpen={isPopulateShortlistModalOpen}
      setIsOpen={setIsPopulateShortlistModalOpen}
      title={'Populate Shortlist'}
      subtitle={`Are you sure you want to populate the shortlist?`}
      onConfirmClick={handlePopulateShortlistClick}
      deleteButtonText={'Populate Shortlist'}
      confirmButtonAccent='blue'
      />
    );

    return {
      shouldBeRegistered,
      onClick,
      ConfirmationModal: confirmationModal,
    };
    };
