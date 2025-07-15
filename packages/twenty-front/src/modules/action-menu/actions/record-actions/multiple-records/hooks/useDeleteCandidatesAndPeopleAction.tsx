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
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { useCallback, useState } from 'react';
import { isDefined } from 'twenty-shared';

export const useDeleteCandidatesAndPeopleAction: ActionHookWithObjectMetadataItem = ({ objectMetadataItem }) => { 
  const { enqueueSnackBar } = useSnackBar();
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
    const { deleteCandidatesAndPeople } = useExecuteDeleteCandidatesAndPeople({
      objectNameSingular: objectMetadataItem.nameSingular,
    });

    const [isProcessing, setIsProcessing] = useState(false);

    const resetState = useCallback(() => {
      setIsProcessing(false);
    }, []);

    const handleDeleteCandidatesAndPeopleClick = useCallback(async () => {
      if (isProcessing) {
        enqueueSnackBar('A delete operation is already in progress', {
          variant: SnackBarVariant.Warning,
          duration: 3000,
        });
        return;
      }

      try {
        setIsProcessing(true);
        const recordsToDelete = await fetchAllRecordIds();

        if (!recordsToDelete || recordsToDelete.length === 0) {
          enqueueSnackBar('No records selected for deletion', {
            variant: SnackBarVariant.Warning,
            duration: 3000,
          });
          return;
        }

        const recordIdsToDelete = recordsToDelete.map((record) => record.id);
        await deleteCandidatesAndPeople(recordIdsToDelete);
        
        enqueueSnackBar('Records deleted successfully', {
          variant: SnackBarVariant.Success,
          duration: 3000,
        });
        
        setIsDeleteCandidatesAndPeopleModalOpen(false);
      } catch (error) {
        console.error('Error deleting records:', error);
        enqueueSnackBar(error instanceof Error ? error.message : 'Failed to delete records', {
          variant: SnackBarVariant.Error,
          duration: 5000,
        });
      } finally {
        setIsProcessing(false);
      }
    }, [deleteCandidatesAndPeople, fetchAllRecordIds, enqueueSnackBar, isProcessing]);

    const onClick = () => {
      console.log('Delete Candidates and People onClick triggered', {
        shouldBeRegistered,
        contextStoreNumberOfSelectedRecords,
        isRemoteObject,
      });

      if (!shouldBeRegistered) {
        enqueueSnackBar('Cannot delete records - no records selected or too many records selected', {
          variant: SnackBarVariant.Warning,
          duration: 3000,
        });
        return;
      }
      resetState();
      setIsDeleteCandidatesAndPeopleModalOpen(true);
    };

    const confirmationModal = (
      <ConfirmationModal
        isOpen={isDeleteCandidatesAndPeopleModalOpen}
        setIsOpen={(isOpen) => {
          setIsDeleteCandidatesAndPeopleModalOpen(isOpen);
          if (!isOpen) {
            resetState();
          }
        }}
        title={'Delete Multiple Candidates and People'}
        subtitle={`Are you sure you want to delete ${contextStoreNumberOfSelectedRecords} selected record(s)?`}
        onConfirmClick={handleDeleteCandidatesAndPeopleClick}
        deleteButtonText={'Delete Multiple Candidates and People'}
        confirmButtonAccent='danger'
        loading={isProcessing}
      />
    );

    return {
      shouldBeRegistered,
      onClick,
      ConfirmationModal: confirmationModal,
      isLoading: isProcessing,
    }
  };
