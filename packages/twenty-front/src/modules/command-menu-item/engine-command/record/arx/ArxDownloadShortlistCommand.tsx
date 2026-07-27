import { tokenPairState } from '@/auth/states/tokenPairState';
import { HeadlessEngineCommandWrapperEffect } from '@/command-menu-item/engine-command/components/HeadlessEngineCommandWrapperEffect';
import { useArxCandidateRecordsFromHeadlessContext } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCandidateRecordsFromHeadlessContext';
import { useArxCommandConfirmationFlow } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCommandConfirmationFlow';
import { ARX_DOWNLOAD_SHORTLIST_MODAL_ID } from '@/command-menu-item/engine-command/record/arx/constants/arxCommandModalIds';
import { useFindManyAttachments } from '@/candidate-search/hooks/useFindManyAttachments';
import { useSendCVsToClient } from '@/object-record/hooks/useSendCVsToClient';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import axios from 'axios';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { useCallback, useState } from 'react';
import { getAttachmentDownloadUrl } from 'twenty-shared/utils';

export const ArxDownloadShortlistCommand = () => {
  const { selectedRecordCount, resolveRecordIds } =
    useArxCandidateRecordsFromHeadlessContext({ recordGqlFields: { id: true } });
  const tokenPair = useAtomStateValue(tokenPairState);
  const { isConfirmed, handleCancel, handleConfirm } =
    useArxCommandConfirmationFlow(ARX_DOWNLOAD_SHORTLIST_MODAL_ID);
  const { sendCVsToClient, loading } = useSendCVsToClient();
  const { findManyAttachments } = useFindManyAttachments();
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar, enqueueWarningSnackBar } =
    useSnackBar();
  const [isDownloading, setIsDownloading] = useState(false);

  const downloadAttachments = useCallback(
    async (cvSentId: string) => {
      const attachments = await findManyAttachments({
        filter: {
          cvSentId: {
            eq: cvSentId,
          },
        },
        orderBy: [{ createdAt: 'DescNullsFirst' }],
      });

      if (!attachments || attachments.length === 0) {
        throw new Error('No attachments found for shortlist');
      }

      const zip = new JSZip();
      let filesDownloaded = 0;

      for (const attachment of attachments) {
        const downloadUrl = getAttachmentDownloadUrl({
          file: attachment.file as Array<{ url?: string | null } | null> | null,
          fullPath: attachment.fullPath as string | null | undefined,
        });

        if (!downloadUrl || !attachment.name) {
          continue;
        }

        try {
          const fileResponse = await axios({
            method: 'GET',
            url: downloadUrl,
            responseType: 'blob',
            headers: {
              Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}`,
            },
          });
          zip.file(attachment.name, fileResponse.data);
          filesDownloaded++;
        } catch (error) {
          console.error(`Error downloading ${attachment.name}:`, error);
          enqueueErrorSnackBar({
            message: `Error downloading ${attachment.name}`,
            options: { duration: 3000 },
          });
        }
      }

      if (filesDownloaded === 0) {
        throw new Error('Failed to download any files');
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, 'shortlist_documents.zip');
      return filesDownloaded;
    },
    [enqueueErrorSnackBar, findManyAttachments, tokenPair?.accessOrWorkspaceAgnosticToken?.token],
  );

  const handleExecute = useCallback(async () => {
    if (isDownloading) {
      enqueueWarningSnackBar({
        message: 'A download is already in progress',
        options: { duration: 3000 },
      });
      return;
    }

    try {
      setIsDownloading(true);
      const recordIds = await resolveRecordIds();

      if (recordIds.length === 0) {
        enqueueWarningSnackBar({
          message: 'No records selected for shortlist',
          options: { duration: 3000 },
        });
        return;
      }

      const response = await sendCVsToClient(
        recordIds,
        'create-gmail-draft-shortlist',
      );

      if (!response?.results?.cv_sent_id) {
        throw new Error('Failed to create shortlist');
      }

      const filesDownloaded = await downloadAttachments(
        response.results.cv_sent_id,
      );

      enqueueSuccessSnackBar({
        message: `Successfully downloaded ${filesDownloaded} shortlist document(s)`,
        options: { duration: 3000 },
      });
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error
            ? error.message
            : 'Error processing shortlist download',
        options: { duration: 5000 },
      });
    } finally {
      setIsDownloading(false);
    }
  }, [
    downloadAttachments,
    enqueueErrorSnackBar,
    enqueueSuccessSnackBar,
    enqueueWarningSnackBar,
    isDownloading,
    resolveRecordIds,
    sendCVsToClient,
  ]);

  return (
    <>
      <ConfirmationModal
        modalInstanceId={ARX_DOWNLOAD_SHORTLIST_MODAL_ID}
        title="Download Shortlist"
        subtitle={`Are you sure you want to download the shortlist for ${selectedRecordCount} selected record(s)?`}
        onConfirmClick={handleConfirm}
        onClose={handleCancel}
        confirmButtonText="Download Shortlist"
        confirmButtonAccent="blue"
        loading={isDownloading || loading}
      />
      <HeadlessEngineCommandWrapperEffect
        execute={handleExecute}
        ready={isConfirmed}
      />
    </>
  );
};
