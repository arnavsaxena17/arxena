import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { contextStoreFiltersComponentState } from '@/context-store/states/contextStoreFiltersComponentState';
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { computeContextStoreFilters } from '@/context-store/utils/computeContextStoreFilters';
import { BACKEND_BATCH_REQUEST_MAX_COUNT } from '@/object-record/constants/BackendBatchRequestMaxCount';
import { DEFAULT_QUERY_PAGE_SIZE } from '@/object-record/constants/DefaultQueryPageSize';
import { useLazyFetchAllRecords } from '@/object-record/hooks/useLazyFetchAllRecords';
import { useStartChats } from '@/object-record/hooks/useStartChats';
import { useFilterValueDependencies } from '@/object-record/record-filter/hooks/useFilterValueDependencies';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { useCallback, useState } from 'react';
import { isDefined } from 'twenty-shared';

export const useStartChatWithCandidatesAction: ActionHookWithObjectMetadataItem =
  ({ objectMetadataItem }) => {
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
      // recordGqlFields: { id: true, candidateId: true },
    });

    const isRemoteObject = objectMetadataItem.isRemote;
    const shouldBeRegistered =
      !isRemoteObject &&
      isDefined(contextStoreNumberOfSelectedRecords) &&
      contextStoreNumberOfSelectedRecords < BACKEND_BATCH_REQUEST_MAX_COUNT &&
      contextStoreNumberOfSelectedRecords > 0;
    const [
      isStartChatWithCandidatesModalOpen,
      setIsStartChatWithCandidatesModalOpen,
    ] = useState(false);
    const { sendStartChatRequest } = useStartChats({
      onSuccess: () => {},
      onError: () => {},
    });

    const handleStartChatWithCandidatesClick = useCallback(async () => {
      const recordsToStartChat = await fetchAllRecordIds();

      const recordIdsToStartChat: string[] = objectMetadataItem.nameSingular
        .toLowerCase()
        .includes('jobcandidate')
        ? recordsToStartChat.map((record) => record.candidateId)
        : recordsToStartChat.map((record) => record.id);

      await sendStartChatRequest(
        recordIdsToStartChat,
        objectMetadataItem.nameSingular,
      );
    }, [sendStartChatRequest, fetchAllRecordIds]);

    const onClick = () => {
      if (!shouldBeRegistered) {
        return;
      }
      setIsStartChatWithCandidatesModalOpen(true);
    };

    const confirmationModal = (
      <ConfirmationModal
        isOpen={isStartChatWithCandidatesModalOpen}
        setIsOpen={setIsStartChatWithCandidatesModalOpen}
        title={'Start Multiple Chats'}
        subtitle={`Are you sure you want to start multiple chats?`}
        onConfirmClick={handleStartChatWithCandidatesClick}
        deleteButtonText={'Start Multiple Chats'}
        confirmButtonAccent="blue"
      />
    );

    return {
      shouldBeRegistered,
      onClick,
      ConfirmationModal: confirmationModal,
    };
  };
