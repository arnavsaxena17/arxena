import { tokenPairState } from '@/auth/states/tokenPairState';
import axios from 'axios';
import { useState } from 'react';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { REACT_APP_SERVER_BASE_URL } from '~/config';
// import { useShowNotification } from '@/notification/hooks/useShowNotification'; 
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';

type UseStartChatProps = {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};

export const useUpdateSnapshotProfilesFromJobBoards = ({
  onSuccess,
  onError,
}: UseStartChatProps ) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const tokenPair = useAtomStateValue(tokenPairState);
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar, enqueueWarningSnackBar, enqueueInfoSnackBar } = useSnackBar();
  //   let scopeId: string | undefined;
  // let currentViewWithCombinedFiltersAndSorts: any;
  const updateSnapshotProfiles = async (candidateIds: string[],uniqueStringKeys:string[], personIds:string[], objectNameSingular: string) => {
    console.log("candidateIds::", candidateIds);
    console.log("objectNameSingular::", objectNameSingular);
    
    setLoading(true);
    setError(null);

    try {
      let apiEndpoint = 'update-snapshot-profiles';
      if (objectNameSingular === 'candidate' || objectNameSingular.toLowerCase().includes('jobcandidate')) {
        apiEndpoint = 'update-snapshot-profiles';
      }
      console.log("apiEndpoint::", apiEndpoint);
      const url = `${REACT_APP_SERVER_BASE_URL}/candidate-sourcing/${apiEndpoint}`;
      const results = await  axios.post( url, { candidateIds:candidateIds, personIds:personIds, uniqueStringKeys: uniqueStringKeys, objectNameSingular }, { headers: { Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}`, 'Content-Type': 'application/json', }, } );
      console.log("results::", results);
      return results;
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : `Failed to start chat link`;
      
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
    updateSnapshotProfiles
  };
};