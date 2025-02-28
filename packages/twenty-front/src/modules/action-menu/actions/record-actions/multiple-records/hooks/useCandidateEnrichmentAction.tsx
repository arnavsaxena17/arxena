import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { useArxEnrichCreationModal } from '@/arx-enrich/hooks/useArxEnrichCreationModal';
import { recordsToEnrichState } from '@/arx-enrich/states/arxEnrichModalOpenState';
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
import { useRecoilState } from 'recoil';
import { isDefined } from 'twenty-shared';

export const useCandidateEnrichmentAction: ActionHookWithObjectMetadataItem = ({ objectMetadataItem }) => { 
    
  const [, setRecordsToEnrich] = useRecoilState(recordsToEnrichState);

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
      const recordsToEnrich = await fetchAllRecordIds();

      const recordIdsToEnrich: string[] = objectMetadataItem.nameSingular.toLowerCase().includes('jobcandidate')
      ? recordsToEnrich.map((record) => record.candidateId)
      : recordsToEnrich.map((record) => record.id);
      console.log("Records selected::", recordsToEnrich, "Record IDs selected::", recordIdsToEnrich);
      await sendStartChatRequest(
      recordIdsToEnrich,
      objectMetadataItem.nameSingular,
      );
    }, [sendStartChatRequest, fetchAllRecordIds]);

    const { openModal } = useArxEnrichCreationModal();
    
    const handleModal = async () => {
      const recordsToEnrich = await fetchAllRecordIds();
      const recordIdsToEnrich = objectMetadataItem.nameSingular.toLowerCase().includes('jobcandidate')
        ? recordsToEnrich.map((record) => record.id)
        : recordsToEnrich.map((record) => record.id);
      

        console.log("Records selected::", recordsToEnrich, "Record IDs selected::", recordIdsToEnrich);
      // Store the records in Recoil state
      setRecordsToEnrich(recordIdsToEnrich);
      
    
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
