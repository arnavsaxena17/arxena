import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { tableStateAtom } from '@/candidate-table/states/states';
import { contextStoreFiltersComponentState } from '@/context-store/states/contextStoreFiltersComponentState';
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { computeContextStoreFilters } from '@/context-store/utils/computeContextStoreFilters';
import { DEFAULT_QUERY_PAGE_SIZE } from '@/object-record/constants/DefaultQueryPageSize';
import { useLazyFetchAllRecords } from '@/object-record/hooks/useLazyFetchAllRecords';
import { useStartChats } from '@/object-record/hooks/useStartChats';
import { useFilterValueDependencies } from '@/object-record/record-filter/hooks/useFilterValueDependencies';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { useSetRecoilComponentStateV2 } from '@/ui/utilities/state/component-state/hooks/useSetRecoilComponentStateV2';
import { useCallback, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { isDefined } from 'twenty-shared';

export const useStartChatWithCandidatesAction: ActionHookWithObjectMetadataItem =
  ({ objectMetadataItem }) => {
    const location = useLocation();
    const isJobRoute = location.pathname.includes('/job/');
    const tableState = useRecoilValue(tableStateAtom);
    const { enqueueSnackBar } = useSnackBar();

    const contextStoreNumberOfSelectedRecords = useRecoilComponentValueV2(
      contextStoreNumberOfSelectedRecordsComponentState,
    );

    const setNumberOfSelectedRecords = useSetRecoilComponentStateV2(
      contextStoreNumberOfSelectedRecordsComponentState,
    );

    const contextStoreTargetedRecordsRule = useRecoilComponentValueV2(
      contextStoreTargetedRecordsRuleComponentState,
    );

    const setTargetedRecordsRule = useSetRecoilComponentStateV2(
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
    });

    const shouldBeRegistered = true;
    const [isStartChatWithCandidatesModalOpen, setIsStartChatWithCandidatesModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    
    const resetState = useCallback(() => {
      setIsProcessing(false);
      setNumberOfSelectedRecords(0);
      setTargetedRecordsRule({
        mode: 'selection',
        selectedRecordIds: [],
      });
    }, [setNumberOfSelectedRecords, setTargetedRecordsRule]);

    const { sendStartChatRequest, loading } = useStartChats({
      onSuccess: () => {
        enqueueSnackBar('Chats started successfully', {
          variant: SnackBarVariant.Success,
          duration: 5000,
        });
        setIsStartChatWithCandidatesModalOpen(false);
        resetState();
      },
      onError: (error) => {
        enqueueSnackBar(`Failed to start chats: ${error.message}`, {
          variant: SnackBarVariant.Error,
          duration: 5000,
        });
        setIsProcessing(false);
      },
    });

    const validateAndGetRecords = useCallback(async () => {
      let recordsToStartChat;

      if (isJobRoute && tableState?.selectedRowIds?.length > 0) {
        recordsToStartChat = tableState.rawData.filter(record => 
          tableState.selectedRowIds.includes(record.id)
        );
      } else {
        recordsToStartChat = await fetchAllRecordIds();
      }

      if (!recordsToStartChat || recordsToStartChat.length === 0) {
        throw new Error('No candidates selected to start chat with');
      }

      const recordIdsToStartChat = objectMetadataItem.nameSingular.toLowerCase()
        ? recordsToStartChat.map((record) => record.id)
        : recordsToStartChat.map((record) => record.candidateId);

      const jobIds = recordsToStartChat
        .filter(record => isDefined(record?.jobsId))
        .map(record => record?.jobsId);

      if (jobIds.length === 0) {
        throw new Error('No job associated with selected candidates. Please associate candidates with a job first.');
      }

      return { recordIdsToStartChat, jobIds };
    }, [isJobRoute, tableState, fetchAllRecordIds, objectMetadataItem.nameSingular]);

    const handleStartChatWithCandidatesClick = useCallback(async () => {
      if (isProcessing) {
        enqueueSnackBar('Chat initiation is already in progress', {
          variant: SnackBarVariant.Warning,
          duration: 3000,
        });
        return;
      }

      try {
        setIsProcessing(true);
        const { recordIdsToStartChat, jobIds } = await validateAndGetRecords();
        
        await sendStartChatRequest(
          recordIdsToStartChat,
          objectMetadataItem.nameSingular,
          jobIds
        );
      } catch (error) {
        console.error('Error starting chats:', error);
        enqueueSnackBar(error instanceof Error ? error.message : 'Error starting chats', {
          variant: SnackBarVariant.Error,
          duration: 5000,
        });
      } finally {
        setIsProcessing(false);
      }
    }, [
      isProcessing,
      validateAndGetRecords,
      sendStartChatRequest,
      objectMetadataItem.nameSingular,
      enqueueSnackBar
    ]);

    const onClick = useCallback(async () => {
      if (!shouldBeRegistered) {
        return;
      }

      if (isProcessing) {
        return;
      }
      
      try {
        setIsProcessing(true);
        await validateAndGetRecords();
        setIsStartChatWithCandidatesModalOpen(true);
      } catch (error) {
        console.error('Error validating candidates:', error);
        enqueueSnackBar(error instanceof Error ? error.message : 'Error validating candidates', {
          variant: SnackBarVariant.Error,
          duration: 5000,
        });
      } finally {
        setIsProcessing(false);
      }
    }, [shouldBeRegistered, isProcessing, validateAndGetRecords, enqueueSnackBar]);

    const confirmationModal = (
      <ConfirmationModal
        isOpen={isStartChatWithCandidatesModalOpen}
        setIsOpen={(isOpen) => {
          setIsStartChatWithCandidatesModalOpen(isOpen);
          if (!isOpen) {
            resetState();
          }
        }}
        title={'Start Chat'}
        subtitle={`Are you sure you want to start a chat with ${contextStoreNumberOfSelectedRecords} selected candidate(s)?`}
        onConfirmClick={handleStartChatWithCandidatesClick}
        deleteButtonText={'Start Chat'}
        confirmButtonAccent="blue"
        loading={isProcessing || loading}
      />
    );

    return {
      shouldBeRegistered,
      onClick,
      ConfirmationModal: confirmationModal,
      isLoading: isProcessing || loading,
    };
  };
