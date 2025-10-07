import { tokenPairState } from '@/auth/states/tokenPairState';
import { jobsRefetchTriggerState, jobsState } from '@/candidate-table/states/states';
import axios from 'axios';
import { useCallback } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

export const useJobRefetch = () => {
  const [jobsRefetchTrigger, setJobsRefetchTrigger] = useRecoilState(jobsRefetchTriggerState);
  const [, setJobs] = useRecoilState(jobsState);
  const tokenPair = useRecoilValue(tokenPairState);

  const refetchJobs = useCallback(async () => {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_SERVER_BASE_URL}/candidate-sourcing/get-all-jobs`,
        {},
        { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` } }
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
        
        setJobs(activeJobs);
        console.log('Jobs refetched successfully:', activeJobs);
        return true;
      }
    } catch (error) {
      console.error('Error refetching jobs:', error);
      return false;
    }
  }, [tokenPair?.accessToken?.token, setJobs]);

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
