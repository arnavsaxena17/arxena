import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

import { projectsState } from '@/candidate-table/states/states';

export const useProjectPagination = (currentProjectId: string) => {
  const projects = useAtomStateValue(projectsState);
  const navigate = useNavigate();

  const sortedJobs = useMemo(() => {
    return [...projects].sort((a, b) => {
      // First sort by active status (active jobs first)
      if (a.isActive !== b.isActive) {
        return a.isActive ? -1 : 1;
      }
      // Then sort by creation date (newest first) within each status group
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  }, [projects]);

  const currentJobIndex = useMemo(() => {
    return sortedJobs.findIndex(job => job.id === currentProjectId);
  }, [sortedJobs, currentProjectId]);

  const hasPreviousJob = currentJobIndex > 0;
  const hasNextJob = currentJobIndex < sortedJobs.length - 1;

  const navigateToPreviousJob = () => {
    if (hasPreviousJob) {
      const previousJob = sortedJobs[currentJobIndex - 1];
      // Use replace instead of push to avoid adding to history stack
      navigate(`/project/${previousJob.id}`, { replace: false });
    }
  };

  const navigateToNextJob = () => {
    if (hasNextJob) {
      const nextJob = sortedJobs[currentJobIndex + 1];
      // Use replace instead of push to avoid adding to history stack
      navigate(`/project/${nextJob.id}`, { replace: false });
    }
  };

  const navigateToJobsList = () => {
    navigate('/projects');
  };

  return {
    hasPreviousJob,
    hasNextJob,
    navigateToPreviousJob,
    navigateToNextJob,
    navigateToJobsList,
    currentJobIndex: currentJobIndex + 1, // 1-based index for display
    totalJobs: sortedJobs.length,
  };
};
