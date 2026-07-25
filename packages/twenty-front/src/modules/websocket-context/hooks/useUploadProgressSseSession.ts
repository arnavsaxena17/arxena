import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { useCallback } from 'react';
import { uploadProgressSseSessionCountState } from '../states/uploadProgressSseSessionCountState';

/** Delay before decrementing session count so final `completed` / `error` SSE events are received. */
export const UPLOAD_PROGRESS_SSE_TAIL_MS = 8000;

export const useUploadProgressSseSession = () => {
  const setSessionCount = useSetAtomState(uploadProgressSseSessionCountState);

  const beginUploadProgressSseSession = useCallback(() => {
    setSessionCount((c) => c + 1);
  }, [setSessionCount]);

  const endUploadProgressSseSessionAfterDelay = useCallback(
    (delayMs: number = UPLOAD_PROGRESS_SSE_TAIL_MS) => {
      setTimeout(() => {
        setSessionCount((c) => Math.max(0, c - 1));
      }, delayMs);
    },
    [setSessionCount],
  );

  return {
    beginUploadProgressSseSession,
    endUploadProgressSseSessionAfterDelay,
  };
};
