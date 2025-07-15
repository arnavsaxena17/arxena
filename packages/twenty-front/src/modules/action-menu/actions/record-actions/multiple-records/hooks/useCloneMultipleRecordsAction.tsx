import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { contextStoreFiltersComponentState } from '@/context-store/states/contextStoreFiltersComponentState';
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { computeContextStoreFilters } from '@/context-store/utils/computeContextStoreFilters';
import { BACKEND_BATCH_REQUEST_MAX_COUNT } from '@/object-record/constants/BackendBatchRequestMaxCount';
import { DEFAULT_QUERY_PAGE_SIZE } from '@/object-record/constants/DefaultQueryPageSize';
import { useCloneMultipleRecords } from '@/object-record/hooks/useCloneMultipleRecords';
import { useLazyFetchAllRecords } from '@/object-record/hooks/useLazyFetchAllRecords';
import { useFilterValueDependencies } from '@/object-record/record-filter/hooks/useFilterValueDependencies';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { useCallback, useState } from 'react';
import { isDefined } from 'twenty-shared';

export const useCloneMultipleRecordsAction: ActionHookWithObjectMetadataItem =
  ({ objectMetadataItem }) => {
    const { enqueueSnackBar } = useSnackBar();
    const [isCloneMultipleRecordsModalOpen, setIsCloneMultipleRecordsModalOpen] = useState(false);
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

    const { cloneMultipleRecords } = useCloneMultipleRecords({
      objectNameSingular: objectMetadataItem.nameSingular,
      recordGqlFields: { id: true },
      skipPostOptimisticEffect: false,
    });

    const resetState = useCallback(() => {
      setIsProcessing(false);
    }, []);

    const handleCloneMultipleRecordsClick = useCallback(async () => {
      if (isProcessing) {
        enqueueSnackBar('A clone operation is already in progress', {
          variant: SnackBarVariant.Warning,
          duration: 3000,
        });
        return;
      }

      try {
        setIsProcessing(true);
        const recordsToClone = await fetchAllRecordIds();

        if (!recordsToClone || recordsToClone.length === 0) {
          enqueueSnackBar('No records selected to clone', {
            variant: SnackBarVariant.Warning,
            duration: 3000,
          });
          return;
        }

        const recordIdsToClone = recordsToClone.map((record) => record.id);
        await cloneMultipleRecords(recordIdsToClone);

        enqueueSnackBar('Records cloned successfully', {
          variant: SnackBarVariant.Success,
          duration: 3000,
        });

        setIsCloneMultipleRecordsModalOpen(false);
      } catch (error) {
        console.error('Error cloning records:', error);
        enqueueSnackBar(error instanceof Error ? error.message : 'Failed to clone records', {
          variant: SnackBarVariant.Error,
          duration: 5000,
        });
      } finally {
        setIsProcessing(false);
      }
    }, [cloneMultipleRecords, fetchAllRecordIds, enqueueSnackBar, isProcessing]);

    const onClick = () => {
      if (!shouldBeRegistered) {
        return;
      }
      resetState();
      setIsCloneMultipleRecordsModalOpen(true);
    };

    const confirmationModal = (
      <ConfirmationModal
        isOpen={isCloneMultipleRecordsModalOpen}
        setIsOpen={(isOpen) => {
          setIsCloneMultipleRecordsModalOpen(isOpen);
          if (!isOpen) {
            resetState();
          }
        }}
        title={'Clone Multiple Records'}
        subtitle={`Are you sure you want to clone ${contextStoreNumberOfSelectedRecords} selected record(s)?`}
        onConfirmClick={handleCloneMultipleRecordsClick}
        deleteButtonText={'Clone Multiple Records'}
        confirmButtonAccent="danger"
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
