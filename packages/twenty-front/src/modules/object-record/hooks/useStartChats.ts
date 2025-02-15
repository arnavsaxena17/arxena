import { useState } from 'react';
import axios from 'axios';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useRecoilState, useRecoilValue } from 'recoil';
// import { useShowNotification } from '@/notification/hooks/useShowNotification'; 
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';

type UseStartChatProps = {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};

export const useStartChats = ({
  onSuccess,
  onError,
}: UseStartChatProps ) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [tokenPair] = useRecoilState(tokenPairState);
  const { enqueueSnackBar } = useSnackBar();
  //   let scopeId: string | undefined;
  // let currentViewWithCombinedFiltersAndSorts: any;
  const sendStartChatRequest = async ( jobCandidateIds: string[], currentViewWithCombinedFiltersAndSorts:any, objectNameSingular:string) => {
    console.log("jobCandidateIds::", jobCandidateIds);
    console.log("objectNameSingular::", objectNameSingular);
    
    setLoading(true);
    setError(null);

    try {
      let apiEndpoint = 'start-chats';
      if (objectNameSingular === 'candidate') {
        apiEndpoint = 'start-chats-by-candidate-ids';
      }
      const url = `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/${apiEndpoint}`;


      // const url = `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/start-chats`
      const results = await  axios.post( url, { jobCandidateIds, currentViewWithCombinedFiltersAndSorts, objectNameSingular }, { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}`, 'Content-Type': 'application/json', }, } );
      console.log("results::", results);
      return results;
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : `Failed to start chat link`;
      
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
    sendStartChatRequest
  };
};