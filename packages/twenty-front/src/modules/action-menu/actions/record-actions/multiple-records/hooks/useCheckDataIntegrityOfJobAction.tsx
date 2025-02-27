import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { contextStoreFiltersComponentState } from '@/context-store/states/contextStoreFiltersComponentState';
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { computeContextStoreFilters } from '@/context-store/utils/computeContextStoreFilters';
import { BACKEND_BATCH_REQUEST_MAX_COUNT } from '@/object-record/constants/BackendBatchRequestMaxCount';
import { DEFAULT_QUERY_PAGE_SIZE } from '@/object-record/constants/DefaultQueryPageSize';
import { useCheckDataIntegrityOfJob } from '@/object-record/hooks/useCheckDataIntegrityOfJob';
import { useLazyFetchAllRecords } from '@/object-record/hooks/useLazyFetchAllRecords';
import { useFilterValueDependencies } from '@/object-record/record-filter/hooks/useFilterValueDependencies';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { useCallback, useState } from 'react';
import { isDefined } from 'twenty-shared';

export const useCheckDataIntegrityOfJobAction: ActionHookWithObjectMetadataItem =
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
      const [isCheckDataIntegrityModalOpen, setIsCheckDataIntegrityModalOpen] =
        useState(false);

      const { checkDataIntegrityOfJob } = useCheckDataIntegrityOfJob({});

      const handleCheckDataIntegrityClick = useCallback(async () => {
        const recordsToCheck = await fetchAllRecordIds();
        const recordIdsToCheck = recordsToCheck.map((record) => record.id);
        await checkDataIntegrityOfJob(recordIdsToCheck);
      }, [checkDataIntegrityOfJob, fetchAllRecordIds]);

      const onClick = () => {
        if (!shouldBeRegistered) {
          return;
        }
        setIsCheckDataIntegrityModalOpen(true);
      };

      const confirmationModal = (
        <ConfirmationModal
          isOpen={isCheckDataIntegrityModalOpen}
          setIsOpen={setIsCheckDataIntegrityModalOpen}
          title={'Check Data Integrity'}
          subtitle={`Are you sure you want to check data integrity of multiple records?`}
          onConfirmClick={handleCheckDataIntegrityClick}
          deleteButtonText={'Check Data Integrity'}
          confirmButtonAccent="blue"
        />
      );

      return {
        shouldBeRegistered,
        onClick,
        ConfirmationModal: confirmationModal,
      };
    };
