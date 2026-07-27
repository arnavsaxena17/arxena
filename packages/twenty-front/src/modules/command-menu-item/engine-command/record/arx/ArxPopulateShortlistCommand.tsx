import { HeadlessEngineCommandWrapperEffect } from '@/command-menu-item/engine-command/components/HeadlessEngineCommandWrapperEffect';
import { useArxCandidateRecordsFromHeadlessContext } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCandidateRecordsFromHeadlessContext';
import { useArxCommandConfirmationFlow } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCommandConfirmationFlow';
import { ARX_POPULATE_SHORTLIST_MODAL_ID } from '@/command-menu-item/engine-command/record/arx/constants/arxCommandModalIds';
import { useSendCVsToClient } from '@/object-record/hooks/useSendCVsToClient';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useCallback, useState } from 'react';

export const ArxPopulateShortlistCommand = () => {
  const { selectedRecordCount, resolveRecordIds } =
    useArxCandidateRecordsFromHeadlessContext({ recordGqlFields: { id: true } });
  const { isConfirmed, handleCancel, handleConfirm } =
    useArxCommandConfirmationFlow(ARX_POPULATE_SHORTLIST_MODAL_ID);
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
      const recordIds = await resolveRecordIds();

      if (recordIds.length === 0) {
        enqueueWarningSnackBar({
          message: 'No records selected for shortlist',
          options: { duration: 3000 },
        });
        return;
      }

      await sendCVsToClient(recordIds, 'create-shortlist');
      enqueueSuccessSnackBar({
        message: 'Shortlist populated successfully',
        options: { duration: 3000 },
      });
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error ? error.message : 'Failed to populate shortlist',
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
    resolveRecordIds,
    sendCVsToClient,
  ]);

  return (
    <>
      <ConfirmationModal
        modalInstanceId={ARX_POPULATE_SHORTLIST_MODAL_ID}
        title="Populate Shortlist"
        subtitle={`Are you sure you want to populate the shortlist for ${selectedRecordCount} selected record(s)?`}
        onConfirmClick={handleConfirm}
        onClose={handleCancel}
        confirmButtonText="Populate Shortlist"
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
