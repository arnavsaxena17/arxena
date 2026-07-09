import { useApolloClient, useMutation } from '@apollo/client';

import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { CoreObjectNameSingular } from '@/object-metadata/types/CoreObjectNameSingular';
import { modifyRecordFromCache } from '@/object-record/cache/utils/modifyRecordFromCache';
import { STOP_WORKFLOW_RUN } from '@/workflow/graphql/mutations/stopWorkflowRun';

type StopWorkflowRunMutation = {
  stopWorkflowRun: {
    id: string;
    status: string;
    __typename: string;
  };
};

type StopWorkflowRunMutationVariables = {
  workflowRunId: string;
};

export const useStopWorkflowRun = () => {
  const apolloClient = useApolloClient();

  const [mutate] = useMutation<
    StopWorkflowRunMutation,
    StopWorkflowRunMutationVariables
  >(STOP_WORKFLOW_RUN, {
    client: apolloClient,
  });

  const { objectMetadataItem: objectMetadataItemWorkflowRun } =
    useObjectMetadataItem({
      objectNameSingular: CoreObjectNameSingular.WorkflowRun,
    });

  const stopWorkflowRun = async (workflowRunId: string) => {
    const result = await mutate({
      variables: {
        workflowRunId,
      },
    });

    const stoppedWorkflowRun = result.data?.stopWorkflowRun;

    if (stoppedWorkflowRun) {
      modifyRecordFromCache({
        cache: apolloClient.cache,
        recordId: workflowRunId,
        objectMetadataItem: objectMetadataItemWorkflowRun,
        fieldModifiers: {
          status: () => stoppedWorkflowRun.status,
        },
      });
    }

    return stoppedWorkflowRun;
  };

  return { stopWorkflowRun };
};
