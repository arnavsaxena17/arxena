import { HeadlessEngineCommandWrapperEffect } from '@/command-menu-item/engine-command/components/HeadlessEngineCommandWrapperEffect';
import { useArxCandidateRecordsFromHeadlessContext } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCandidateRecordsFromHeadlessContext';
import { useArxCommandConfirmationFlow } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCommandConfirmationFlow';
import { ARX_SHARE_CHAT_SHORTLIST_MODAL_ID } from '@/command-menu-item/engine-command/record/arx/constants/arxCommandModalIds';
import { getSelectedRecordIdsFromHeadlessContext } from '@/command-menu-item/engine-command/record/arx/utils/getSelectedRecordIdsFromHeadlessContext';
import { useSendCVsToClient } from '@/object-record/hooks/useSendCVsToClient';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useCallback, useState } from 'react';

export const ArxShareChatBasedShortlistCommand = () => {
  const { selectedRecordCount, resolveRecords } =
    useArxCandidateRecordsFromHeadlessContext({ recordGqlFields: { id: true } });
  const { isConfirmed, handleCancel, handleConfirm } =
    useArxCommandConfirmationFlow(ARX_SHARE_CHAT_SHORTLIST_MODAL_ID);
  const { sendCVsToClient } = useSendCVsToClient();
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar, enqueueWarningSnackBar } =
    useSnackBar();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleExecute = useCallback(async () => {
    if (isProcessing) {
      return;
    }

    try {
      setIsProcessing(true);
      const records = await resolveRecords();

      if (records.length === 0) {
        enqueueWarningSnackBar({
          message: 'No records selected for sharing',
          options: { duration: 3000 },
        });
        return;
      }

      const recordIds = getSelectedRecordIdsFromHeadlessContext(records);
      await sendCVsToClient(recordIds, 'chat-based-shortlist-delivery');
      enqueueSuccessSnackBar({
        message: 'Shortlist shared successfully',
        options: { duration: 3000 },
      });
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error ? error.message : 'Failed to share shortlist',
        options: { duration: 5000 },
      });
    } finally {
      setIsProcessing(false);
    }
  }, [
    enqueueErrorSnackBar,
    enqueueSuccessSnackBar,
    enqueueWarningSnackBar,
    isProcessing,
    resolveRecords,
    sendCVsToClient,
  ]);

  return (
    <>
      <ConfirmationModal
        modalInstanceId={ARX_SHARE_CHAT_SHORTLIST_MODAL_ID}
        title="Share Chat-based Shortlist"
        subtitle={`Are you sure you want to share this chat-based shortlist for ${selectedRecordCount} selected record(s)?`}
        onConfirmClick={handleConfirm}
        onClose={handleCancel}
        confirmButtonText="Share Shortlist"
        confirmButtonAccent="blue"
        loading={isProcessing}
      />
      <HeadlessEngineCommandWrapperEffect
        execute={handleExecute}
        ready={isConfirmed}
      />
    </>
  );
};
