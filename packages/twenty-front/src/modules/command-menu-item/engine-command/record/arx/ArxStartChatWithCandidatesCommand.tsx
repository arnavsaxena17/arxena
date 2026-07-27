import { HeadlessEngineCommandWrapperEffect } from '@/command-menu-item/engine-command/components/HeadlessEngineCommandWrapperEffect';
import { useArxCandidateRecordsFromHeadlessContext } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCandidateRecordsFromHeadlessContext';
import { useArxCommandConfirmationFlow } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCommandConfirmationFlow';
import { ARX_START_CHAT_MODAL_ID } from '@/command-menu-item/engine-command/record/arx/constants/arxCommandModalIds';
import { useStartChats } from '@/object-record/hooks/useStartChats';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useCallback, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';

export const ArxStartChatWithCandidatesCommand = () => {
  const { objectMetadataItem, selectedRecordCount, resolveRecords } =
    useArxCandidateRecordsFromHeadlessContext();
  const { isConfirmed, handleCancel, handleConfirm } =
    useArxCommandConfirmationFlow(ARX_START_CHAT_MODAL_ID);
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();
  const [isProcessing, setIsProcessing] = useState(false);

  const { sendStartChatRequest, loading } = useStartChats({
    onSuccess: () => {
      enqueueSuccessSnackBar({
        message:
          'Chats started successfully and candidates added to Google Contacts',
        options: { duration: 5000 },
      });
    },
    onError: (error) => {
      enqueueErrorSnackBar({
        message: `Failed to start chats: ${error.message}`,
        options: { duration: 5000 },
      });
    },
  });

  const handleExecute = useCallback(async () => {
    if (!isDefined(objectMetadataItem) || isProcessing) {
      return;
    }

    try {
      setIsProcessing(true);
      const records = await resolveRecords();

      if (records.length === 0) {
        throw new Error('No candidates selected to start chat with');
      }

      const recordIdsToStartChat = records
        .map(
          (record) =>
            (record as { tempId?: string; id: string | null }).tempId ||
            record.id,
        )
        .filter((recordId): recordId is string => isDefined(recordId));

      const projectIds = records
        .map((record) => (record as { projectsId?: string; jobsId?: string }).projectsId ?? (record as { jobsId?: string }).jobsId)
        .filter(isDefined);

      if (projectIds.length === 0) {
        throw new Error(
          'No project associated with selected candidates. Please associate candidates with a project first.',
        );
      }

      await sendStartChatRequest(
        recordIdsToStartChat,
        objectMetadataItem.nameSingular,
        projectIds,
      );
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error ? error.message : 'Error starting chats',
        options: { duration: 5000 },
      });
    } finally {
      setIsProcessing(false);
    }
  }, [
    enqueueErrorSnackBar,
    isProcessing,
    objectMetadataItem,
    resolveRecords,
    sendStartChatRequest,
  ]);

  return (
    <>
      <ConfirmationModal
        modalInstanceId={ARX_START_CHAT_MODAL_ID}
        title="Start Chat"
        subtitle={`Are you sure you want to start a chat with ${selectedRecordCount} selected candidate(s)?`}
        onConfirmClick={handleConfirm}
        onClose={handleCancel}
        confirmButtonText="Start Chat"
        confirmButtonAccent="blue"
        loading={isProcessing || loading}
      />
      <HeadlessEngineCommandWrapperEffect
        execute={handleExecute}
        ready={isConfirmed}
      />
    </>
  );
};
