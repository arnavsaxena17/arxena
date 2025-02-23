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

export const useShareChatAndVideoInterviewBasedShortlistAction: ActionHookWithObjectMetadataItem = ({ objectMetadataItem }) => { 
    
  
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
    
    
    const [isShareChatAndVideoInterviewBasedShortlistModalOpen, setIsShareChatAndVideoInterviewBasedShortlistModalOpen] = useState(false);
    const { sendCVsToClient } = useSendCVsToClient();

    console.log("The objectMetadataItem is::", objectMetadataItem);
    const handleShareChatAndVideoInterviewBasedShortlistClick = useCallback(async () => {
      const recordsToShare = await fetchAllRecordIds();
      const recordIdsToShare:string[] = recordsToShare.map((record) => record.id);
      console.log("Records selected::", recordsToShare, "Record IDs selected::", recordIdsToShare);
      await sendCVsToClient(recordIdsToShare, 'create-gmail-draft-shortlist' );
    }, [sendCVsToClient, fetchAllRecordIds]);

    const onClick = () => {
      if (!shouldBeRegistered) {
      return;
      }
      setIsShareChatAndVideoInterviewBasedShortlistModalOpen(true);
    };

    const confirmationModal = (
      <ConfirmationModal
      isOpen={isShareChatAndVideoInterviewBasedShortlistModalOpen}
      setIsOpen={setIsShareChatAndVideoInterviewBasedShortlistModalOpen}
      title={'Share Chat and Video Interview Based Shortlist'}
      subtitle={`Are you sure you want to share chat and video interview based shortlist?`}
      onConfirmClick={handleShareChatAndVideoInterviewBasedShortlistClick}
      deleteButtonText={'Share Chat and Video Interview Based Shortlist'}
      confirmButtonAccent = 'blue'
      />
    );

    return {
      shouldBeRegistered,
      onClick,
      ConfirmationModal: confirmationModal,
    };
  };
