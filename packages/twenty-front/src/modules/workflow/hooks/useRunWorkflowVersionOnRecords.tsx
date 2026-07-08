import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { RUN_WORKFLOW_VERSION_ON_RECORDS } from '@/workflow/graphql/mutations/runWorkflowVersionOnRecords';
import { useApolloClient, useMutation } from '@apollo/client';
import { useTheme } from '@emotion/react';
import { IconSettingsAutomation } from 'twenty-ui';

type RunWorkflowVersionOnRecordsResult = {
  runWorkflowVersionOnRecords?: {
    workflowRunIds?: string[];
  };
};

export const useRunWorkflowVersionOnRecords = () => {
  const apolloClient = useApolloClient();
  const [mutate] = useMutation<RunWorkflowVersionOnRecordsResult>(
    RUN_WORKFLOW_VERSION_ON_RECORDS,
    {
      client: apolloClient,
    },
  );

  const { enqueueSnackBar } = useSnackBar();

  const theme = useTheme();

  const runWorkflowVersionOnRecords = async ({
    workflowVersionId,
    payloads,
  }: {
    workflowVersionId: string;
    payloads: Record<string, unknown>[];
  }) => {
    const { data } = await mutate({
      variables: { input: { workflowVersionId, payloads } },
    });

    const workflowRunIds =
      data?.runWorkflowVersionOnRecords?.workflowRunIds ?? [];

    if (workflowRunIds.length === 0) {
      enqueueSnackBar('Workflow run failed', {
        variant: SnackBarVariant.Error,
      });

      return;
    }

    enqueueSnackBar(`${workflowRunIds.length} workflow runs are running...`, {
      variant: SnackBarVariant.Success,
      icon: (
        <IconSettingsAutomation
          size={16}
          color={theme.snackBar.success.color}
        />
      ),
    });

    return workflowRunIds;
  };

  return { runWorkflowVersionOnRecords };
};
