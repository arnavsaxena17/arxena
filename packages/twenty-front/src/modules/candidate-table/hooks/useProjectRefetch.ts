import { tokenPairState } from '@/auth/states/tokenPairState';
import { projectsRefetchTriggerState, projectsState } from '@/candidate-table/states/states';
import axios from 'axios';
import { useCallback, useRef } from 'react';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

export const useProjectRefetch = () => {
  const [projectsRefetchTrigger, setProjectsRefetchTrigger] = useAtomState(projectsRefetchTriggerState);
  const [, setJobs] = useAtomState(projectsState);
  const tokenPair = useAtomStateValue(tokenPairState);
  
  // Use refs to store latest values to avoid dependency issues
  const tokenPairRef = useRef(tokenPair);
  const setJobsRef = useRef(setJobs);
  
  // Update refs when values change
  tokenPairRef.current = tokenPair;
  setJobsRef.current = setJobs;
  
  // Debounce timer ref and refetching flag
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isRefetchingRef = useRef(false);
  const pendingRefetchRef = useRef(false);

  const refetchJobs = useCallback(async () => {
    // If already refetching, mark that we need another refetch after this one completes
    if (isRefetchingRef.current) {
      pendingRefetchRef.current = true;
      return;
    }
    
    // Clear any pending debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    
    // Debounce: if called multiple times quickly, only execute after a delay
    debounceTimerRef.current = setTimeout(async () => {
      isRefetchingRef.current = true;
      pendingRefetchRef.current = false;
      
      try {
        const response = await axios.post(
          `${REACT_APP_SERVER_BASE_URL}/candidate-sourcing/get-all-projects`,
          {},
          { headers: { Authorization: `Bearer ${tokenPairRef.current?.accessOrWorkspaceAgnosticToken?.token}` } }
        );
        
        if (response?.data?.projects) {
          // Filter and sort jobs
          const activeJobs = response?.data?.projects
            .map((job: any) => job.node)
            .sort((a: any, b: any) => {
              // First sort by active status
              if (a?.isActive !== b?.isActive) {
                return b?.isActive ? -1 : 1;
              }
              // Then sort by creation date descending
              return new Date(b?.createdAt).getTime() - new Date(a?.createdAt).getTime();
            });
          
          setJobsRef.current(activeJobs);
          console.log('Projects refetched successfully:', activeJobs);
        }
      } catch (error) {
        console.error('Error refetching projects:', error);
      } finally {
        isRefetchingRef.current = false;
        debounceTimerRef.current = null;
        
        // If there was a pending refetch request, execute it now
        if (pendingRefetchRef.current) {
          pendingRefetchRef.current = false;
          refetchJobs();
        }
      }
    }, 300); // 300ms debounce delay
  }, []); // Empty deps - using refs for latest values

  const triggerJobsRefetch = useCallback(() => {
    console.log('Triggering global jobs refetch...');
    setProjectsRefetchTrigger(prev => prev + 1);
  }, [setProjectsRefetchTrigger]);

  return {
    refetchJobs,
    triggerJobsRefetch,
    projectsRefetchTrigger,
  };
};
