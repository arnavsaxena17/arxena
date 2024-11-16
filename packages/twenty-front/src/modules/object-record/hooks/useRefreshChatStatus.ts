import { useState } from 'react';
import axios from 'axios';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useRecoilState } from 'recoil';
// import { useShowNotification } from '@/notification/hooks/useShowNotification'; 
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';

type UseRefreshChatStatusProps = {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};

export const useRefreshChatStatus = ({
  onSuccess,
  onError,
}: UseRefreshChatStatusProps = {}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [tokenPair] = useRecoilState(tokenPairState);
//   const showNotification = useShowNotification();
    const { enqueueSnackBar } = useSnackBar();

    // console.log("process.env.REACT_APP_SERVER_BASE_URL:",process.env.REACT_APP_SERVER_BASE_URL)
  const refreshChatStatus = async (candidateIds: string[]) => {
    setLoading(true);
    setError(null);
    
    try {
      // console.log("Creating video interviews for candidates:", candidateIds);
      
      // const results = await Promise.all(
      //   candidateIds.map((candidateId) =>
          const response = await axios.post(
            `${process.env.REACT_APP_SERVER_BASE_URL}/candidate-sourcing/refresh-chat-status-by-candidates`,
            { candidateIds },
            {
              headers: {
                Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
                'Content-Type': 'application/json',
              },
            }
          )
      //   )
      // );

      enqueueSnackBar('Successfully counted chats', {
        variant: SnackBarVariant.Success,
        duration: 3000,
      });

      return response?.data;

    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'Failed to count chats';
      
      const error = new Error(errorMessage);
      setError(error);

      enqueueSnackBar(errorMessage, {
        variant: SnackBarVariant.Error,
        duration: 5000,
      });

      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { refreshChatStatus  };
};