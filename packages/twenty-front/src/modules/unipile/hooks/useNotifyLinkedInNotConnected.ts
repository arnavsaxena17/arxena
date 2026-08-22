import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import {
  isLinkedInNotConnectedErrorMessage,
  LINKEDIN_NOT_CONNECTED_SNACKBAR_KEY,
  readHttpErrorMessageFromResponse,
} from '@/unipile/utils/linkedinNotConnectedError';
import { t } from '@lingui/core/macro';
import { useCallback } from 'react';

export const useNotifyLinkedInNotConnected = () => {
  const { enqueueErrorSnackBar } = useSnackBar();

  const notifyLinkedInNotConnected = useCallback(
    (message?: string) => {
      if (!message || !isLinkedInNotConnectedErrorMessage(message)) {
        return false;
      }

      enqueueErrorSnackBar({
        message: t`LinkedIn is not connected.`,
        options: { dedupeKey: LINKEDIN_NOT_CONNECTED_SNACKBAR_KEY },
      });

      return true;
    },
    [enqueueErrorSnackBar],
  );

  const notifyLinkedInNotConnectedFromUnknown = useCallback(
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);

      return notifyLinkedInNotConnected(message);
    },
    [notifyLinkedInNotConnected],
  );

  const notifyLinkedInNotConnectedFromResponse = useCallback(
    async (response: Response) => {
      if (response.ok) {
        return false;
      }

      const message = await readHttpErrorMessageFromResponse(response.clone());

      return notifyLinkedInNotConnected(message);
    },
    [notifyLinkedInNotConnected],
  );

  return {
    notifyLinkedInNotConnected,
    notifyLinkedInNotConnectedFromUnknown,
    notifyLinkedInNotConnectedFromResponse,
  };
};
