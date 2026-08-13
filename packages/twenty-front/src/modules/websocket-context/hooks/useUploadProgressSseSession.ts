import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { useCallback } from 'react';
import { uploadProgressSseSessionCountState } from '../states/uploadProgressSseSessionCountState';

/** Delay before decrementing session count so final `completed` / `error` SSE events are received. */
export const UPLOAD_PROGRESS_SSE_TAIL_MS = 8000;

export const useUploadProgressSseSession = () => {
  const setUploadProgressSseSessionCount = useSetAtomState(uploadProgressSseSessionCountState);

  const beginUploadProgressSseSession = useCallback(() => {
    setUploadProgressSseSessionCount((c) => c + 1);
  }, [setUploadProgressSseSessionCount]);

  const endUploadProgressSseSessionAfterDelay = useCallback(
    (delayMs: number = UPLOAD_PROGRESS_SSE_TAIL_MS) => {
      setTimeout(() => {
        setUploadProgressSseSessionCount((c) => Math.max(0, c - 1));
      }, delayMs);
    },
    [setUploadProgressSseSessionCount],
  );

  return {
    beginUploadProgressSseSession,
    endUploadProgressSseSessionAfterDelay,
  };
};
