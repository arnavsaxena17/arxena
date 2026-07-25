import { useEffect, useRef } from 'react';

import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useUploadProgress } from '@/websocket-context/useUploadProgress';

const UPLOAD_PROGRESS_DEDUPE_KEY = 'upload-progress-sse';

export const useUploadProgressSnackBar = () => {
  const { uploadProgress, error } = useUploadProgress();
  const { enqueueInfoSnackBar, enqueueSuccessSnackBar, enqueueErrorSnackBar } =
    useSnackBar();
  const lastStepRef = useRef<string | null>(null);

  useEffect(() => {
    if (!error) {
      return;
    }

    enqueueErrorSnackBar({
      message: error,
      options: { dedupeKey: `${UPLOAD_PROGRESS_DEDUPE_KEY}-error` },
    });
  }, [enqueueErrorSnackBar, error]);

  useEffect(() => {
    if (!uploadProgress) {
      return;
    }

    const { step, message, progress_percentage: progressPercentage } =
      uploadProgress;

    if (step === lastStepRef.current && step !== 'completed') {
      return;
    }

    lastStepRef.current = step;

    if (step === 'completed') {
      enqueueSuccessSnackBar({
        message: message || 'Upload completed',
        options: { dedupeKey: `${UPLOAD_PROGRESS_DEDUPE_KEY}-completed` },
      });
      return;
    }

    if (step === 'error') {
      enqueueErrorSnackBar({
        message: message || 'Upload failed',
        options: { dedupeKey: `${UPLOAD_PROGRESS_DEDUPE_KEY}-failed` },
      });
      return;
    }

    const progressSuffix =
      typeof progressPercentage === 'number'
        ? ` (${Math.round(progressPercentage)}%)`
        : '';

    enqueueInfoSnackBar({
      message: `${message}${progressSuffix}`,
      options: { dedupeKey: `${UPLOAD_PROGRESS_DEDUPE_KEY}-${step}` },
    });
  }, [enqueueErrorSnackBar, enqueueInfoSnackBar, enqueueSuccessSnackBar, uploadProgress]);
};
