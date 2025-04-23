import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { contextStoreFiltersComponentState } from '@/context-store/states/contextStoreFiltersComponentState';
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { computeContextStoreFilters } from '@/context-store/utils/computeContextStoreFilters';
import { BACKEND_BATCH_REQUEST_MAX_COUNT } from '@/object-record/constants/BackendBatchRequestMaxCount';
import { DEFAULT_QUERY_PAGE_SIZE } from '@/object-record/constants/DefaultQueryPageSize';
import { useLazyFetchAllRecords } from '@/object-record/hooks/useLazyFetchAllRecords';
import { useStartChats } from '@/object-record/hooks/useStartChats';
import { useFilterValueDependencies } from '@/object-record/record-filter/hooks/useFilterValueDependencies';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { useCallback, useState } from 'react';
import { isDefined } from 'twenty-shared';

export const useStartChatWithCandidatesAction: ActionHookWithObjectMetadataItem =
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
    const { enqueueSnackBar } = useSnackBar();

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
    });

    const isRemoteObject = objectMetadataItem.isRemote;
    const shouldBeRegistered =
      !isRemoteObject &&
      isDefined(contextStoreNumberOfSelectedRecords) &&
      contextStoreNumberOfSelectedRecords < BACKEND_BATCH_REQUEST_MAX_COUNT &&
      contextStoreNumberOfSelectedRecords > 0;
    
    const [isStartChatWithCandidatesModalOpen, setIsStartChatWithCandidatesModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    
    const { sendStartChatRequest, loading } = useStartChats({
      onSuccess: () => {
        enqueueSnackBar('Chats started successfully', {
          variant: SnackBarVariant.Success,
          duration: 5000,
        });
        setIsStartChatWithCandidatesModalOpen(false);
      },
      onError: (error) => {
        enqueueSnackBar(`Failed to start chats: ${error.message}`, {
          variant: SnackBarVariant.Error,
          duration: 5000,
        });
      },
    });

    const handleStartChatWithCandidatesClick = useCallback(async () => {
      try {
        setIsProcessing(true);
        
        // Fetch all records
        const recordsToStartChat = await fetchAllRecordIds();
        console.log('recordsToStartChat in handle start chat:::', recordsToStartChat);
        
        console.log('objectMetadataItem.nameSingular:::', objectMetadataItem.nameSingular);
        
        // Get candidate IDs
        const recordIdsToStartChat: string[] = objectMetadataItem.nameSingular
          .toLowerCase()
          ? recordsToStartChat.map((record) => record.id)
          : recordsToStartChat.map((record) => record.candidateId);
          
        console.log('recordIdsToStartChat:::', recordIdsToStartChat);
        
        // Get job IDs for data integrity check
        const jobIds = recordsToStartChat
          .filter(record => isDefined(record.jobsId))
          .map(record => record.jobsId);
          
        console.log('jobsId:::', jobIds);
        
        if (jobIds.length === 0) {
          throw new Error('No job associated with selected candidates. Please associate candidates with a job first.');
        }
        
        // Send the request with both candidate IDs and job IDs
        await sendStartChatRequest(
          recordIdsToStartChat,
          objectMetadataItem.nameSingular,
          jobIds
        );
      } catch (error) {
        console.error('Error starting chats:', error);
        // Error handling is done in the useStartChats hook
      } finally {
        setIsProcessing(false);
      }
    }, [
      sendStartChatRequest, 
      fetchAllRecordIds, 
      objectMetadataItem.nameSingular
    ]);

    const onClick = async () => {
      if (!shouldBeRegistered) {
        return;
      }
      
      try {
        setIsProcessing(true);
        
        // First fetch all records to check if they have job associations
        const recordsToStartChat = await fetchAllRecordIds();
        console.log('recordsToStartChat in check job associations:::', recordsToStartChat);
        console.log('objectMetadataItem.nameSingular in check:::', objectMetadataItem.nameSingular);

        const jobIds = recordsToStartChat
          .filter(record => isDefined(record.jobsId))
          .map(record => record.jobsId);
        
        console.log('jobIds:::', jobIds);
        if (jobIds.length === 0) {
          enqueueSnackBar('No job associated with selected candidates. Please associate candidates with a job first.', {
            variant: SnackBarVariant.Error,
            duration: 5000,
          });
          return;
        }
        
        // If we have job IDs, show the confirmation modal
        setIsStartChatWithCandidatesModalOpen(true);
      } catch (error) {
        console.error('Error checking job associations:', error);
        enqueueSnackBar('Error checking candidate job associations', {
          variant: SnackBarVariant.Error,
          duration: 5000,
        });
      } finally {
        setIsProcessing(false);
      }
    };

    const confirmationModal = (
      <ConfirmationModal
        isOpen={isStartChatWithCandidatesModalOpen}
        setIsOpen={setIsStartChatWithCandidatesModalOpen}
        title={'Start Multiple Chats'}
        subtitle={'Are you sure you want to start multiple chats? This will verify job data integrity before proceeding.'}
        onConfirmClick={handleStartChatWithCandidatesClick}
        deleteButtonText={'Start Multiple Chats'}
        confirmButtonAccent="blue"
        loading={isProcessing || loading}
      />
    );

    return {
      shouldBeRegistered,
      onClick,
      ConfirmationModal: confirmationModal,
    };
  };
