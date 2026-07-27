import { tokenPairState } from '@/auth/states/tokenPairState';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import axios from 'axios';
import { useState } from 'react';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

type UseCreateVideoInterviewProps = {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};

export const useCreateManyVideoInterviewLinks = ({
  onSuccess,
  onError,
}: UseCreateVideoInterviewProps = {}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const tokenPair = useAtomStateValue(tokenPairState);
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();
  const createVideoInterviewLinks = async (candidateIds: string[]) => {
    setLoading(true);
    setError(null);

    console.log('These are the record Ids:', candidateIds);

    try {
      const results = await Promise.all(
        candidateIds.map((candidateId) =>
          axios.post(
            `${REACT_APP_SERVER_BASE_URL}/video-interview-process/create-video-interview`,
            { candidateId },
            {
              headers: {
                Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}`,
                'Content-Type': 'application/json',
              },
            }
          )
        )
      );
      console.log("results:", results);
      const successfulCandidates = results.filter(
        (result) => (result.status === 200 || result.status === 201) && result.data
      );
      // const successfulCandidates = candidateIds;
      if (successfulCandidates.length === candidateIds.length) {
        enqueueSuccessSnackBar({
          message: `Successfully created video interview ${candidateIds.length === 1 ? 'link' : 'links'} for ${candidateIds.length} candidate${candidateIds.length === 1 ? '' : 's'}`,
          options: { duration: 3000 },
        });
      } else {
        const failedCount = candidateIds.length - successfulCandidates.length;
        throw new Error(
          `Failed to create video interview links for ${failedCount} candidate${failedCount === 1 ? '' : 's'}`,
        );
      }

      // return results;
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to create video interview link';

      const error = new Error(errorMessage);
      setError(error);

      enqueueErrorSnackBar({ message: errorMessage, options: { duration: 5000 } });

      onError?.(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    createVideoInterviewLinks,
    loading,
    error,
  };
};
