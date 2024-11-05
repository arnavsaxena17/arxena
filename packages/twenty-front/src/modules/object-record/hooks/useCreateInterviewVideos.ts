import { useState } from 'react';
import axios from 'axios';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useRecoilValue, useRecoilState } from 'recoil';

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
  const [tokenPair] = useRecoilState(tokenPairState);

  const createVideosForJobs = async (jobIds: string[]) => {
    setLoading(true);
    setError(null);
    try {
      // Get the authentication token - adjust this based on your auth implementation
      // const token = localStorage.getItem('authToken') || '';
      console.log("process env", process.env.REACT_APP_SERVER_BASE_URL)
      // Process all jobs in parallel
      console.log("going to create videos for jobs", jobIds)
      const results = await Promise.all(
        jobIds.map((jobId) =>
          axios.post(
            process.env.REACT_APP_SERVER_BASE_URL+'/arx-chat/create-interview-videos',
            { jobId },
            {
              headers: {
                Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
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

