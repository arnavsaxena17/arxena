import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { contextStoreFiltersComponentState } from '@/context-store/states/contextStoreFiltersComponentState';
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { computeContextStoreFilters } from '@/context-store/utils/computeContextStoreFilters';
import { BACKEND_BATCH_REQUEST_MAX_COUNT } from '@/object-record/constants/BackendBatchRequestMaxCount';
import { DEFAULT_QUERY_PAGE_SIZE } from '@/object-record/constants/DefaultQueryPageSize';
import { useLazyFetchAllRecords } from '@/object-record/hooks/useLazyFetchAllRecords';
import { useUpdateSnapshotProfilesFromJobBoards } from '@/object-record/hooks/useUpdateSnapshotProfilesFromJobBoards';
import { useFilterValueDependencies } from '@/object-record/record-filter/hooks/useFilterValueDependencies';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { useCallback, useState } from 'react';
import { isDefined } from 'twenty-shared';

export const useUpdateSnapshotProfilesFromJobBoardsAction: ActionHookWithObjectMetadataItem = ({ objectMetadataItem }) => { 
    
  
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
      recordGqlFields: { id: true, candidateId:true, personId:true, uniqueStringKey:true },
    });

    const isRemoteObject = objectMetadataItem.isRemote;
    const shouldBeRegistered =
    !isRemoteObject &&
    isDefined(contextStoreNumberOfSelectedRecords) &&
    contextStoreNumberOfSelectedRecords < BACKEND_BATCH_REQUEST_MAX_COUNT &&
    contextStoreNumberOfSelectedRecords > 0;
    
    
    const [isUpdateSnapshotProfilesModalOpen, setIsUpdateSnapshotProfilesModalOpen] = useState(false);
    const { updateSnapshotProfiles } = useUpdateSnapshotProfilesFromJobBoards({
      onSuccess: () => {},
      onError: () => {},
    });

    console.log("The objectMetadataItem is::", objectMetadataItem);
    const handleUpdateSnapshotProfilesClick = useCallback(async () => {
      const recordsToUpdate = await fetchAllRecordIds();
      console.log("recordsToUpdate::", recordsToUpdate);
      let candidateIdsToUpdate: string[] = [];
      let personIdsToUpdate: string[] = [];
      let uniqueStringKeysToUpdate: string[] = [];
      // candidateIdsToUpdate = objectMetadataItem.nameSingular.toLowerCase().includes('jobcandidate')
      // ? recordsToUpdate.map((record) => record.candidateId)
      // : recordsToUpdate.map((record) => record.id);

      candidateIdsToUpdate = objectMetadataItem.nameSingular.toLowerCase().includes('candidate') && 
        !objectMetadataItem.nameSingular.toLowerCase().includes('jobcandidate')
        ? recordsToUpdate.map((record) => record.id)
        : objectMetadataItem.nameSingular.toLowerCase().includes('jobcandidate')
          ? recordsToUpdate.map((record) => record.candidateId)
          : [];

          personIdsToUpdate = objectMetadataItem.nameSingular.toLowerCase().includes('candidate') && 
        !objectMetadataItem.nameSingular.toLowerCase().includes('jobcandidate')
        ? recordsToUpdate.map((record) => record.personId)
        : objectMetadataItem.nameSingular.toLowerCase().includes('jobcandidate')
          ? recordsToUpdate.map((record) => record.personId)
          : [];

          uniqueStringKeysToUpdate = objectMetadataItem.nameSingular.toLowerCase().includes('candidate') && 
        !objectMetadataItem.nameSingular.toLowerCase().includes('jobcandidate')
        ? recordsToUpdate.map((record) => record.uniqueStringKey)
        : objectMetadataItem.nameSingular.toLowerCase().includes('jobcandidate')
          ? recordsToUpdate.map((record) => record.uniqueStringKey)
          : [];


      // const personIdsToUpdate: string[] = objectMetadataItem.nameSingular.toLowerCase().includes('jobcandidate')
      // ? recordsToUpdate.map((record) => record.personId)
      // : recordsToUpdate.map((record) => record.id);

      // const uniqueStringKeysToUpdate: string[] = objectMetadataItem.nameSingular.toLowerCase().includes('jobcandidate')
      // ? recordsToUpdate.map((record) => record.uniqueStringKey)
      // : recordsToUpdate.map((record) => record.id);

      console.log("candidateIdsToUpdate::", candidateIdsToUpdate);
      console.log("personIdsToUpdate::", personIdsToUpdate);
      console.log("uniqueStringKeysToUpdate::", uniqueStringKeysToUpdate);
      await updateSnapshotProfiles(
        candidateIdsToUpdate,
        uniqueStringKeysToUpdate,
        personIdsToUpdate,
      objectMetadataItem.nameSingular,
      );
    }, [fetchAllRecordIds, updateSnapshotProfiles, objectMetadataItem.nameSingular]);

    const onClick = () => {
      if (!shouldBeRegistered) {
      return;
      }
      setIsUpdateSnapshotProfilesModalOpen(true);
    };

    const confirmationModal = (
      <ConfirmationModal
      isOpen={isUpdateSnapshotProfilesModalOpen}
      setIsOpen={setIsUpdateSnapshotProfilesModalOpen}
      title={'Update Snapshot Profiles'}
      subtitle={`Are you sure you want to update snapshot profiles?`}
      onConfirmClick={handleUpdateSnapshotProfilesClick}
      deleteButtonText={'Update Snapshot Profiles'}
      confirmButtonAccent='blue'
      />
    );

    return {
      shouldBeRegistered,
      onClick,
      ConfirmationModal: confirmationModal,
    };

  };
