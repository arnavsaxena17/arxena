import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { useMutation } from '@apollo/client/react';
import { useCallback } from 'react';
import { isDefined } from 'twenty-shared/utils';

import { UNDO_CHAT_OUTREACH } from '@/ai/graphql/mutations/undoChatOutreach';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';

export type UndoChatOutreachResult = {
  threadId: string;
  message: string;
  columnsRemoved: Array<{
    projectId: string;
    subject: string;
    columnKeys: string[];
    rowsTouched: number;
    ephemeralUpdated: number;
    crmUpdated: number;
  }>;
  viewsCleared: Array<{ projectId: string; tab: string }>;
};

export const useUndoChatOutreach = () => {
  const { enqueueErrorSnackBar, enqueueSuccessSnackBar } = useSnackBar();
  const [undoMutation, { loading }] = useMutation(UNDO_CHAT_OUTREACH);

  const undoChatOutreach = useCallback(
    async (threadId: string): Promise<UndoChatOutreachResult | null> => {
      try {
        const { data } = await undoMutation({
          variables: { threadId },
        });
        const result = data?.undoChatOutreach as
          | UndoChatOutreachResult
          | undefined;

        if (!isDefined(result)) {
          return null;
        }

        enqueueSuccessSnackBar({ message: result.message });

        return result;
      } catch (error) {
        if (CombinedGraphQLErrors.is(error)) {
          enqueueErrorSnackBar({ apolloError: error });
        } else {
          enqueueErrorSnackBar({
            message:
              error instanceof Error
                ? error.message
                : 'Failed to undo chat outreach work',
          });
        }

        return null;
      }
    },
    [enqueueErrorSnackBar, enqueueSuccessSnackBar, undoMutation],
  );

  return {
    undoChatOutreach,
    loading,
  };
};
