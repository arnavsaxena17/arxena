import { tokenPairState } from '@/auth/states/tokenPairState';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import axios from 'axios';
import { useState } from 'react';
import { useRecoilState } from 'recoil';

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

  const sendCVsToClient = async (candidateIds: string[], actionToTake:string) => {
    setLoading(true);
    setError(null);
  
    console.log("These are the candidate ids for whom CVs being sent::", candidateIds);
    const url = `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/${actionToTake}`;

    try {
      const response = await axios.post(
        url,
        { candidateIds },
        { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}`, 'Content-Type': 'application/json', }, }
      );

      // Show success message
      enqueueSnackBar('Successfully sent shortlist to client', {
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
    sendCVsToClient,
    loading,
    error
  };
};