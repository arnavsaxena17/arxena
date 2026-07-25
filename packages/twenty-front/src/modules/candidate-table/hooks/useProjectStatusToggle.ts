import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { useCallback } from 'react';
import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { UpdateOneProject } from 'twenty-shared/graphql';

import { projectsState } from '../states/states';

type UseJobStatusToggleProps = {
  projectId: string;
  currentJobActive?: boolean;
};

type UseJobStatusToggleReturn = {
  isJobActive: boolean;
  toggleJobStatus: () => void;
  isUpdating: boolean;
};

export const useProjectStatusToggle = ({ 
  projectId, 
  currentJobActive 
}: UseJobStatusToggleProps): UseJobStatusToggleReturn => {
  const [jobs, setJobs] = useAtomState(projectsState);
  const apolloCoreClient = useApolloCoreClient();
  const [updateProject, { loading: isUpdating }] = useMutation(
    gql(UpdateOneProject),
    { client: apolloCoreClient },
  );

  // Find current job from jobs array
  const currentJob = jobs.find(job => job.id === projectId);
  const isJobActive = currentJob?.isActive ?? currentJobActive ?? true;

  const toggleJobStatus = useCallback(() => {
    if (!currentJob) return;
    
    const newStatus = !currentJob.isActive;
    const updatedJobs = jobs.map(job => 
      job.id === projectId ? { ...job, isActive: newStatus } : job
    );
    
    // Update local state immediately for better UX
    setJobs(updatedJobs);
    
    // Update on server
    updateProject({
      variables: {
        idToUpdate: projectId,
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
  }, [currentJob, jobs, projectId, setJobs, updateProject]);

  return {
    isJobActive,
    toggleJobStatus,
    isUpdating
  };
};
