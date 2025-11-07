import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { searchResultsState } from '@/candidate-search/states/searchResultsState';
import { tableStateAtom } from '@/candidate-table/states/states';
import { contextStoreFiltersComponentState } from '@/context-store/states/contextStoreFiltersComponentState';
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { computeContextStoreFilters } from '@/context-store/utils/computeContextStoreFilters';
import { DEFAULT_QUERY_PAGE_SIZE } from '@/object-record/constants/DefaultQueryPageSize';
import { useDownloadCVs } from '@/object-record/hooks/useDownloadCVs';
import { useLazyFetchAllRecords } from '@/object-record/hooks/useLazyFetchAllRecords';
import { useFilterValueDependencies } from '@/object-record/record-filter/hooks/useFilterValueDependencies';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { useCallback, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRecoilValue } from 'recoil';

export const useDownloadCandidateCVsAction: ActionHookWithObjectMetadataItem =
  ({ objectMetadataItem }) => {

    const { enqueueSnackBar } = useSnackBar();

    const location = useLocation();
    const isJobRoute = location.pathname.includes('/job/');
    const tableState = useRecoilValue(tableStateAtom);
    const searchResults = useRecoilValue(searchResultsState);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isDownloadCandidateCVsModalOpen, setIsDownloadCandidateCVsModalOpen] = useState(false);

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

    const { fetchAllRecords: fetchAllRecordObjects } = useLazyFetchAllRecords<{
      id: string;
      [key: string]: any; // Allow other properties
    }>({
      objectNameSingular: objectMetadataItem.nameSingular,
      filter: graphqlFilter,
      limit: DEFAULT_QUERY_PAGE_SIZE, // Consider if all records are needed or just IDs
    });

    const shouldBeRegistered = true;

    const { sendDownloadCVsRequest, loading: downloadLoading, resetState } = useDownloadCVs({
      onSuccess: () => {
        enqueueSnackBar('CVs downloaded successfully.', {
          variant: SnackBarVariant.Success,
          duration: 5000,
        });
        setIsDownloadCandidateCVsModalOpen(false);
        setIsProcessing(false);
      },
      onError: (error) => {
        enqueueSnackBar(`Failed to download CVs: ${error.message}`, {
          variant: SnackBarVariant.Error,
          duration: 5000,
        });
        setIsProcessing(false);
      },
    });

    const handleDownloadCandidateCVsClick = useCallback(async () => {
      if (isProcessing) return;

      try {
        setIsProcessing(true);
        let recordsToProcess;

        if (isJobRoute && tableState && tableState.selectedRowIds && tableState.selectedRowIds.length > 0) {
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
          recordsToProcess = [...databaseCandidates, ...searchCandidates];
        } else {
          recordsToProcess = await fetchAllRecordObjects();
        }

        if (!recordsToProcess || recordsToProcess.length === 0) {
          enqueueSnackBar('No candidates selected or found to download CVs.', {
            variant: SnackBarVariant.Warning,
            duration: 3000,
          });
          setIsProcessing(false);
          setIsDownloadCandidateCVsModalOpen(false);
          return;
        }

        if (objectMetadataItem.nameSingular.toLowerCase() !== 'candidate') {
          enqueueSnackBar('This action is only available for Candidate records.', {
            variant: SnackBarVariant.Error,
            duration: 5000,
          });
          setIsProcessing(false);
          return;
        }

        const candidateIdsToDownload = recordsToProcess
          .map((record) => (record as { tempId?: string; id: string | null }).tempId || record.id)
          .filter((id): id is string => id !== null && id !== undefined);

        await sendDownloadCVsRequest(candidateIdsToDownload);
      } catch (error) {
        console.error('Error preparing to download CVs:', error);
        enqueueSnackBar('An error occurred while preparing the CV download.', {
          variant: SnackBarVariant.Error,
          duration: 5000,
        });
        setIsProcessing(false);
      }
    }, [
      sendDownloadCVsRequest,
      fetchAllRecordObjects,
      objectMetadataItem.nameSingular,
      isJobRoute,
      tableState,
      searchResults,
      enqueueSnackBar,
      isProcessing,
    ]);

    const onClick = () => {
      if (!shouldBeRegistered) {
        return;
      }
      resetState();
      setIsDownloadCandidateCVsModalOpen(true);
    };

    const confirmationModal = (
      <ConfirmationModal
        isOpen={isDownloadCandidateCVsModalOpen}
        setIsOpen={(isOpen) => {
          setIsDownloadCandidateCVsModalOpen(isOpen);
          if (!isOpen) {
            resetState();
            setIsProcessing(false);
          }
        }}
        title={'Download Candidate CVs'}
        subtitle={
          `Are you sure you want to download CVs for the selected ${contextStoreNumberOfSelectedRecords > 0 ? contextStoreNumberOfSelectedRecords : ''} candidate(s)?`
        }
        onConfirmClick={handleDownloadCandidateCVsClick}
        deleteButtonText={'Download CVs'}
        confirmButtonAccent="blue"
        loading={isProcessing || downloadLoading}
      />
    );

    return {
      shouldBeRegistered,
      onClick,
      ConfirmationModal: confirmationModal,
      isLoading: isProcessing || downloadLoading,
    };
  };
