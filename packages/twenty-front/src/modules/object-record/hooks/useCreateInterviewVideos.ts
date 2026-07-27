import { tokenPairState } from '@/auth/states/tokenPairState';
import axios from 'axios';
import { useState } from 'react';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

type UseCreateInterviewVideosProps = {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};

export const useCreateInterviewVideos = ({
  onSuccess,
  onError,
}: UseCreateInterviewVideosProps = {}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const tokenPair = useAtomStateValue(tokenPairState);

  const createVideosForJobs = async (jobIds: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(
        jobIds.map((jobId) =>
          axios.post(
            REACT_APP_SERVER_BASE_URL+'/arx-delivery/create-interview-videos',
            { jobId },
            {
              headers: {
                Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}`,
                'Content-Type': 'application/json',
              },
            }
          )
        )
      );

      const successfulJobs = results.filter(
        (result) => result.data.status === 'Success'
      );

      if (successfulJobs.length === jobIds.length) {
        onSuccess?.();
      } else {
        throw new Error(
          `Failed to create videos for some jobs. ${successfulJobs.length} of ${jobIds.length} were successful.`
        );
      }

      return results;
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to create interview videos';
      const error = new Error(errorMessage);
      setError(error);
      onError?.(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    createVideosForJobs,
    loading,
    error,
  };
};

