import { tokenPairState } from '@/auth/states/tokenPairState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import axios from 'axios';
import { useCallback, useState } from 'react';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

type MoveCandidatesToProjectResponse = {
  status: string;
  updated: number;
  failed: number;
};

type UseMoveCandidatesToProjectProps = {
  onSuccess?: (result: MoveCandidatesToProjectResponse) => void;
  onError?: (error: Error) => void;
};

const getErrorMessage = (err: unknown): string => {
  if (
    axios.isAxiosError(err) &&
    err.response !== undefined &&
    err.response.data !== undefined
  ) {
    const data = err.response.data as { message?: string | string[] };
    if (Array.isArray(data.message)) {
      return data.message.join(', ');
    }
    if (typeof data.message === 'string') {
      return data.message;
    }
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'Failed to move candidates to the selected project';
};

export const useMoveCandidatesToProject = ({
  onSuccess,
  onError,
}: UseMoveCandidatesToProjectProps = {}) => {
  const [loading, setLoading] = useState(false);
  const tokenPair = useAtomStateValue(tokenPairState);

  const moveCandidatesToProject = useCallback(
    async (candidateIds: string[], projectId: string) => {
      setLoading(true);
      try {
        const url = `${REACT_APP_SERVER_BASE_URL}/arx-chat/move-candidates-to-project`;
        const { data } = await axios.post<MoveCandidatesToProjectResponse>(
          url,
          { candidateIds, projectId },
          {
            headers: {
              Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}`,
              'Content-Type': 'application/json',
            },
          },
        );
        onSuccess?.(data);
        return data;
      } catch (err) {
        const error = new Error(getErrorMessage(err));
        onError?.(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [onSuccess, onError, tokenPair?.accessOrWorkspaceAgnosticToken?.token],
  );

  return { moveCandidatesToProject, loading };
};
