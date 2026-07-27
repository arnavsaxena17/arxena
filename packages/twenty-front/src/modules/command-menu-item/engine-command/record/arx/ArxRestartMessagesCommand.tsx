import { tokenPairState } from '@/auth/states/tokenPairState';
import { HeadlessEngineCommandWrapperEffect } from '@/command-menu-item/engine-command/components/HeadlessEngineCommandWrapperEffect';
import { useArxCandidateRecordsFromHeadlessContext } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCandidateRecordsFromHeadlessContext';
import { useArxCommandConfirmationFlow } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCommandConfirmationFlow';
import { ARX_RESTART_MESSAGES_MODAL_ID } from '@/command-menu-item/engine-command/record/arx/constants/arxCommandModalIds';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import axios from 'axios';
import { useCallback, useState } from 'react';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

export const ArxRestartMessagesCommand = () => {
  const { selectedRecordCount, resolveRecords } =
    useArxCandidateRecordsFromHeadlessContext();
  const tokenPair = useAtomStateValue(tokenPairState);
  const { isConfirmed, handleCancel, handleConfirm } =
    useArxCommandConfirmationFlow(ARX_RESTART_MESSAGES_MODAL_ID);
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar, enqueueWarningSnackBar } =
    useSnackBar();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleExecute = useCallback(async () => {
    if (isProcessing) {
      enqueueWarningSnackBar({
        message: 'A message restart operation is already in progress',
        options: { duration: 3000 },
      });
      return;
    }

    try {
      setIsProcessing(true);
      const selectedRecords = await resolveRecords();

      if (selectedRecords.length === 0) {
        enqueueWarningSnackBar({
          message: 'No records selected',
          options: { duration: 3000 },
        });
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const record of selectedRecords) {
        const phoneNumber = (
          record.phoneNumber as { primaryPhoneNumber?: string } | undefined
        )?.primaryPhoneNumber;

        if (!phoneNumber) {
          errorCount++;
          continue;
        }

        try {
          await axios.post(
            `${REACT_APP_SERVER_BASE_URL}/arx-chat/start-interim-chat-prompt`,
            {
              interimChat: 'remindCandidate',
              candidateId: record.id,
            },
            {
              headers: {
                Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}`,
              },
            },
          );
          successCount++;
        } catch {
          errorCount++;
        }
      }

      if (successCount > 0) {
        enqueueSuccessSnackBar({
          message: `Successfully restarted messages for ${successCount} record(s)${errorCount > 0 ? `, failed for ${errorCount} record(s)` : ''}`,
          options: { duration: 5000 },
        });
      } else {
        enqueueErrorSnackBar({
          message: `Failed to restart messages for all ${errorCount} record(s)`,
          options: { duration: 5000 },
        });
      }
    } catch {
      enqueueErrorSnackBar({
        message: 'Error processing records',
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
    tokenPair?.accessOrWorkspaceAgnosticToken?.token,
  ]);

  return (
    <>
      <ConfirmationModal
        modalInstanceId={ARX_RESTART_MESSAGES_MODAL_ID}
        title="Restart (remind) Messaging"
        subtitle={`Are you sure you want to restart (remind) messaging for ${selectedRecordCount} selected record(s)?`}
        onConfirmClick={handleConfirm}
        onClose={handleCancel}
        confirmButtonText="Restart (remind) Messaging"
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
