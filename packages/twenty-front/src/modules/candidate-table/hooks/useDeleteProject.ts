import { tokenPairState } from '@/auth/states/tokenPairState';
import { projectsState } from '@/candidate-table/states/states';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import axios from 'axios';
import { useCallback, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

type DeleteProjectOptions = {
  deleteCandidates?: boolean;
};

type DeleteProjectResponse = {
  status: 'Success' | 'Partial' | 'Failed';
  message?: string;
  deleted?: Record<string, number>;
  errors?: string[];
};

export const useDeleteProject = () => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [jobs, setJobs] = useAtomState(projectsState);
  const tokenPair = useAtomStateValue(tokenPairState);
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar, enqueueWarningSnackBar } =
    useSnackBar();

  const deleteProject = useCallback(
    async (projectId: string, options: DeleteProjectOptions = {}) => {
      const accessToken =
        tokenPair?.accessOrWorkspaceAgnosticToken?.token;

      if (!isDefined(accessToken)) {
        enqueueErrorSnackBar({
          message: 'Not authenticated',
          options: { duration: 4000 },
        });
        throw new Error('Not authenticated');
      }

      const previousJobs = jobs;
      const deleteCandidates = options.deleteCandidates === true;

      setIsDeleting(true);
      setJobs(jobs.filter((job) => job.id !== projectId));

      try {
        const response = await axios.post<DeleteProjectResponse>(
          `${REACT_APP_SERVER_BASE_URL}/candidate-sourcing/delete-project`,
          {
            projectId,
            deleteCandidates,
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          },
        );

        const { status, message } = response.data;

        if (status === 'Failed') {
          setJobs(previousJobs);
          throw new Error(message ?? 'Failed to delete project');
        }

        if (status === 'Partial') {
          enqueueWarningSnackBar({
            message:
              message ??
              'Project deleted with some dependency cleanup errors',
            options: { duration: 5000 },
          });
          return response.data;
        }

        enqueueSuccessSnackBar({
          message:
            message ??
            (deleteCandidates
              ? 'Project and its candidates deleted'
              : 'Project deleted'),
          options: { duration: 3000 },
        });

        return response.data;
      } catch (error) {
        setJobs(previousJobs);
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to delete project';
        enqueueErrorSnackBar({
          message: errorMessage,
          options: { duration: 5000 },
        });
        throw error;
      } finally {
        setIsDeleting(false);
      }
    },
    [
      enqueueErrorSnackBar,
      enqueueSuccessSnackBar,
      enqueueWarningSnackBar,
      jobs,
      setJobs,
      tokenPair?.accessOrWorkspaceAgnosticToken?.token,
    ],
  );

  return {
    deleteProject,
    isDeleting,
  };
};
