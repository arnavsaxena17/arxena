import { useState } from 'react';
import axios from 'axios';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useRecoilState } from 'recoil';
// import { useShowNotification } from '@/notification/hooks/useShowNotification'; 
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';

type UseCreateVideoInterviewProps = {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};

export const useCreateVideoInterview = ({
  onSuccess,
  onError,
}: UseCreateVideoInterviewProps = {}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [tokenPair] = useRecoilState(tokenPairState);
//   const showNotification = useShowNotification();
    const { enqueueSnackBar } = useSnackBar();

    // console.log("process.env.REACT_APP_SERVER_BASE_URL:",process.env.REACT_APP_SERVER_BASE_URL)
  const createVideoInterviewLink = async (candidateIds: string[]) => {
    setLoading(true);
    setError(null);
    
    try {
      // console.log("Creating video interviews for candidates:", candidateIds);
      
      const results = await Promise.all(
        candidateIds.map((candidateId) =>
          axios.post(
            `${process.env.REACT_APP_SERVER_BASE_URL}/video-interview-process/create-video-interview`,
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

      if (successfulCandidates.length === candidateIds.length) {
        enqueueSnackBar(
            `Successfully created video interview ${candidateIds.length === 1 ? 'link' : 'links'} for ${candidateIds.length} candidate${candidateIds.length === 1 ? '' : 's'}`,
            {
              variant: SnackBarVariant.Success,
              duration: 3000,
            }
          );
          onSuccess?.();
  
        // showNotification({
        //   title: 'Success',
        //   message: `Successfully created video interview ${candidateIds.length === 1 ? 'link' : 'links'} for ${candidateIds.length} candidate${candidateIds.length === 1 ? '' : 's'}`,
        //   type: 'success',
        // });
        onSuccess?.();
      } else {
        const failedCount = candidateIds.length - successfulCandidates.length;
        throw new Error(
          `Failed to create video interview links for ${failedCount} candidate${failedCount === 1 ? '' : 's'}`
        );
      }

      return results;
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'Failed to create video interview link';
      
      const error = new Error(errorMessage);
      setError(error);
      
    //   showNotification({
    //     title: 'Error',
    //     message: errorMessage,
    //     type: 'error',
    //   });
      
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
    createVideoInterviewLink,
    loading,
    error,
  };
};