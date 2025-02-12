import { useState } from 'react';
import axios from 'axios';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useRecoilState, useRecoilValue } from 'recoil';
// import { useShowNotification } from '@/notification/hooks/useShowNotification'; 
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { WorkspaceMember } from '@/workspace-member/types/WorkspaceMember';


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
  const { enqueueSnackBar } = useSnackBar();

  const refreshChatStatus = async (candidateIds: string[], currentWorkspaceMember:WorkspaceMember) => {
    setLoading(true);
    setError(null);
    
    try {
          const response = await axios.post(
            `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/refresh-chat-status-by-candidates`,
            { candidateIds:candidateIds, currentWorkspaceMemberId: currentWorkspaceMember?.id },
            {
              headers: {
                Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
                'Content-Type': 'application/json',
              },
            }
          )

      enqueueSnackBar('Successfully updated chat statuses', {
        variant: SnackBarVariant.Success,
        duration: 3000,
      });

      return response?.data;

    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'Failed to update chat statuses';
      
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