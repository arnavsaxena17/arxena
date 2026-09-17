import { useMutation } from '@apollo/client/react';

import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { BULK_FORCE_STOP_WORKFLOW_RUNS } from '@/workflow/graphql/mutations/bulkForceStopWorkflowRuns';

type BulkForceStopWorkflowRunsMutation = {
  bulkForceStopWorkflowRuns: {
    stoppedCount: number;
  };
};

type BulkForceStopWorkflowRunsMutationVariables = {
  workflowId: string;
};

export const useBulkForceStopWorkflowRuns = () => {
  const apolloCoreClient = useApolloCoreClient();
  const [mutate] = useMutation<
    BulkForceStopWorkflowRunsMutation,
    BulkForceStopWorkflowRunsMutationVariables
  >(BULK_FORCE_STOP_WORKFLOW_RUNS, {
    client: apolloCoreClient,
  });

  const bulkForceStopWorkflowRuns = async (workflowId: string) => {
    const result = await mutate({
      variables: {
        workflowId,
      },
    });

    return result.data?.bulkForceStopWorkflowRuns.stoppedCount ?? 0;
  };

  return { bulkForceStopWorkflowRuns };
};
