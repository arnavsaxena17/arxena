import { apiKeysState } from '@/arx-jd-upload/states/apiKeysState';
import { tableStateAtom } from '@/candidate-table/states/states';
import { tokenPairState } from '@/auth/states/tokenPairState';
import {
  type CheckDataIntegrityOfProjectOptions,
  useCheckDataIntegrityOfProject,
} from '@/object-record/hooks/useCheckDataIntegrityOfProject';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import axios from 'axios';
import { useCallback, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

type UseStartChatsParams = {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};

export const useStartChats = ({
  onSuccess,
  onError,
}: UseStartChatsParams = {}) => {
  const [loading, setLoading] = useState(false);
  const tokenPair = useAtomStateValue(tokenPairState);
  const apiKeys = useAtomStateValue(apiKeysState);
  const tableState = useAtomStateValue(tableStateAtom);
  const { enqueueErrorSnackBar } = useSnackBar();
  const { checkDataIntegrityOfProject } = useCheckDataIntegrityOfProject({
    onError: (error) => {
      enqueueErrorSnackBar({
        message: 'Data integrity check failed',
        options: { duration: 5000 },
      });
      onError?.(error);
    },
  });

  const sendStartChatRequest = useCallback(
    async (
      candidateIds: string[],
      objectNameSingular: string,
      projectIds?: string[],
    ) => {
      setLoading(true);

      try {
        if (!apiKeys?.openaikey?.trim()) {
          throw new Error(
            'OpenAI API key is missing. Add it in Settings → General before starting chats.',
          );
        }

        const candidatesWithoutValidChannels = tableState.rawData
          .filter((candidate) => candidateIds.includes(candidate.id))
          .filter((candidate) => {
            const messagingChannel = candidate?.messagingChannel;

            if (!messagingChannel) {
              return true;
            }

            if (
              [
                'baileys',
                'whatsapp-web',
                'whatsapp-official',
                'whatsapp-unipile',
              ].includes(messagingChannel)
            ) {
              return !candidate?.phoneNumber?.primaryPhoneNumber;
            }

            if (
              ['linkedin', 'linkedin-premium', 'linkedin-inmail'].includes(
                messagingChannel,
              )
            ) {
              return !candidate?.linkedinUrl;
            }

            return true;
          });

        if (candidatesWithoutValidChannels.length > 0) {
          throw new Error(
            `Cannot start chat with ${candidatesWithoutValidChannels.length} candidate(s) without valid messaging channels.`,
          );
        }

        if (isDefined(projectIds) && projectIds.length > 0) {
          const selectedRows = tableState.rawData.filter((candidate) =>
            candidateIds.includes(candidate.id),
          );
          const integrityOptions: CheckDataIntegrityOfProjectOptions | undefined =
            selectedRows.length === candidateIds.length &&
            candidateIds.length > 0
              ? {
                  messagingChannelsForKeys: selectedRows
                    .map((candidate) => candidate?.messagingChannel?.trim())
                    .filter(
                      (channel): channel is string =>
                        typeof channel === 'string' && channel.length > 0,
                    ),
                }
              : undefined;

          const projectDataOk = await checkDataIntegrityOfProject(
            projectIds,
            integrityOptions,
          );

          if (!projectDataOk) {
            throw new Error(
              'Project validation failed. Fix the issues shown above before starting chats.',
            );
          }
        } else {
          throw new Error('No project IDs provided for data integrity check');
        }

        let apiEndpoint = 'start-chats';
        if (
          objectNameSingular === 'candidate' ||
          objectNameSingular.toLowerCase().includes('jobcandidate')
        ) {
          apiEndpoint = 'start-chats-by-candidate-ids';
        }

        const url = `${REACT_APP_SERVER_BASE_URL}/arx-chat/${apiEndpoint}`;

        const results = await axios.post(
          url,
          { candidateIds, objectNameSingular },
          {
            headers: {
              Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}`,
              'Content-Type': 'application/json',
            },
          },
        );

        onSuccess?.();

        return results;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to start chat';

        const normalizedError = new Error(errorMessage);

        if (!errorMessage.startsWith('Project validation failed')) {
          enqueueErrorSnackBar({
            message: errorMessage,
            options: { duration: 5000 },
          });
        }

        onError?.(normalizedError);
        throw normalizedError;
      } finally {
        setLoading(false);
      }
    },
    [
      apiKeys?.openaikey,
      checkDataIntegrityOfProject,
      enqueueErrorSnackBar,
      onError,
      onSuccess,
      tableState.rawData,
      tokenPair?.accessOrWorkspaceAgnosticToken?.token,
    ],
  );

  return { sendStartChatRequest, loading };
};
