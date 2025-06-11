import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
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
    const [isDownloadCandidateCVsModalOpen, setIsDownloadCandidateCVsModalOpen] =
      useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const { sendDownloadCVsRequest, loading: downloadLoading } = useDownloadCVs({
      onSuccess: () => {
        enqueueSnackBar('Candidate CVs download started.', {
          variant: SnackBarVariant.Success,
          duration: 5000,
        });
        setIsDownloadCandidateCVsModalOpen(false);
      },
      onError: (error) => {
        enqueueSnackBar(`Failed to download CVs: ${error.message}`, {
          variant: SnackBarVariant.Error,
          duration: 5000,
        });
      },
    });

    const handleDownloadCandidateCVsClick = useCallback(async () => {
      try {


        setIsProcessing(true);
        let recordsToProcess;

        enqueueSnackBar('Beginning to download candidate CVs.', {
          variant: SnackBarVariant.Success,
          duration: 5000,
        });
    

        if (isJobRoute && tableState && tableState.selectedRowIds && tableState.selectedRowIds.length > 0) {
          recordsToProcess = tableState.rawData.filter((record) =>
            tableState.selectedRowIds.includes(record.id),
          );
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

        const candidateIdsToDownload: string[] = recordsToProcess.map(
          (record) => record.id,
        );

        await sendDownloadCVsRequest(candidateIdsToDownload);
      } catch (error) {
        console.error('Error preparing to download CVs:', error);
        enqueueSnackBar('An error occurred while preparing the CV download.', {
            variant: SnackBarVariant.Error,
            duration: 5000,
        });
      } finally {
        setIsProcessing(false);
      }
    }, [
      sendDownloadCVsRequest,
      fetchAllRecordObjects,
      objectMetadataItem.nameSingular,
      isJobRoute,
      tableState,
      enqueueSnackBar,
    ]);

    const onClick = async () => {
      if (!shouldBeRegistered) {
        return;
      }
      setIsDownloadCandidateCVsModalOpen(true);
    };

    const confirmationModal = (
      <ConfirmationModal
        isOpen={isDownloadCandidateCVsModalOpen}
        setIsOpen={setIsDownloadCandidateCVsModalOpen}
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
