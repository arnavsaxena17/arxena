import { tokenPairState } from '@/auth/states/tokenPairState';
import axios from 'axios';
import { useState } from 'react';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { REACT_APP_SERVER_BASE_URL } from '~/config';
// import { useShowNotification } from '@/notification/hooks/useShowNotification'; 
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';

type useExecuteDeleteCandidatesAndPeople = {
  objectNameSingular: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  onRefresh?: () => void;
};



export const useExecuteDeleteCandidatesAndPeople = ({
  objectNameSingular,
  onSuccess,
  onError,
  onRefresh,
}: useExecuteDeleteCandidatesAndPeople) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const tokenPair = useAtomStateValue(tokenPairState);
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar, enqueueWarningSnackBar, enqueueInfoSnackBar } = useSnackBar();

  const deleteCandidatesAndPeople = async (ids: string[]) => {
    setLoading(true);
    setError(null);

    try {
      const url = `${REACT_APP_SERVER_BASE_URL}/candidate-sourcing/delete-people-and-candidates-bulk`;
      const body = objectNameSingular === 'candidate'
        ? { candidateIds: ids }
        : { personIds: ids };

      const response = await axios.post(url, body, {
        headers: {
          Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}`,
          'Content-Type': 'application/json',
        },
      });

      const { status, message, results } = response.data;

      if (status === 'Success') {
        enqueueSuccessSnackBar({ message: message, options: { duration: 3000 } });
        onSuccess?.();
        onRefresh?.();
      } else if (status === 'Partial') {
        enqueueWarningSnackBar({ message: message, options: { duration: 5000 } });
        onSuccess?.();
        onRefresh?.();
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
      
      enqueueErrorSnackBar({ message: errorMessage, options: { duration: 5000 } });

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
