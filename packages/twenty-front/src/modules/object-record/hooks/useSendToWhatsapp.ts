import { useState } from 'react';
import axios from 'axios';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useRecoilState } from 'recoil';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';


type UseSendToWhatsappProps = {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};

export const useSendToWhatsapp = ({
  onSuccess,
  onError,
}: UseSendToWhatsappProps = {}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [tokenPair] = useRecoilState(tokenPairState);
  const { enqueueSnackBar } = useSnackBar();

  const sendToWhatsapp = async (candidateIds: string[]) => {
    setLoading(true);
    setError(null);
    
    try {
          
      var data = {
        type: "FROM_PAGE",
        text: JSON.stringify("{candidateIds: " + candidateIds + "}"),
      };
      window.postMessage(data, "*");


      // Show success message
      enqueueSnackBar('Successfully counted chats', {
        variant: SnackBarVariant.Success,
        duration: 3000,
      });


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
    sendToWhatsapp  };
};