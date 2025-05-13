import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { tableStateAtom } from '@/candidate-table/states';
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
import { useLocation } from 'react-router-dom';
import { useRecoilValue } from 'recoil';

export const useUpdateSnapshotProfilesFromJobBoardsAction: ActionHookWithObjectMetadataItem = ({ objectMetadataItem }) => { 
  console.log('objectMetadataItem for update snapshot profiles from job boards::', objectMetadataItem);
    
  // Add debugging IIFE to immediately check if the component is rendered
  (() => {
    console.log('UPDATE_SNAPSHOT_PROFILES_ACTION HOOK EXECUTED');
  })();
  
  const location = useLocation();
  const isJobRoute = location.pathname.includes('/job/');
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

    const gqlFields = objectMetadataItem.nameSingular.toLowerCase().includes('candidate') && 
      !objectMetadataItem.nameSingular.toLowerCase().includes('jobcandidate')
        ? { id: true, peopleId: true, uniqueStringKey: true, source: true ,  resdexNaukriUrl: true,hiringNaukriUrl: true, linkedinUrl: true }
        : { id: true, candidateId: true, personId: true, uniqueStringKey: true, source: true, resdexNaukriUrl: true,hiringNaukriUrl: true, linkedinUrl: true };
    
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
      let recordsToUpdate;
      
      if (isJobRoute && tableState) {
        // Use selected rows from HandsOnTable when in /job/ route
        recordsToUpdate = tableState.rawData.filter(record => 
          tableState.selectedRowIds.includes(record.id)
        );
        console.log('Selected records from table:', recordsToUpdate);
      } else {
        // Fallback to fetching all records for other routes
        recordsToUpdate = await fetchAllRecordIds();
      }
      
      console.log('recordsToUpdate length:', recordsToUpdate.length);
      // Filter records with source 'resdex_naukri'
      const naukriRecords = recordsToUpdate.filter(record => record.source.includes('naukri'));
      console.log('naukriRecords to filter with naukri:', naukriRecords);
      console.log('naukriRecords to filter with naukri length:', naukriRecords.length);
      
      if (naukriRecords.length > 10) {
        // Show error modal for more than 10 profiles
        window.postMessage({
          type: 'SHOW_ERROR_MODAL',
          message: 'Cannot send more than 10 profiles at once'
        }, '*');
        return;
      }

      console.log('naukriRecords length:', naukriRecords.length);
      
      if (naukriRecords.length > 0) {
        const urls = naukriRecords.map(record => record.hiringNaukriUrl.primaryLinkUrl.trim() || record.resdexNaukriUrl.primaryLinkUrl.trim());
        console.log('urls :', urls);
        console.log('naukriRecords:', naukriRecords);
        const data = {
          type: 'FETCH_NAUKRI_PROFILES',
          urls: urls,
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
          ? recordsToUpdate.map((record) => (record as any).candidateId ?? '')
          : [];

      personIdsToUpdate = objectMetadataItem.nameSingular.toLowerCase().includes('candidate') && 
        !objectMetadataItem.nameSingular.toLowerCase().includes('jobcandidate')
        ? recordsToUpdate.map((record) => (record as any)?.peopleId)
        : objectMetadataItem.nameSingular.toLowerCase().includes('jobcandidate')
          ? recordsToUpdate.map((record) => (record as any)?.personId)
          : [];

      uniqueStringKeysToUpdate = objectMetadataItem.nameSingular.toLowerCase().includes('candidate') && 
        !objectMetadataItem.nameSingular.toLowerCase().includes('jobcandidate')
        ? recordsToUpdate.map((record) => (record as any)?.uniqueStringKey)
        : objectMetadataItem.nameSingular.toLowerCase().includes('jobcandidate')
          ? recordsToUpdate.map((record) => (record as any)?.uniqueStringKey)
          : [];

      await updateSnapshotProfiles(
        candidateIdsToUpdate,
        uniqueStringKeysToUpdate,
        personIdsToUpdate,
        objectMetadataItem.nameSingular,
      );
    }, [fetchAllRecordIds, updateSnapshotProfiles, objectMetadataItem.nameSingular, objectMetadataItem.id, isJobRoute, tableState]);

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
