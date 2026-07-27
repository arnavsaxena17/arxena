import { useState } from 'react';
import axios from 'axios';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { REACT_APP_SERVER_BASE_URL } from '~/config';





type UseRefreshChatCountsProps = {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};

export const useRefreshChatCounts = ({
  onSuccess,
  onError,
}: UseRefreshChatCountsProps = {}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const tokenPair = useAtomStateValue(tokenPairState);
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar, enqueueWarningSnackBar, enqueueInfoSnackBar } = useSnackBar();

  const refreshChatCounts = async (candidateIds: string[]) => {
    setLoading(true);
    setError(null);
    
    try {
          const response = await axios.post(
            `${REACT_APP_SERVER_BASE_URL}/arx-chat/refresh-chat-counts-by-candidates`,
            { candidateIds },
            {
              headers: {
                Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}`,
                'Content-Type': 'application/json',
              },
            }
          )


      // Show success message
      enqueueSuccessSnackBar({ message: 'Successfully counted chats', options: { duration: 3000 } });

      return response.data;

    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'Failed to count chats';
      
      const error = new Error(errorMessage);
      setError(error);

      enqueueErrorSnackBar({ message: errorMessage, options: { duration: 5000 } });

      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    refreshChatCounts  };
};