import { tokenPairState } from '@/auth/states/tokenPairState';
import { HeadlessEngineCommandWrapperEffect } from '@/command-menu-item/engine-command/components/HeadlessEngineCommandWrapperEffect';
import { useArxCandidateRecordsFromHeadlessContext } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCandidateRecordsFromHeadlessContext';
import { useArxCommandConfirmationFlow } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCommandConfirmationFlow';
import { ARX_RESET_WHATSAPP_MESSAGES_MODAL_ID } from '@/command-menu-item/engine-command/record/arx/constants/arxCommandModalIds';
import { getUniqueRecordIdsFromRecords } from '@/command-menu-item/engine-command/record/arx/utils/getSelectedRecordIdsFromHeadlessContext';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import axios from 'axios';
import { useCallback, useState } from 'react';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

export const ArxResetMessagesFromWhatsappCommand = () => {
  const { selectedRecordCount, resolveRecords } =
    useArxCandidateRecordsFromHeadlessContext();
  const tokenPair = useAtomStateValue(tokenPairState);
  const { isConfirmed, handleCancel, handleConfirm } =
    useArxCommandConfirmationFlow(ARX_RESET_WHATSAPP_MESSAGES_MODAL_ID);
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar, enqueueWarningSnackBar } =
    useSnackBar();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleExecute = useCallback(async () => {
    if (isProcessing) {
      enqueueWarningSnackBar({
        message: 'A message reset operation is already in progress',
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

      const candidateIds = getUniqueRecordIdsFromRecords(selectedRecords);

      await axios.post(
        `${REACT_APP_SERVER_BASE_URL}/arx-chat/reset-messages-from-whatsapp`,
        { candidateIds },
        {
          headers: {
            Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}`,
          },
        },
      );

      enqueueSuccessSnackBar({
        message: `Successfully reset messages for ${selectedRecords.length} record(s)`,
        options: { duration: 3000 },
      });
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error ? error.message : 'Failed to reset messages',
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
        modalInstanceId={ARX_RESET_WHATSAPP_MESSAGES_MODAL_ID}
        title="Reset Messages from Whatsapp"
        subtitle={`Are you sure you want to reset messages from Whatsapp for ${selectedRecordCount} selected record(s)?`}
        onConfirmClick={handleConfirm}
        onClose={handleCancel}
        confirmButtonText="Reset Messages from Whatsapp"
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
