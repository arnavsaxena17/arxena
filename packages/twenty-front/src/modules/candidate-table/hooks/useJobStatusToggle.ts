import { gql, useMutation } from '@apollo/client';
import { useCallback } from 'react';
import { useRecoilState } from 'recoil';
import { UpdateOneJob } from 'twenty-shared';

import { jobsState } from '../states/states';

type UseJobStatusToggleProps = {
  jobId: string;
  currentJobActive?: boolean;
};

type UseJobStatusToggleReturn = {
  isJobActive: boolean;
  toggleJobStatus: () => void;
  isUpdating: boolean;
};

export const useJobStatusToggle = ({ 
  jobId, 
  currentJobActive 
}: UseJobStatusToggleProps): UseJobStatusToggleReturn => {
  const [jobs, setJobs] = useRecoilState(jobsState);
  const [updateJob, { loading: isUpdating }] = useMutation(gql(UpdateOneJob));

  // Find current job from jobs array
  const currentJob = jobs.find(job => job.id === jobId);
  const isJobActive = currentJob?.isActive ?? currentJobActive ?? true;

  const toggleJobStatus = useCallback(() => {
    if (!currentJob) return;
    
    const newStatus = !currentJob.isActive;
    const updatedJobs = jobs.map(job => 
      job.id === jobId ? { ...job, isActive: newStatus } : job
    );
    
    // Update local state immediately for better UX
    setJobs(updatedJobs);
    
    // Update on server
    updateJob({
      variables: {
        idToUpdate: jobId,
        input: {
          isActive: newStatus
        }
      },
      onError: (error) => {
        console.error('Failed to update job status:', error);
        // Revert local state on error
        setJobs(jobs);
      }
    });
  }, [currentJob, jobs, jobId, setJobs, updateJob]);

  return {
    isJobActive,
    toggleJobStatus,
    isUpdating
  };
};
