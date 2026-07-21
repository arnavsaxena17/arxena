import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { tableStateAtom } from '@/candidate-table/states/states';
import { contextStoreFiltersComponentState } from '@/context-store/states/contextStoreFiltersComponentState';
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { computeContextStoreFilters } from '@/context-store/utils/computeContextStoreFilters';
import { BACKEND_BATCH_REQUEST_MAX_COUNT } from '@/object-record/constants/BackendBatchRequestMaxCount';
import { DEFAULT_QUERY_PAGE_SIZE } from '@/object-record/constants/DefaultQueryPageSize';
import { useLazyFetchAllRecords } from '@/object-record/hooks/useLazyFetchAllRecords';
import { useFilterValueDependencies } from '@/object-record/record-filter/hooks/useFilterValueDependencies';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { useCallback, useState, lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { isDefined } from 'twenty-shared';

const ShortlistEditModal = lazy(() =>
  import('../components/ShortlistEditModal').then((module) => ({
    default: module.ShortlistEditModal,
  })),
);

export const useShareChatAndVideoInterviewBasedShortlistAction: ActionHookWithObjectMetadataItem = ({ objectMetadataItem }) => {
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

  const location = useLocation();
  const isJobRoute = location.pathname.includes('/job/');
  const tableState = useRecoilValue(tableStateAtom);

  const isRemoteObject = objectMetadataItem.isRemote;
  const numberOfSelectedRecords = isJobRoute ? tableState?.selectedRowIds?.length : contextStoreNumberOfSelectedRecords;

  const shouldBeRegistered =
    !isRemoteObject &&
    ((isJobRoute && isDefined(numberOfSelectedRecords) && numberOfSelectedRecords > 0) ||
    (!isJobRoute && isDefined(contextStoreNumberOfSelectedRecords) && 
    contextStoreNumberOfSelectedRecords < BACKEND_BATCH_REQUEST_MAX_COUNT &&
    contextStoreNumberOfSelectedRecords > 0));
    
  const [isShareChatAndVideoInterviewBasedShortlistModalOpen, setIsShareChatAndVideoInterviewBasedShortlistModalOpen] = useState(false);

  const onClick = () => {
    setIsShareChatAndVideoInterviewBasedShortlistModalOpen(true);
  };

  const getSelectedCandidateIds = useCallback(() => {
    if (isJobRoute && tableState) {
      return tableState.selectedRowIds;
    } else {
      // For non-job routes, we'd need to get the selected IDs from context
      return [];
    }
  }, [isJobRoute, tableState]);

  const getJobId = useCallback(() => {
    if (isJobRoute) {
      // Extract job ID from URL or get it from table state
      const pathParts = location.pathname.split('/');
      const jobIndex = pathParts.findIndex(part => part === 'job');
      return jobIndex !== -1 ? pathParts[jobIndex + 1] : null;
    }
    return null;
  }, [isJobRoute, location.pathname]);

  const shortlistModal = isShareChatAndVideoInterviewBasedShortlistModalOpen ? (
    <Suspense fallback={null}>
      <ShortlistEditModal
        isOpen={isShareChatAndVideoInterviewBasedShortlistModalOpen}
        onClose={() => setIsShareChatAndVideoInterviewBasedShortlistModalOpen(false)}
        candidateIds={getSelectedCandidateIds()}
        jobId={getJobId() || ''}
      />
    </Suspense>
  ) : null;

  return {
    shouldBeRegistered,
    onClick,
    ConfirmationModal: shortlistModal,
  };
};
