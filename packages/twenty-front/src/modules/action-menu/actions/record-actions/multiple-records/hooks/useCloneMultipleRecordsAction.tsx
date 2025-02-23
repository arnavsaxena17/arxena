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
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { useCallback, useState } from 'react';
import { isDefined } from 'twenty-shared';

export const useCloneMultipleRecordsAction: ActionHookWithObjectMetadataItem =
  ({ objectMetadataItem }) => {
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

    const [
      isDeleteCandidatesAndPeopleModalOpen,
      setIsDeleteCandidatesAndPeopleModalOpen,
    ] = useState(false);
    const { cloneMultipleRecords } = useCloneMultipleRecords({
      objectNameSingular: objectMetadataItem.nameSingular,
      recordGqlFields: { id: true },
      skipPostOptimisticEffect: false,
    });

    const handleCloneMultipleRecordsClick = useCallback(async () => {
      const recordsToClone = await fetchAllRecordIds();
      const recordIdsToClone = recordsToClone.map((record) => record.id);
      await cloneMultipleRecords(recordIdsToClone);
    }, [cloneMultipleRecords, fetchAllRecordIds]);

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
        title={'Clone Multiple Records'}
        subtitle={`Are you sure you want to clone multiple records?`}
        onConfirmClick={handleCloneMultipleRecordsClick}
        deleteButtonText={'Clone Multiple Records'}
        confirmButtonAccent="danger"
      />
    );

    return {
      shouldBeRegistered,
      onClick,
      ConfirmationModal: confirmationModal,
    };
  };
