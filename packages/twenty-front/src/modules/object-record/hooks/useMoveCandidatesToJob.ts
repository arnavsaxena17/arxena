import { tokenPairState } from '@/auth/states/tokenPairState';
import axios from 'axios';
import { useCallback, useState } from 'react';
import { useRecoilValue } from 'recoil';

type MoveCandidatesToJobResponse = {
  status: string;
  updated: number;
  failed: number;
};

type UseMoveCandidatesToJobProps = {
  onSuccess?: (result: MoveCandidatesToJobResponse) => void;
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
  return 'Failed to move candidates to the selected job';
};

export const useMoveCandidatesToJob = ({
  onSuccess,
  onError,
}: UseMoveCandidatesToJobProps = {}) => {
  const [loading, setLoading] = useState(false);
  const tokenPair = useRecoilValue(tokenPairState);

  const moveCandidatesToJob = useCallback(
    async (candidateIds: string[], jobId: string) => {
      setLoading(true);
      try {
        const url = `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/move-candidates-to-job`;
        const { data } = await axios.post<MoveCandidatesToJobResponse>(
          url,
          { candidateIds, jobId },
          {
            headers: {
              Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
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
    [onSuccess, onError, tokenPair?.accessToken?.token],
  );

  return { moveCandidatesToJob, loading };
};
