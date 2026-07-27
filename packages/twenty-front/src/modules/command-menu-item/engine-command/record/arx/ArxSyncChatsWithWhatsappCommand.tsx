import { apiKeysState } from '@/arx-jd-upload/states/apiKeysState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { HeadlessEngineCommandWrapperEffect } from '@/command-menu-item/engine-command/components/HeadlessEngineCommandWrapperEffect';
import { useArxCandidateRecordsFromHeadlessContext } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCandidateRecordsFromHeadlessContext';
import { useArxCommandConfirmationFlow } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCommandConfirmationFlow';
import { ARX_SYNC_CHATS_MODAL_ID } from '@/command-menu-item/engine-command/record/arx/constants/arxCommandModalIds';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import axios from 'axios';
import { useCallback, useState } from 'react';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

export const ArxSyncChatsWithWhatsappCommand = () => {
  const { selectedRecordCount, resolveRecords } =
    useArxCandidateRecordsFromHeadlessContext();
  const tokenPair = useAtomStateValue(tokenPairState);
  const apiKeys = useAtomStateValue(apiKeysState);
  const { isConfirmed, handleCancel, handleConfirm } =
    useArxCommandConfirmationFlow(ARX_SYNC_CHATS_MODAL_ID);
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar, enqueueWarningSnackBar } =
    useSnackBar();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleExecute = useCallback(async () => {
    if (isProcessing) {
      enqueueWarningSnackBar({
        message: 'A sync operation is already in progress',
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
      let totalSynced = 0;
      let totalSkipped = 0;
      let totalErrors = 0;

      for (const record of selectedRecords) {
        const phoneNumber = (
          record.phoneNumber as { primaryPhoneNumber?: string } | undefined
        )?.primaryPhoneNumber;

        if (!phoneNumber) {
          errorCount++;
          continue;
        }

        const messagingChannel =
          (record.messagingChannel as string | undefined) ||
          apiKeys.whatsapp_key ||
          'baileys';
        const usesUnipile =
          messagingChannel === 'whatsapp-unipile' ||
          apiKeys.whatsapp_key === 'whatsapp-unipile';
        const syncEndpoint = usesUnipile
          ? `${REACT_APP_SERVER_BASE_URL}/whatsapp-unipile/sync-messages`
          : `${REACT_APP_SERVER_BASE_URL}/baileys-whatsapp/sync-messages`;

        try {
          const response = await axios.post(
            syncEndpoint,
            {
              phoneNumber,
              candidateId: record.id,
              limit: usesUnipile ? 250 : 50,
            },
            {
              headers: {
                Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}`,
                'Content-Type': 'application/json',
              },
            },
          );

          if (response.data.status === 'ok') {
            successCount++;
            totalSynced += response.data.data.synced || 0;
            totalSkipped += response.data.data.skipped || 0;
            totalErrors += response.data.data.errors || 0;
          } else {
            errorCount++;
          }
        } catch {
          errorCount++;
          totalErrors++;
        }
      }

      if (successCount > 0) {
        enqueueSuccessSnackBar({
          message: `Successfully synced chats for ${successCount} record(s). Synced: ${totalSynced}, Skipped: ${totalSkipped}, Errors: ${totalErrors}${errorCount > 0 ? `, Failed: ${errorCount}` : ''}`,
          options: { duration: 7000 },
        });
      } else {
        enqueueErrorSnackBar({
          message: `Failed to sync chats for all ${errorCount} record(s)`,
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
    apiKeys.whatsapp_key,
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
        modalInstanceId={ARX_SYNC_CHATS_MODAL_ID}
        title="Sync Chats with WhatsApp"
        subtitle={`Are you sure you want to sync chats with WhatsApp for ${selectedRecordCount} selected record(s)? This will fetch and save any new messages from WhatsApp to the database.`}
        onConfirmClick={handleConfirm}
        onClose={handleCancel}
        confirmButtonText="Sync Chats"
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
