import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { tableStateAtom } from '@/candidate-table/states/states';
import { contextStoreFiltersComponentState } from '@/context-store/states/contextStoreFiltersComponentState';
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { computeContextStoreFilters } from '@/context-store/utils/computeContextStoreFilters';
import { BACKEND_BATCH_REQUEST_MAX_COUNT } from '@/object-record/constants/BackendBatchRequestMaxCount';
import { DEFAULT_QUERY_PAGE_SIZE } from '@/object-record/constants/DefaultQueryPageSize';
import { useLazyFetchAllRecords } from '@/object-record/hooks/useLazyFetchAllRecords';
import { useSendCVsToClient } from '@/object-record/hooks/useSendCVsToClient';
import { useFilterValueDependencies } from '@/object-record/record-filter/hooks/useFilterValueDependencies';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { useCallback, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { isDefined } from 'twenty-shared';
export const useShareChatAndVideoInterviewBasedShortlistAction: ActionHookWithObjectMetadataItem = ({ objectMetadataItem }) => {
  console.log('objectMetadataItem for share chat and video interview based shortlist', objectMetadataItem);
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
    console.log('filterValueDependencies', filterValueDependencies);
    const graphqlFilter = computeContextStoreFilters(
      contextStoreTargetedRecordsRule,
      contextStoreFilters,
      objectMetadataItem,
      filterValueDependencies,
    );
    
    console.log('graphqlFilter', graphqlFilter);
    const { fetchAllRecords: fetchAllRecordIds } = useLazyFetchAllRecords({
      objectNameSingular: objectMetadataItem.nameSingular,
      filter: graphqlFilter,
      limit: DEFAULT_QUERY_PAGE_SIZE,
      recordGqlFields: { id: true },
    });

    const location = useLocation();
    const isJobRoute = location.pathname.includes('/job/');
    const tableState = useRecoilValue(tableStateAtom);
    console.log("tableState:::", tableState)

    let recordsToShare;
    console.log("tableState.rawData:::", tableState.rawData)
    // Fetch all records
    // const recordsToStartChat = await fetchAllRecordIds();


    if (isJobRoute && tableState) {
      // Use selected rows from HandsOnTable when in /job/ route
      recordsToShare = tableState.rawData.filter(record => 
        tableState.selectedRowIds.includes(record.id)
      );
      console.log('Selected records from table:', recordsToShare);
    } else {
      // Fallback to fetching all records for other routes
      recordsToShare =  fetchAllRecordIds();
    }

    console.log('fetchAllRecordIds', recordsToShare);
    const isRemoteObject = objectMetadataItem.isRemote;
    const shouldBeRegistered =
    !isRemoteObject &&
    isDefined(contextStoreNumberOfSelectedRecords) &&
    contextStoreNumberOfSelectedRecords < BACKEND_BATCH_REQUEST_MAX_COUNT &&
    contextStoreNumberOfSelectedRecords > 0;
    console.log('shouldBeRegistered', shouldBeRegistered);
    
    const [isShareChatAndVideoInterviewBasedShortlistModalOpen, setIsShareChatAndVideoInterviewBasedShortlistModalOpen] = useState(false);
    const { sendCVsToClient } = useSendCVsToClient();
    const { enqueueSnackBar } = useSnackBar();
    const handleShareChatAndVideoInterviewBasedShortlistClick = useCallback(async () => {
      // const recordsToShare = await fetchAllRecordIds();

      // console.log("recordsToShare:::", recordsToShare)

      enqueueSnackBar('Beginning to create shortlist PDF and Excel.', {
        variant: SnackBarVariant.Success,
        duration: 5000,
      });




      if (isJobRoute && tableState) {
        // Use selected rows from HandsOnTable when in /job/ route
        recordsToShare = tableState.rawData.filter(record => 
          tableState.selectedRowIds.includes(record.id)
        );
        console.log('Selected records from table:', recordsToShare);
      } else {
        // Fallback to fetching all records for other routes
        recordsToShare =  await fetchAllRecordIds();
      }

      const recordIdsToShare:string[] = recordsToShare.map((record) => record.id);
      console.log("Records selected::", recordsToShare, "Record IDs selected::", recordIdsToShare);
      await sendCVsToClient(recordIdsToShare, 'create-gmail-draft-shortlist' );
    }, [sendCVsToClient, fetchAllRecordIds]);

    const onClick = () => {
      if (!shouldBeRegistered) {
      return;
      }
      setIsShareChatAndVideoInterviewBasedShortlistModalOpen(true);
    };

    const confirmationModal = (
      <ConfirmationModal
      isOpen={isShareChatAndVideoInterviewBasedShortlistModalOpen}
      setIsOpen={setIsShareChatAndVideoInterviewBasedShortlistModalOpen}
      title={'Create Shortlist PDF and Excel'}
      subtitle={`Are you sure you want to create shortlist PDF and Excel?`}
      onConfirmClick={handleShareChatAndVideoInterviewBasedShortlistClick}
      deleteButtonText={'Create Shortlist PDF and Excel'}
      confirmButtonAccent = 'blue'
      />
    );

    return {
      shouldBeRegistered,
      onClick,
      ConfirmationModal: confirmationModal,
    };
  };
