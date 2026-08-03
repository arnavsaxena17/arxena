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

  const createVideosForProjects = async (projectIds: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(
        projectIds.map((projectId) =>
          axios.post(
            REACT_APP_SERVER_BASE_URL +
              '/arx-delivery/create-interview-videos',
            { projectId },
            {
              headers: {
                Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}`,
                'Content-Type': 'application/json',
              },
            },
          ),
        ),
      );

      const successfulProjects = results.filter(
        (result) => result.data.status === 'Success',
      );

      if (successfulProjects.length === projectIds.length) {
        onSuccess?.();
      } else {
        throw new Error(
          `Failed to create videos for some projects. ${successfulProjects.length} of ${projectIds.length} were successful.`,
        );
      }

      return results;
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to create interview videos';
      const nextError = new Error(errorMessage);
      setError(nextError);
      onError?.(nextError);
      throw nextError;
    } finally {
      setLoading(false);
    }
  };

  return {
    createVideosForProjects,
    // Legacy alias used by older call sites
    createVideosForJobs: createVideosForProjects,
    loading,
    error,
  };
};
