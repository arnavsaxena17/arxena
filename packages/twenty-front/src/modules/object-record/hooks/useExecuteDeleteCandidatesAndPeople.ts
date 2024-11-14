import { useState } from 'react';
import axios from 'axios';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useRecoilState } from 'recoil';
// import { useShowNotification } from '@/notification/hooks/useShowNotification'; 
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';

type useExecuteDeleteCandidatesAndPeople = {
  objectNameSingular?: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};



export const useExecuteDeleteCandidatesAndPeople = ({
  objectNameSingular,
  onSuccess,
  onError,
}: useExecuteDeleteCandidatesAndPeople = {}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [tokenPair] = useRecoilState(tokenPairState);
  const { enqueueSnackBar } = useSnackBar();

  const deleteCandidatesAndPeople = async (ids: string[]) => {
    setLoading(true);
    setError(null);

    try {
      const url = `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/delete-people-and-candidates-bulk`;
      const body = objectNameSingular === 'candidate'
        ? { candidateIds: ids }
        : { personIds: ids };

      const response = await axios.post(url, body, {
        headers: {
          Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
          'Content-Type': 'application/json',
        },
      });

      const { status, message, results } = response.data;

      if (status === 'Success') {
        enqueueSnackBar(message, {
          variant: SnackBarVariant.Success,
          duration: 3000,
        });
        onSuccess?.();
      } else if (status === 'Partial') {
        enqueueSnackBar(message, {
          variant: SnackBarVariant.Warning,
          duration: 5000,
        });
        onSuccess?.();
      } else {
        throw new Error(message);
      }

      return results;
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'Failed to delete items';
      
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

  return {
    deleteCandidatesAndPeople,
    loading,
    error,
  };
};
