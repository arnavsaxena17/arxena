import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { useArxEnrichCreationModal } from '@/arx-enrich/hooks/useArxEnrichCreationModal';
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

export const useCandidateEnrichmentAction: ActionHookWithObjectMetadataItem = ({ objectMetadataItem }) => { 
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
    
  const [isStartEnrichmentModalOpen, setIsStartEnrichmentModalOpen] = useState(false);
  const { sendStartChatRequest } = useStartChats({
    onSuccess: () => {},
    onError: () => {},
  });

  const handleStartEnrichmentClick = useCallback(async () => {
    // Always use tableState.selectedRowIds if available
    if (tableState?.selectedRowIds?.length > 0) {
      console.log("Using selected rows from table state for enrichment:", tableState.selectedRowIds);
      await sendStartChatRequest(
        tableState.selectedRowIds,
        objectMetadataItem.nameSingular,
      );
      return;
    }

    // Fallback to fetching all records if no table selection
    const recordsFromServer = await fetchAllRecordIds();
    const recordIdsToEnrich = recordsFromServer.map((record) => record.id);
    console.log("Using records from server for enrichment:", recordIdsToEnrich);
    await sendStartChatRequest(
      recordIdsToEnrich,
      objectMetadataItem.nameSingular,
    );
  }, [sendStartChatRequest, fetchAllRecordIds, tableState?.selectedRowIds, objectMetadataItem.nameSingular]);

  const { openModal } = useArxEnrichCreationModal();
    
  const handleModal = async () => {
    console.log("handleModal: Table state selected row IDs:", tableState?.selectedRowIds);

    // Always prioritize table state selected rows
    if (tableState?.selectedRowIds?.length > 0) {
      console.log("Using selected rows from table state:", tableState.selectedRowIds);
      openModal();
      return;
    }

    // Fallback to fetching from server if no selected rows in table
    const recordsToEnrichFromServer = await fetchAllRecordIds();
    const recordIdsToEnrich = recordsToEnrichFromServer.map((record) => record.id);
    
    console.log("Records selected from server:", recordsToEnrichFromServer);
    console.log("Record IDs selected from server:", recordIdsToEnrich);
    
    openModal();
  };

  const onClick = () => {
    if (!shouldBeRegistered) {
      return;
    }
    setIsStartEnrichmentModalOpen(true);
  };

  const confirmationModal = (
    <ConfirmationModal
      isOpen={isStartEnrichmentModalOpen}
      setIsOpen={setIsStartEnrichmentModalOpen}
      title={'Start Enrichment'}
      subtitle={`Are you sure you want to start Enrichment?`}
      onConfirmClick={handleModal}
      deleteButtonText={'Start Enrichment Process'}
      confirmButtonAccent='blue'
    />
  );

  return {
    shouldBeRegistered,
    onClick,
    ConfirmationModal: confirmationModal,
  };
};
