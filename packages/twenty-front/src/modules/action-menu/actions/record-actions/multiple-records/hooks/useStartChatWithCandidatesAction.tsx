import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { contextStoreFiltersComponentState } from '@/context-store/states/contextStoreFiltersComponentState';
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { computeContextStoreFilters } from '@/context-store/utils/computeContextStoreFilters';
import { BACKEND_BATCH_REQUEST_MAX_COUNT } from '@/object-record/constants/BackendBatchRequestMaxCount';
import { DEFAULT_QUERY_PAGE_SIZE } from '@/object-record/constants/DefaultQueryPageSize';
import { useCheckDataIntegrityOfJob } from '@/object-record/hooks/useCheckDataIntegrityOfJob';
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
    const { checkDataIntegrityOfJob } = useCheckDataIntegrityOfJob({
      onError: (error) => {
        enqueueSnackBar('Data integrity check failed', {
          variant: SnackBarVariant.Error,
          duration: 5000,
        });
      },
    });

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
      // recordGqlFields: { id: true, candidateId: true, jobId: true, jobsId: true },
    });

    // console.log('fetchAllRecordIds', fetchAllRecords);
    // console.log('fetchAllRecords', fetchAllRecords);

    const isRemoteObject = objectMetadataItem.isRemote;
    const shouldBeRegistered =
      !isRemoteObject &&
      isDefined(contextStoreNumberOfSelectedRecords) &&
      contextStoreNumberOfSelectedRecords < BACKEND_BATCH_REQUEST_MAX_COUNT &&
      contextStoreNumberOfSelectedRecords > 0;
    const [
      isStartChatWithCandidatesModalOpen,
      setIsStartChatWithCandidatesModalOpen,
    ] = useState(false);
    const [isPerformingIntegrityCheck, setIsPerformingIntegrityCheck] = useState(false);
    const [integrityCheckError, setIntegrityCheckError] = useState<string | null>(null);
    const { sendStartChatRequest } = useStartChats({
      onSuccess: () => {},
      onError: () => {},
    });

    const handleStartChatWithCandidatesClick = useCallback(async () => {
      try {
        console.log('Starting integrity check...');
        setIsPerformingIntegrityCheck(true);
        setIntegrityCheckError(null);
        
        // First fetch all records
        const recordsToStartChat = await fetchAllRecordIds();
        console.log('recordsToStartChat in chandle start chatheck:::', recordsToStartChat);
        
        console.log('objectMetadataItem.nameSingular:::', objectMetadataItem.nameSingular);
        debugger;
        console.log('objectMetadataItem.nameSingular in chandle start chat:::', objectMetadataItem.nameSingular);
        const recordIdsToStartChat: string[] = objectMetadataItem.nameSingular
          .toLowerCase()
          ? recordsToStartChat.map((record) => record.id)
          : recordsToStartChat.map((record) => record.candidateId);
          
        console.log('recordIdsToStartChat:::', recordIdsToStartChat);
        // Get job IDs to check integrity
        const jobIds = recordsToStartChat
          .filter(record => isDefined(record.jobsId))
          .map(record => record.jobsId);
          
        console.log('jobsId:::', jobIds);
        
        // We already checked for empty jobIds in onClick, but double-check here as a safeguard
        if (jobIds.length === 0) {
          console.log('No job associated with selected candidates. Please associate candidates with a job first.');
          throw new Error('No job associated with selected candidates. Please associate candidates with a job first.');
        }
        
        // Perform data integrity check on jobs
        await checkDataIntegrityOfJob(jobIds);
          
        console.log('recordIdsToStartChat', recordIdsToStartChat);
        // If we reach here, data integrity check passed
        await sendStartChatRequest(
          recordIdsToStartChat,
          objectMetadataItem.nameSingular,
        );
        
        setIsStartChatWithCandidatesModalOpen(false);
      } catch (error) {
        let errorMessage = 'Cannot start chats: Job data integrity check failed';
        
        if (error instanceof Error) {
          if (error.message.includes('No job associated')) {
            errorMessage = error.message;
          } else {
            console.error('Error starting chats:', error);
          }
        }
        
        setIntegrityCheckError(errorMessage);
        enqueueSnackBar(errorMessage, {
          variant: SnackBarVariant.Error,
          duration: 5000,
        });
      } finally {
        setIsPerformingIntegrityCheck(false);
      }
    }, [
      sendStartChatRequest, 
      fetchAllRecordIds, 
      checkDataIntegrityOfJob, 
      objectMetadataItem.nameSingular, 
      enqueueSnackBar
    ]);

    const onClick = async () => {
      if (!shouldBeRegistered) {
        return;
      }
      
      try {
        setIsPerformingIntegrityCheck(true);
        
        // First fetch all records to check if they have job associations
        const recordsToStartChat = await fetchAllRecordIds();
        console.log('recordsToStartChat in check:::', recordsToStartChat);
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
        setIsPerformingIntegrityCheck(false);
      }
    };

    const confirmationModal = (
      <ConfirmationModal
        isOpen={isStartChatWithCandidatesModalOpen}
        setIsOpen={setIsStartChatWithCandidatesModalOpen}
        title={'Start Multiple Chats'}
        subtitle={`Are you sure you want to start multiple chats?${
          isPerformingIntegrityCheck
            ? '\n\nChecking data integrity...'
            : integrityCheckError
              ? `\n\nError: ${integrityCheckError}`
              : ''
        }`}
        onConfirmClick={handleStartChatWithCandidatesClick}
        deleteButtonText={'Start Multiple Chats'}
        confirmButtonAccent="blue"
        loading={isPerformingIntegrityCheck}
      />
    );

    return {
      shouldBeRegistered,
      onClick,
      ConfirmationModal: confirmationModal,
    };
  };
