import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { contextStoreFiltersComponentState } from '@/context-store/states/contextStoreFiltersComponentState';
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { computeContextStoreFilters } from '@/context-store/utils/computeContextStoreFilters';
import { BACKEND_BATCH_REQUEST_MAX_COUNT } from '@/object-record/constants/BackendBatchRequestMaxCount';
import { DEFAULT_QUERY_PAGE_SIZE } from '@/object-record/constants/DefaultQueryPageSize';
import { useLazyFetchAllRecords } from '@/object-record/hooks/useLazyFetchAllRecords';
import { useTranscribeCall } from '@/object-record/hooks/useTranscribeCall';
import { useFilterValueDependencies } from '@/object-record/record-filter/hooks/useFilterValueDependencies';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { useCallback, useState } from 'react';
import { isDefined } from 'twenty-shared';

export const useTranscibeCallAction: ActionHookWithObjectMetadataItem =
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
      const [isTranscribeCallModalOpen, setIsTranscribeCallModalOpen] =
      useState(false);

      const { transcribeCall } = useTranscribeCall({
      });

      const handleTranscribeCallClick = useCallback(async () => {
      const recordsToTranscribe = await fetchAllRecordIds();
      const recordIdsToTranscribe = recordsToTranscribe.map((record) => record.id);
      await transcribeCall(recordIdsToTranscribe);
      }, [transcribeCall, fetchAllRecordIds]);

      const onClick = () => {
      if (!shouldBeRegistered) {
      return;
      }
      setIsTranscribeCallModalOpen(true);
      };

      const confirmationModal = (
      <ConfirmationModal
      isOpen={isTranscribeCallModalOpen}
      setIsOpen={setIsTranscribeCallModalOpen}
      title={'Transcribe Call'}
      subtitle={`Are you sure you want to transcribe this call?`}
      onConfirmClick={handleTranscribeCallClick}
      deleteButtonText={'Transcribe Call'}
      confirmButtonAccent="blue"
      />
      );

    return {
      shouldBeRegistered,
      onClick,
      ConfirmationModal: confirmationModal,
    };
    };
