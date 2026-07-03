import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { searchResultsState } from '@/candidate-search/states/searchResultsState';
import { tableStateAtom } from '@/candidate-table/states/states';
import { contextStoreFiltersComponentState } from '@/context-store/states/contextStoreFiltersComponentState';
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { computeContextStoreFilters } from '@/context-store/utils/computeContextStoreFilters';
import { DEFAULT_QUERY_PAGE_SIZE } from '@/object-record/constants/DefaultQueryPageSize';
import { useLazyFetchAllRecords } from '@/object-record/hooks/useLazyFetchAllRecords';
import { useUpdateSnapshotProfilesFromJobBoards } from '@/object-record/hooks/useUpdateSnapshotProfilesFromJobBoards';
import { useFilterValueDependencies } from '@/object-record/record-filter/hooks/useFilterValueDependencies';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { useCallback, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { sleep } from '~/utils/sleep';

const randomWaitMs = (minMs: number, maxMs: number) => {
  const delayMs = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return sleep(delayMs);
};

export const useUpdateSnapshotProfilesFromJobBoardsAction: ActionHookWithObjectMetadataItem = ({ objectMetadataItem }) => { 
  const { enqueueSnackBar } = useSnackBar();
  const location = useLocation();
  const isJobRoute = location.pathname.includes('/job/');
  const tableState = useRecoilValue(tableStateAtom);
  const searchResults = useRecoilValue(searchResultsState);
  const [isUpdateSnapshotProfilesModalOpen, setIsUpdateSnapshotProfilesModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
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
      ? { id: true, peopleId: true, uniqueStringKey: true, source: true, resdexNaukriUrl: true, hiringNaukriUrl: true, linkedinUrl: true }
      : { id: true, candidateId: true, personId: true, uniqueStringKey: true, source: true, resdexNaukriUrl: true, hiringNaukriUrl: true, linkedinUrl: true };
    
  const { fetchAllRecords: fetchAllRecordIds } = useLazyFetchAllRecords({
    objectNameSingular: objectMetadataItem.nameSingular,
    filter: graphqlFilter,
    limit: DEFAULT_QUERY_PAGE_SIZE,
    recordGqlFields: gqlFields,
  });

  const shouldBeRegistered = true;
    
  const { updateSnapshotProfiles } = useUpdateSnapshotProfilesFromJobBoards({
    onSuccess: () => {
      enqueueSnackBar('Snapshot profiles updated successfully', {
        variant: SnackBarVariant.Success,
        duration: 3000,
      });
      setIsUpdateSnapshotProfilesModalOpen(false);
    },
    onError: (error) => {
      enqueueSnackBar(error instanceof Error ? error.message : 'Failed to update snapshot profiles', {
        variant: SnackBarVariant.Error,
        duration: 5000,
      });
    },
  });

  const resetState = useCallback(() => {
    setIsProcessing(false);
  }, []);

  const handleUpdateSnapshotProfilesClick = useCallback(async () => {
    if (isProcessing) {
      enqueueSnackBar('A profile update is already in progress', {
        variant: SnackBarVariant.Warning,
        duration: 3000,
      });
      return;
    }

    try {
      setIsProcessing(true);
      let recordsToUpdate;
      
      if (isJobRoute && tableState?.selectedRowIds?.length > 0) {
        const selectedIdsSet = new Set(tableState.selectedRowIds);
        
        // Filter database candidates (from rawData) - match by id
        const databaseCandidates = tableState.rawData.filter(record => 
          selectedIdsSet.has(record.id)
        );
        
        // Filter LinkedIn/search candidates (from searchResults) - match by id first, then tempId
        // Since selectedRowIds now prefers permanent id, check id first
        const searchCandidates = searchResults.filter((record) => {
          const recordId = record?.id;
          const recordTempId = record?.tempId;
          // Check if selectedRowIds contains either the permanent id or tempId
          return (recordId && selectedIdsSet.has(recordId)) || 
                 (recordTempId && selectedIdsSet.has(recordTempId));
        });
        
        // Merge both types of candidates
        recordsToUpdate = [...databaseCandidates, ...searchCandidates];
      } else {
        recordsToUpdate = await fetchAllRecordIds();
      }
      
      if (!recordsToUpdate || recordsToUpdate.length === 0) {
        enqueueSnackBar('No records selected to update', {
          variant: SnackBarVariant.Warning,
          duration: 3000,
        });
        return;
      }

      const naukriRecords = recordsToUpdate.filter((record: any) =>
        (record as any)?.source?.includes('naukri') ||
        record.hiringNaukriUrl?.primaryLinkUrl?.trim() ||
        record.resdexNaukriUrl?.primaryLinkUrl?.trim(),
      );
      
      if (naukriRecords.length > 10) {
        enqueueSnackBar('Please select no more than 10 profiles to update at once', {
          variant: SnackBarVariant.Error,
          duration: 3000,
        });
        return;
      }

      if (naukriRecords.length > 0) {
        const naukriProfileEntries = naukriRecords
          .map((record) => ({
            record,
            url:
              record.hiringNaukriUrl?.primaryLinkUrl?.trim() ||
              record.resdexNaukriUrl?.primaryLinkUrl?.trim(),
          }))
          .filter(
            (entry): entry is { record: (typeof naukriRecords)[number]; url: string } =>
              Boolean(entry.url),
          );

        if (naukriProfileEntries.length > 0) {
          for (let index = 0; index < naukriProfileEntries.length; index++) {
            if (index > 0) {
              await randomWaitMs(1000, 4000);
            }
            const { record, url } = naukriProfileEntries[index];
            window.postMessage({
              type: 'FETCH_NAUKRI_PROFILES',
              urls: [url],
              current_table_id: objectMetadataItem.id,
              text: JSON.stringify([record]),
              columns: Object.keys(gqlFields),
            }, '*');
          }
          return;
        }
      }

      let candidateIdsToUpdate: string[] = [];
      let personIdsToUpdate: string[] = [];
      let uniqueStringKeysToUpdate: string[] = [];

      if (objectMetadataItem.nameSingular.toLowerCase().includes('candidate') && 
          !objectMetadataItem.nameSingular.toLowerCase().includes('jobcandidate')) {
        candidateIdsToUpdate = recordsToUpdate.map((record: any) => record.id);
        personIdsToUpdate = recordsToUpdate.map((record: any) => (record as any)?.peopleId).filter(Boolean);
        uniqueStringKeysToUpdate = recordsToUpdate.map((record: any) => (record as any)?.uniqueStringKey).filter(Boolean);
      } else if (objectMetadataItem.nameSingular.toLowerCase().includes('jobcandidate')) {
        candidateIdsToUpdate = recordsToUpdate.map((record: any) => (record as any)?.candidateId).filter(Boolean);
        personIdsToUpdate = recordsToUpdate.map((record: any) => (record as any)?.personId).filter(Boolean);
        uniqueStringKeysToUpdate = recordsToUpdate.map((record: any) => (record as any)?.uniqueStringKey).filter(Boolean);
      }

      await updateSnapshotProfiles(
        candidateIdsToUpdate,
        uniqueStringKeysToUpdate,
        personIdsToUpdate,
        objectMetadataItem.nameSingular,
      );
    } catch (error) {
      console.error('Error updating snapshot profiles:', error);
      enqueueSnackBar(error instanceof Error ? error.message : 'Failed to update snapshot profiles', {
        variant: SnackBarVariant.Error,
        duration: 5000,
      });
    } finally {
      setIsProcessing(false);
    }
  }, [
    isProcessing,
    isJobRoute,
    tableState,
    searchResults,
    fetchAllRecordIds,
    updateSnapshotProfiles,
    objectMetadataItem.id,
    objectMetadataItem.nameSingular,
    gqlFields,
    enqueueSnackBar,
  ]);

  const onClick = () => {
    if (!shouldBeRegistered) {
      return;
    }
    resetState();
    setIsUpdateSnapshotProfilesModalOpen(true);
  };

  const confirmationModal = (
    <ConfirmationModal
      isOpen={isUpdateSnapshotProfilesModalOpen}
      setIsOpen={(isOpen) => {
        setIsUpdateSnapshotProfilesModalOpen(isOpen);
        if (!isOpen) {
          resetState();
        }
      }}
      title={'Update Snapshot Profiles'}
      subtitle={`Are you sure you want to update snapshot profiles for ${contextStoreNumberOfSelectedRecords} selected record(s)?`}
      onConfirmClick={handleUpdateSnapshotProfilesClick}
      deleteButtonText={'Update Snapshots'}
      confirmButtonAccent='blue'
      loading={isProcessing}
    />
  );

  return {
    shouldBeRegistered,
    onClick,
    ConfirmationModal: confirmationModal,
    isLoading: isProcessing,
  };
};
