import { useState } from 'react';
import axios from 'axios';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useRecoilState } from 'recoil';
// import { useShowNotification } from '@/notification/hooks/useShowNotification'; 
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { url } from 'inspector';

type UseSendVideoInterviewProps = {
  createVideoInterviewLink:boolean;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};

export const useSendVideoInterview = ({
  createVideoInterviewLink,
  onSuccess,
  onError,
}: UseSendVideoInterviewProps = { createVideoInterviewLink: false }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [tokenPair] = useRecoilState(tokenPairState);
  const { enqueueSnackBar } = useSnackBar();

  const sendVideoInterviewRequest = async (candidateIds: string[], isCreate: boolean) => {
    setLoading(true);
    setError(null);
    
    try {
      const url = isCreate 
        ? `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/create-video-interview-send-to-candidate`
        : `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/send-video-interview-to-candidate`;

      const results = await Promise.all(
        candidateIds.map((candidateId) =>
          axios.post(
            url,
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

      const successfulCandidates = results.filter(
        (result) => (result.status === 200 || result.status === 201) && result.data
      );

      if (successfulCandidates.length === candidateIds.length) {
        const action = isCreate ? 'created' : 'sent';
        enqueueSnackBar(
          `Successfully ${action} video interview ${candidateIds.length === 1 ? 'link' : 'links'} for ${candidateIds.length} candidate${candidateIds.length === 1 ? '' : 's'}`,
          {
            variant: SnackBarVariant.Success,
            duration: 3000,
          }
        );
        onSuccess?.();
      } else {
        const failedCount = candidateIds.length - successfulCandidates.length;
        throw new Error(
          `Failed to ${isCreate ? 'create' : 'send'} Video Interview Links for ${failedCount} candidate${failedCount === 1 ? '' : 's'}`
        );
      }

      return results;
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : `Failed to ${isCreate ? 'create' : 'send'} video interview link`;
      
      const error = new Error(errorMessage);
      setError(error);
      
      enqueueSnackBar(errorMessage, {
        variant: SnackBarVariant.Error,
        duration: 5000,
      });

      onError?.(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const sendCreateVideoInterviewLink = (candidateIds: string[]) => 
    sendVideoInterviewRequest(candidateIds, true);

  const sendVideoInterviewLink = (candidateIds: string[]) => 
    sendVideoInterviewRequest(candidateIds, false);

  return {
    sendCreateVideoInterviewLink,
    sendVideoInterviewLink,
    loading,
    error,
  };
};