import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { useArxEnrichCreationModal } from '@/arx-ai-filtering/hooks/useArxEnrichCreationModal';
import { tableStateAtom } from '@/candidate-table/states/states';
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
import { useRecoilValue } from 'recoil';
import { isDefined } from 'twenty-shared';

export const useCandidateAiFilteringAction: ActionHookWithObjectMetadataItem = ({ objectMetadataItem }) => {
  const tableState = useRecoilValue(tableStateAtom);

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

  const [isStartAiFilteringModalOpen, setIsStartAiFilteringModalOpen] = useState(false);
  const { sendStartChatRequest } = useStartChats({
    onSuccess: () => {},
    onError: () => {},
  });

  const handleStartAiFilteringClick = useCallback(async () => {
    if (tableState?.selectedRowIds?.length > 0) {
      await sendStartChatRequest(
        tableState.selectedRowIds,
        objectMetadataItem.nameSingular,
      );
      return;
    }

    const recordsFromServer = await fetchAllRecordIds();
    const recordIdsToFilter = recordsFromServer.map((record) => record.id);
    await sendStartChatRequest(
      recordIdsToFilter,
      objectMetadataItem.nameSingular,
    );
  }, [sendStartChatRequest, fetchAllRecordIds, tableState?.selectedRowIds, objectMetadataItem.nameSingular]);

  const { openModal } = useArxEnrichCreationModal();

  const handleModal = async () => {
    if (tableState?.selectedRowIds?.length > 0) {
      openModal();
      return;
    }

    await fetchAllRecordIds();
    openModal();
  };

  const onClick = () => {
    if (!shouldBeRegistered) {
      return;
    }
    setIsStartAiFilteringModalOpen(true);
  };

  const confirmationModal = (
    <ConfirmationModal
      isOpen={isStartAiFilteringModalOpen}
      setIsOpen={setIsStartAiFilteringModalOpen}
      title="Start AI filtering"
      subtitle="Are you sure you want to start AI filtering?"
      onConfirmClick={handleModal}
      deleteButtonText="Start AI filtering process"
      confirmButtonAccent="blue"
    />
  );

  return {
    shouldBeRegistered,
    onClick,
    ConfirmationModal: confirmationModal,
  };
};
