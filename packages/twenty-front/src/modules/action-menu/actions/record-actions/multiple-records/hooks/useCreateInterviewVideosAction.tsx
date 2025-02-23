import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { contextStoreFiltersComponentState } from '@/context-store/states/contextStoreFiltersComponentState';
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { computeContextStoreFilters } from '@/context-store/utils/computeContextStoreFilters';
import { BACKEND_BATCH_REQUEST_MAX_COUNT } from '@/object-record/constants/BackendBatchRequestMaxCount';
import { DEFAULT_QUERY_PAGE_SIZE } from '@/object-record/constants/DefaultQueryPageSize';
import { useCreateInterviewVideos } from '@/object-record/hooks/useCreateInterviewVideos';
import { useLazyFetchAllRecords } from '@/object-record/hooks/useLazyFetchAllRecords';
import { useFilterValueDependencies } from '@/object-record/record-filter/hooks/useFilterValueDependencies';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { useCallback, useState } from 'react';
import { isDefined } from 'twenty-shared';

export const useCreateInterviewVideosAction: ActionHookWithObjectMetadataItem =
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

    const [isCreateVideosModalOpen, setIsCreateVideosModalOpen] = useState(false);

    const { createVideosForJobs } = useCreateInterviewVideos({});

    const handleCreateVideosClick = useCallback(async () => {
      const recordsToProcess = await fetchAllRecordIds();
      const recordIdsToProcess = recordsToProcess.map((record) => record.id);
      await createVideosForJobs(recordIdsToProcess);
    }, [createVideosForJobs, fetchAllRecordIds]);

    const onClick = () => {
      if (!shouldBeRegistered) {
      return;
      }
      setIsCreateVideosModalOpen(true);
    };

    const confirmationModal = (
      <ConfirmationModal
      isOpen={isCreateVideosModalOpen}
      setIsOpen={setIsCreateVideosModalOpen}
      title={'Create Interviewer Avatar Videos'}
      subtitle={`Are you sure you want to create interview videos for the selected records?`}
      onConfirmClick={handleCreateVideosClick}
      deleteButtonText={'Create Videos'}
      confirmButtonAccent="blue"
      />
    );

    return {
      shouldBeRegistered,
      onClick,
      ConfirmationModal: confirmationModal,
    };
    };
