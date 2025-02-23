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

export const useShareChatBasedShortlistAction: ActionHookWithObjectMetadataItem = ({ objectMetadataItem }) => { 
    
  
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
    
    const [isShareChatBasedShortlistModalOpen, setIsShareChatBasedShortlistModalOpen] = useState(false);
    const { sendCVsToClient } = useSendCVsToClient();

    const handleShareChatBasedShortlistClick = useCallback(async () => {
      const recordsToShare = await fetchAllRecordIds();
      const recordIdsToShare: string[] = recordsToShare.map((record) => record.id);
      await sendCVsToClient(recordIdsToShare, 'chat-based-shortlist-delivery');
    }, [sendCVsToClient, fetchAllRecordIds]);

    const onClick = () => {
      if (!shouldBeRegistered) {
      return;
      }
      setIsShareChatBasedShortlistModalOpen(true);
    };

    const confirmationModal = (
      <ConfirmationModal
      isOpen={isShareChatBasedShortlistModalOpen}
      setIsOpen={setIsShareChatBasedShortlistModalOpen}
      title={'Share Chat-based Shortlist'}
      subtitle={`Are you sure you want to share this chat-based shortlist?`}
      onConfirmClick={handleShareChatBasedShortlistClick}
      deleteButtonText={'Share Shortlist'}
      confirmButtonAccent='blue'
      />
    );

    return {
      shouldBeRegistered,
      onClick,
      ConfirmationModal: confirmationModal,
    };
  };
