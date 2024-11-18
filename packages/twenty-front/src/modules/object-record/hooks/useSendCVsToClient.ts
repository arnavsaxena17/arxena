import { useState } from 'react';
import axios from 'axios';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useRecoilState } from 'recoil';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';





type UseSendCVsToClientProps = {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};

export const useSendCVsToClient = ({
  onSuccess,
  onError,
}: UseSendCVsToClientProps = {}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [tokenPair] = useRecoilState(tokenPairState);
  const { enqueueSnackBar } = useSnackBar();

  const sendCVsToClient = async (candidateIds: string[]) => {
    setLoading(true);
    setError(null);
    
    try {
          const response = await axios.post(
            `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/send-cvs-to-client`,
            { candidateIds },
            {
              headers: {
                Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
                'Content-Type': 'application/json',
              },
            }
          )


      // Show success message
      enqueueSnackBar('Successfully counted chats', {
        variant: SnackBarVariant.Success,
        duration: 3000,
      });

      return response.data;

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

  return {
    sendCVsToClient  };
};