import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { contextStoreFiltersComponentState } from '@/context-store/states/contextStoreFiltersComponentState';
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { computeContextStoreFilters } from '@/context-store/utils/computeContextStoreFilters';
import { BACKEND_BATCH_REQUEST_MAX_COUNT } from '@/object-record/constants/BackendBatchRequestMaxCount';
import { DEFAULT_QUERY_PAGE_SIZE } from '@/object-record/constants/DefaultQueryPageSize';
import { useLazyFetchAllRecords } from '@/object-record/hooks/useLazyFetchAllRecords';
import { useRefreshChatStatus } from '@/object-record/hooks/useRefreshChatStatus';
import { useFilterValueDependencies } from '@/object-record/record-filter/hooks/useFilterValueDependencies';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { useCallback, useState } from 'react';
import { isDefined } from 'twenty-shared';

export const useRefreshChatStatusesAction: ActionHookWithObjectMetadataItem = ({ objectMetadataItem }) => { 
    
  console.log('objectMetadataItem', objectMetadataItem);
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
    
    
    const [isRefreshChatStatusModalOpen, setIsRefreshChatStatusModalOpen] = useState(false);
    const { refreshChatStatus } = useRefreshChatStatus();

    const handleRefreshChatStatusClick = useCallback(async () => {
      const recordsToRefresh = await fetchAllRecordIds();
      const recordIdsToRefresh: string[] = recordsToRefresh.map((record) => record.id);
      await refreshChatStatus(recordIdsToRefresh);
    }, [refreshChatStatus, fetchAllRecordIds]);

    const onClick = () => {
      if (!shouldBeRegistered) {
      return;
      }
      setIsRefreshChatStatusModalOpen(true);
    };

    const confirmationModal = (
      <ConfirmationModal
      isOpen={isRefreshChatStatusModalOpen}
      setIsOpen={setIsRefreshChatStatusModalOpen}
      title={'Refresh Chat Status'}
      subtitle={`Are you sure you want to refresh chat statuses for the selected records?`}
      onConfirmClick={handleRefreshChatStatusClick}
      deleteButtonText={'Refresh Chat Status'}
      confirmButtonAccent='blue'
      />
    );

    return {
      shouldBeRegistered,
      onClick,
      ConfirmationModal: confirmationModal,
    };
    };
