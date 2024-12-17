import { useState } from 'react';
import axios from 'axios';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useRecoilState, useRecoilValue } from 'recoil';
// import { useShowNotification } from '@/notification/hooks/useShowNotification'; 
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { url } from 'inspector';
import { useFilterDropdown } from '../object-filter-dropdown/hooks/useFilterDropdown';
import { useGetCurrentView } from '@/views/hooks/useGetCurrentView';
import { useAvailableScopeIdOrThrow } from '@/ui/utilities/recoil-scope/scopes-internal/hooks/useAvailableScopeId';
import { ViewScopeInternalContext } from '@/views/scopes/scope-internal-context/ViewScopeInternalContext';
import { currentViewWithFiltersState } from '@/views/states/currentViewState';
import { selectedRecordsForModalState } from '../states/selectedRecordsState';

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

  // try {
  //   scopeId = useAvailableScopeIdOrThrow(ViewScopeInternalContext);
  //   const viewData = useGetCurrentView(scopeId);
  //   currentViewWithCombinedFiltersAndSorts = viewData.currentViewWithCombinedFiltersAndSorts;
  // } catch (e) {
  //   console.warn('View scope context not available:', e);
  // }
  

  // console.log("Current Filters and Sorts:", availableSortDefinitions);
  // console.log("Current Filters and availableFilterDefinitionsState:", availableFilterDefinitionsState);
  // console.log("Current Filters and availableFilterDefinitions:", availableFilterDefinitions);  
  // console.log("Current Filters and availableFilterDefinitions:", availableFilterDefinitions);  
  // const { currentViewWithCombinedFiltersAndSorts } = useGetCurrentView('6ccdeef7-be59-404f-a70a-593c7ee04def');
  
  const currentViewWithCombinedFiltersAndSorts = useRecoilValue(currentViewWithFiltersState);
  const selectedRecordIds = useRecoilValue(selectedRecordsForModalState);
  
  console.log("Current FcurrentViewWithCombinedFiltersAndSorts:", currentViewWithCombinedFiltersAndSorts);  
  console.log("Current selectedRecordIds:", selectedRecordIds);  

  const sendStartChatRequest = async ( candidateIds: string[]) => {
    console.log("candidateIds::", candidateIds);    
    // console.log("currentViewWithCombinedFiltersAndSorts::", currentViewWithCombinedFiltersAndSorts);    
    
    
    
    setLoading(true);
    setError(null);

    try {
      const url = `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/start-chats`
      const results = await  axios.post( url, { candidateIds }, { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}`, 'Content-Type': 'application/json', }, } );
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
    sendStartChatRequest,
    loading,
    error,
  };
};