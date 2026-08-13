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
  const [projects, setProjects] = useAtomState(projectsState);
  const apolloCoreClient = useApolloCoreClient();
  const [updateProject, { loading: isUpdating }] = useMutation(
    gql(UpdateOneProject),
    { client: apolloCoreClient },
  );

  // Find current job from projects array
  const currentJob = projects.find(job => job.id === projectId);
  const isJobActive = currentJob?.isActive ?? currentJobActive ?? true;

  const toggleJobStatus = useCallback(() => {
    if (!currentJob) return;
    
    const newStatus = !currentJob.isActive;
    const updatedJobs = projects.map(job => 
      job.id === projectId ? { ...job, isActive: newStatus } : job
    );
    
    // Update local state immediately for better UX
    setProjects(updatedJobs);
    
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
        setProjects(projects);
      }
    });
  }, [currentJob, projects, projectId, setProjects, updateProject]);

  return {
    isJobActive,
    toggleJobStatus,
    isUpdating
  };
};
