import { HeadlessEngineCommandWrapperEffect } from '@/command-menu-item/engine-command/components/HeadlessEngineCommandWrapperEffect';
import { useArxCandidateRecordsFromHeadlessContext } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCandidateRecordsFromHeadlessContext';
import { useArxCommandConfirmationFlow } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCommandConfirmationFlow';
import { ARX_DOWNLOAD_CVS_MODAL_ID } from '@/command-menu-item/engine-command/record/arx/constants/arxCommandModalIds';
import { useDownloadCVs } from '@/object-record/hooks/useDownloadCVs';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useCallback, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';

export const ArxDownloadCandidateCVsCommand = () => {
  const { objectMetadataItem, selectedRecordCount, resolveRecordIds } =
    useArxCandidateRecordsFromHeadlessContext();
  const { isConfirmed, handleCancel, handleConfirm } =
    useArxCommandConfirmationFlow(ARX_DOWNLOAD_CVS_MODAL_ID);
  const { enqueueErrorSnackBar, enqueueWarningSnackBar } = useSnackBar();
  const [isProcessing, setIsProcessing] = useState(false);

  const { sendDownloadCVsRequest, loading, resetState } = useDownloadCVs({
    onSuccess: () => {
      setIsProcessing(false);
    },
    onError: (error) => {
      enqueueErrorSnackBar({
        message: `Failed to download CVs: ${error.message}`,
        options: { duration: 5000 },
      });
      setIsProcessing(false);
    },
  });

  const handleExecute = useCallback(async () => {
    if (!isDefined(objectMetadataItem) || isProcessing) {
      return;
    }

    try {
      setIsProcessing(true);
      const recordIds = await resolveRecordIds();

      if (recordIds.length === 0) {
        enqueueWarningSnackBar({
          message: 'No candidates selected or found to download CVs.',
          options: { duration: 3000 },
        });
        return;
      }

      if (objectMetadataItem.nameSingular.toLowerCase() !== 'candidate') {
        enqueueErrorSnackBar({
          message: 'This action is only available for Candidate records.',
          options: { duration: 5000 },
        });
        return;
      }

      await sendDownloadCVsRequest(recordIds);
    } catch {
      enqueueErrorSnackBar({
        message: 'An error occurred while preparing the CV download.',
        options: { duration: 5000 },
      });
      setIsProcessing(false);
    }
  }, [
    enqueueErrorSnackBar,
    enqueueWarningSnackBar,
    isProcessing,
    objectMetadataItem,
    resolveRecordIds,
    sendDownloadCVsRequest,
  ]);

  return (
    <>
      <ConfirmationModal
        modalInstanceId={ARX_DOWNLOAD_CVS_MODAL_ID}
        title="Download Candidate CVs"
        subtitle={`Are you sure you want to download CVs for ${selectedRecordCount} selected candidate(s)?`}
        onConfirmClick={handleConfirm}
        onClose={() => {
          resetState();
          handleCancel();
        }}
        confirmButtonText="Download CVs"
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
