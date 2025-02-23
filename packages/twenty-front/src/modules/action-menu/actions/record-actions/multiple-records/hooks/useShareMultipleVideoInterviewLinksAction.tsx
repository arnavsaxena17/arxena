import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { contextStoreFiltersComponentState } from '@/context-store/states/contextStoreFiltersComponentState';
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { computeContextStoreFilters } from '@/context-store/utils/computeContextStoreFilters';
import { BACKEND_BATCH_REQUEST_MAX_COUNT } from '@/object-record/constants/BackendBatchRequestMaxCount';
import { DEFAULT_QUERY_PAGE_SIZE } from '@/object-record/constants/DefaultQueryPageSize';
import { useLazyFetchAllRecords } from '@/object-record/hooks/useLazyFetchAllRecords';
import { useShareManyVideoInterviewLinks } from '@/object-record/hooks/useShareManyVideoInterviewLinks';
import { useFilterValueDependencies } from '@/object-record/record-filter/hooks/useFilterValueDependencies';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { useCallback, useState } from 'react';
import { isDefined } from 'twenty-shared';

export const useShareMultipleVideoInterviewLinksAction: ActionHookWithObjectMetadataItem = ({ objectMetadataItem }) => { 
    
  
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
    const [isShareMultipleVideoInterviewLinksModalOpen, setIsShareMultipleVideoInterviewLinksModalOpen] = useState(false);
    const { shareVideoInterviewLinks } = useShareManyVideoInterviewLinks();
    console.log("The objectMetadataItem is::", objectMetadataItem);
    const handleShareMultipleVideoInterviewLinksClick = useCallback(async () => {
      const recordsToShareVideoInterviewLinks = await fetchAllRecordIds();
      const recordIdsToShareVideoInterviewLinks:string[] = recordsToShareVideoInterviewLinks.map((record) => record.id);
      console.log("Records selected::", recordsToShareVideoInterviewLinks, "Record IDs selected::", recordIdsToShareVideoInterviewLinks);
      await shareVideoInterviewLinks(recordIdsToShareVideoInterviewLinks );
    }, [shareVideoInterviewLinks, fetchAllRecordIds]);

    const onClick = () => {
      if (!shouldBeRegistered) {
        return;
      }
      setIsShareMultipleVideoInterviewLinksModalOpen(true);
    };

    const confirmationModal = (
      <ConfirmationModal
        isOpen={isShareMultipleVideoInterviewLinksModalOpen}
        setIsOpen={setIsShareMultipleVideoInterviewLinksModalOpen}
        title={'Share Multiple Video Interview Links'}
        subtitle={`Are you sure you want to share multiple video interview links?`}
        onConfirmClick={handleShareMultipleVideoInterviewLinksClick}
        deleteButtonText={'Share Multiple Video Interview Links'}
        confirmButtonAccent = 'blue'
      />
    );

    return {
      shouldBeRegistered,
      onClick,
      ConfirmationModal: confirmationModal,
    };
  };
