import { tokenPairState } from '@/auth/states/tokenPairState';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import axios from 'axios';
import { useState } from 'react';
import { useRecoilState } from 'recoil';

type UseShareVideoInterviewProps = {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};

export const useShareManyVideoInterviewLinks = ({
  onSuccess,
  onError,
}: UseShareVideoInterviewProps = {}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [tokenPair] = useRecoilState(tokenPairState);
  const { enqueueSnackBar } = useSnackBar();

  const shareVideoInterviewLinks = async (candidateIds: string[]) => {
    setLoading(true);
    setError(null);

    console.log('These are the record Ids:', candidateIds);

    try {
      const results = await Promise.all(
        candidateIds.map((candidateId) =>
          axios.post(
            `${process.env.REACT_APP_SERVER_BASE_URL}/video-interview-process/send-video-interview-to-candidate`,
            { candidateId },
            {
              headers: {
                Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
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
        enqueueSnackBar(
          `Successfully crsharedeated video interview ${candidateIds.length === 1 ? 'link' : 'links'} for ${candidateIds.length} candidate${candidateIds.length === 1 ? '' : 's'}`,
          {
            variant: SnackBarVariant.Success,
            duration: 3000,
          },
        );
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

      enqueueSnackBar(errorMessage, {
        variant: SnackBarVariant.Error,
        duration: 5000,
        // Adding a close button for error messages
      });

      onError?.(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    shareVideoInterviewLinks,
    loading,
    error,
  };
};
