import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { contextStoreFiltersComponentState } from '@/context-store/states/contextStoreFiltersComponentState';
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { computeContextStoreFilters } from '@/context-store/utils/computeContextStoreFilters';
import { DEFAULT_QUERY_PAGE_SIZE } from '@/object-record/constants/DefaultQueryPageSize';
import { useLazyFetchAllRecords } from '@/object-record/hooks/useLazyFetchAllRecords';
import { useUpdateSnapshotProfilesFromJobBoards } from '@/object-record/hooks/useUpdateSnapshotProfilesFromJobBoards';
import { useFilterValueDependencies } from '@/object-record/record-filter/hooks/useFilterValueDependencies';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { useCallback, useState } from 'react';

export const useUpdateSnapshotProfilesFromJobBoardsAction: ActionHookWithObjectMetadataItem = ({ objectMetadataItem }) => { 
  console.log('objectMetadataItem for update snapshot profiles from job boards::', objectMetadataItem);
    
  // Add debugging IIFE to immediately check if the component is rendered
  (() => {
    console.log('UPDATE_SNAPSHOT_PROFILES_ACTION HOOK EXECUTED');
  })();
  
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

    const gqlFields = objectMetadataItem.nameSingular.toLowerCase().includes('candidate') && 
      !objectMetadataItem.nameSingular.toLowerCase().includes('jobcandidate')
        ? { id: true, peopleId: true, uniqueStringKey: true, source: true }
        : { id: true, candidateId: true, personId: true, uniqueStringKey: true, source: true };
    
    const { fetchAllRecords: fetchAllRecordIds } = useLazyFetchAllRecords({
      objectNameSingular: objectMetadataItem.nameSingular,
      filter: graphqlFilter,
      limit: DEFAULT_QUERY_PAGE_SIZE,
      recordGqlFields:gqlFields,
    });

    const isRemoteObject = objectMetadataItem.isRemote;
    
    // Always register the action
    const shouldBeRegistered = true;
    
    console.log('shouldBeRegistered:', shouldBeRegistered);
    
    const [isUpdateSnapshotProfilesModalOpen, setIsUpdateSnapshotProfilesModalOpen] = useState(false);
    const { updateSnapshotProfiles } = useUpdateSnapshotProfilesFromJobBoards({
      onSuccess: () => {},
      onError: () => {},
    });

    const handleUpdateSnapshotProfilesClick = useCallback(async () => {
      const recordsToUpdate = await fetchAllRecordIds();
      
      // Filter records with source 'resdex_naukri'
      const naukriRecords = recordsToUpdate.filter(record => record.source === 'resdex_naukri');
      
      if (naukriRecords.length > 10) {
        // Show error modal for more than 10 profiles
        window.postMessage({
          type: 'SHOW_ERROR_MODAL',
          message: 'Cannot send more than 10 profiles at once'
        }, '*');
        return;
      }

      if (naukriRecords.length > 0) {
        // Send Naukri records to extension
        const data = {
          type: 'FETCH_NAUKRI_PROFILES',
          urls: naukriRecords.map(record => record.uniqueStringKey),
          current_table_id: objectMetadataItem.id,
          text: JSON.stringify(naukriRecords),
          columns: Object.keys(gqlFields),
        };
        window.postMessage(data, '*');
        return;
      }

      // For non-Naukri records, proceed with normal update
      let candidateIdsToUpdate: string[] = [];
      let personIdsToUpdate: string[] = [];
      let uniqueStringKeysToUpdate: string[] = [];

      candidateIdsToUpdate = objectMetadataItem.nameSingular.toLowerCase().includes('candidate') && 
        !objectMetadataItem.nameSingular.toLowerCase().includes('jobcandidate')
        ? recordsToUpdate.map((record) => record.id)
        : objectMetadataItem.nameSingular.toLowerCase().includes('jobcandidate')
          ? recordsToUpdate.map((record) => record.candidateId)
          : [];

      personIdsToUpdate = objectMetadataItem.nameSingular.toLowerCase().includes('candidate') && 
        !objectMetadataItem.nameSingular.toLowerCase().includes('jobcandidate')
        ? recordsToUpdate.map((record) => record.peopleId)
        : objectMetadataItem.nameSingular.toLowerCase().includes('jobcandidate')
          ? recordsToUpdate.map((record) => record.personId)
          : [];

      uniqueStringKeysToUpdate = objectMetadataItem.nameSingular.toLowerCase().includes('candidate') && 
        !objectMetadataItem.nameSingular.toLowerCase().includes('jobcandidate')
        ? recordsToUpdate.map((record) => record.uniqueStringKey)
        : objectMetadataItem.nameSingular.toLowerCase().includes('jobcandidate')
          ? recordsToUpdate.map((record) => record.uniqueStringKey)
          : [];

      await updateSnapshotProfiles(
        candidateIdsToUpdate,
        uniqueStringKeysToUpdate,
        personIdsToUpdate,
        objectMetadataItem.nameSingular,
      );
    }, [fetchAllRecordIds, updateSnapshotProfiles, objectMetadataItem.nameSingular, objectMetadataItem.id]);

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

    console.log('Modal state at return:', isUpdateSnapshotProfilesModalOpen);

    return {
      shouldBeRegistered,
      onClick,
      ConfirmationModal: confirmationModal,
    };
};
