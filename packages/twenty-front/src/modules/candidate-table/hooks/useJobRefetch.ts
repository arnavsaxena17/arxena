import { tokenPairState } from '@/auth/states/tokenPairState';
import { jobsRefetchTriggerState, jobsState } from '@/candidate-table/states/states';
import axios from 'axios';
import { useCallback, useRef } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

export const useJobRefetch = () => {
  const [jobsRefetchTrigger, setJobsRefetchTrigger] = useRecoilState(jobsRefetchTriggerState);
  const [, setJobs] = useRecoilState(jobsState);
  const tokenPair = useRecoilValue(tokenPairState);
  
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
          `${process.env.REACT_APP_SERVER_BASE_URL}/candidate-sourcing/get-all-jobs`,
          {},
          { headers: { Authorization: `Bearer ${tokenPairRef.current?.accessToken?.token}` } }
        );
        
        if (response?.data?.jobs) {
          // Filter and sort jobs
          const activeJobs = response?.data?.jobs
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
          console.log('Jobs refetched successfully:', activeJobs);
        }
      } catch (error) {
        console.error('Error refetching jobs:', error);
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
    setJobsRefetchTrigger(prev => prev + 1);
  }, [setJobsRefetchTrigger]);

  return {
    refetchJobs,
    triggerJobsRefetch,
    jobsRefetchTrigger,
  };
};
