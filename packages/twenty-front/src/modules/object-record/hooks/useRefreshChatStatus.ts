import { tokenPairState } from '@/auth/states/tokenPairState';
import axios from 'axios';
import { useState } from 'react';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { REACT_APP_SERVER_BASE_URL } from '~/config';
// import { useShowNotification } from '@/notification/hooks/useShowNotification'; 
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';


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
  const tokenPair = useAtomStateValue(tokenPairState);
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar, enqueueWarningSnackBar, enqueueInfoSnackBar } = useSnackBar();

  const refreshChatStatus = async (candidateIds: string[]) => {
    setLoading(true);
    setError(null);
    
    try {
          const response = await axios.post(
            `${REACT_APP_SERVER_BASE_URL}/arx-chat/refresh-chat-status-by-candidates`,
            { candidateIds:candidateIds },
            {
              headers: {
                Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}`,
                'Content-Type': 'application/json',
              },
            }
          )

      enqueueSuccessSnackBar({ message: 'Successfully updated chat statuses', options: { duration: 3000 } });

      return response?.data;

    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'Failed to update chat statuses';
      
      const error = new Error(errorMessage);
      setError(error);

      enqueueErrorSnackBar({ message: errorMessage, options: { duration: 5000 } });

      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { refreshChatStatus  };
};