import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { contextStoreFiltersComponentState } from '@/context-store/states/contextStoreFiltersComponentState';
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { computeContextStoreFilters } from '@/context-store/utils/computeContextStoreFilters';
import { BACKEND_BATCH_REQUEST_MAX_COUNT } from '@/object-record/constants/BackendBatchRequestMaxCount';
import { DEFAULT_QUERY_PAGE_SIZE } from '@/object-record/constants/DefaultQueryPageSize';
import { useExecuteDeleteCandidatesAndPeople } from '@/object-record/hooks/useExecuteDeleteCandidatesAndPeople';
import { useLazyFetchAllRecords } from '@/object-record/hooks/useLazyFetchAllRecords';
import { useFilterValueDependencies } from '@/object-record/record-filter/hooks/useFilterValueDependencies';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { useCallback, useState } from 'react';
import { isDefined } from 'twenty-shared';

export const useDeleteCandidatesAndPeopleAction: ActionHookWithObjectMetadataItem = ({ objectMetadataItem }) => { 
  
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
    
    
    const [isDeleteCandidatesAndPeopleModalOpen, setIsDeleteCandidatesAndPeopleModalOpen] = useState(false);
    const { deleteCandidatesAndPeople } = useExecuteDeleteCandidatesAndPeople();


    console.log("The objectMetadataItem is::", objectMetadataItem);
    const handleDeleteCandidatesAndPeopleClick = useCallback(async () => {
      const recordsToCreateVideoInterviewLinks = await fetchAllRecordIds();
      const recordIdsToCreateVideoInterviewLinks:string[] = recordsToCreateVideoInterviewLinks.map((record) => record.id);
      console.log("Records selected::", recordsToCreateVideoInterviewLinks, "Record IDs selected::", recordIdsToCreateVideoInterviewLinks);
      await deleteCandidatesAndPeople(recordIdsToCreateVideoInterviewLinks );
    }, [deleteCandidatesAndPeople, fetchAllRecordIds]);




    const onClick = () => {
      if (!shouldBeRegistered) {
        return;
      }
      setIsDeleteCandidatesAndPeopleModalOpen(true);
    };

    const confirmationModal = (
      <ConfirmationModal
        isOpen={isDeleteCandidatesAndPeopleModalOpen}
        setIsOpen={setIsDeleteCandidatesAndPeopleModalOpen}
        title={'Delete Multiple Candidates and People'}
        subtitle={`Are you sure you want to delete multiple candidates and people?`}
        onConfirmClick={handleDeleteCandidatesAndPeopleClick}
        deleteButtonText={'Delete Multiple Candidates and People'}
        confirmButtonAccent = 'danger'
      />
    );

    return {
      shouldBeRegistered,
      onClick,
      ConfirmationModal: confirmationModal,
    };
  };
