import { useState } from 'react';
import axios from 'axios';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { REACT_APP_SERVER_BASE_URL } from '~/config';
// import { useShowNotification } from '@/notification/hooks/useShowNotification'; 
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { WorkspaceMember } from '@/workspace-member/types/WorkspaceMember';


type UseTranscribeCallProps = {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};

export const useTranscribeCall = ({
  onSuccess,
  onError,
}: UseTranscribeCallProps = {}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const tokenPair = useAtomStateValue(tokenPairState);
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar, enqueueWarningSnackBar, enqueueInfoSnackBar } = useSnackBar();

  const transcribeCall = async (phoneCallIds: string[]) => {
    setLoading(true);
    setError(null);
    
    try {
          const response = await axios.post(
            `${REACT_APP_SERVER_BASE_URL}/candidate-sourcing/transcribe-call`,
            { phoneCallIds:phoneCallIds },
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

  return { transcribeCall  };
};