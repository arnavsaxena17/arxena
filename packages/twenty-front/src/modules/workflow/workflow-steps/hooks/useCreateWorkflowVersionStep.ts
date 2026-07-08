import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { CoreObjectNameSingular } from '@/object-metadata/types/CoreObjectNameSingular';
import { useGetRecordFromCache } from '@/object-record/cache/hooks/useGetRecordFromCache';
import { updateRecordFromCache } from '@/object-record/cache/utils/updateRecordFromCache';
import { CREATE_WORKFLOW_VERSION_STEP } from '@/workflow/graphql/mutations/createWorkflowVersionStep';
import { WorkflowStep, WorkflowVersion } from '@/workflow/types/Workflow';
import { WorkflowDiagramCreateStepConnectionOptions } from '@/workflow/workflow-diagram/types/WorkflowDiagram';
import { TRIGGER_STEP_ID } from '@/workflow/workflow-trigger/constants/TriggerStepId';
import { insertStepInWorkflowVersion } from '@/workflow/workflow-steps/utils/insertStepInWorkflowVersion';
import { useApolloClient, useMutation } from '@apollo/client';
import { isDefined } from 'twenty-shared';
import {
  CreateWorkflowVersionStepInput,
  CreateWorkflowVersionStepMutation,
  CreateWorkflowVersionStepMutationVariables,
} from '~/generated/graphql';

type CreateWorkflowVersionStepParams = CreateWorkflowVersionStepInput & {
  connectionOptions?: WorkflowDiagramCreateStepConnectionOptions;
};

export const useCreateWorkflowVersionStep = () => {
  const apolloClient = useApolloClient();
  const { objectMetadataItems } = useObjectMetadataItems();
  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular: CoreObjectNameSingular.WorkflowVersion,
  });
  const getRecordFromCache = useGetRecordFromCache({
    objectNameSingular: CoreObjectNameSingular.WorkflowVersion,
  });
  const [mutate] = useMutation<
    CreateWorkflowVersionStepMutation,
    CreateWorkflowVersionStepMutationVariables
  >(CREATE_WORKFLOW_VERSION_STEP, {
    client: apolloClient,
  });
  const createWorkflowVersionStep = async (
    params: CreateWorkflowVersionStepParams,
  ) => {
    const { connectionOptions, ...input } = params;

    const result = await mutate({
      variables: { input },
    });
    const createdStep = result?.data?.createWorkflowVersionStep;
    if (!isDefined(createdStep)) {
      return;
    }

    const cachedRecord = getRecordFromCache<WorkflowVersion>(
      input.workflowVersionId,
    );
    if (!isDefined(cachedRecord)) {
      return;
    }

    const newStep = {
      ...(createdStep as unknown as WorkflowStep),
      nextStepIds: isDefined(input.nextStepId) ? [input.nextStepId] : [],
    };

    const { steps: updatedSteps, trigger: updatedTrigger } =
      insertStepInWorkflowVersion({
        steps: cachedRecord.steps ?? [],
        trigger: cachedRecord.trigger,
        newStep,
        parentStepId: input.parentStepId ?? undefined,
        nextStepId: input.nextStepId ?? undefined,
        connectionOptions,
        triggerStepId: TRIGGER_STEP_ID,
      });

    const newCachedRecord = {
      ...cachedRecord,
      steps: updatedSteps,
      trigger: updatedTrigger,
    };

    const recordGqlFields = {
      steps: true,
      trigger: true,
    };
    updateRecordFromCache({
      objectMetadataItems,
      objectMetadataItem,
      cache: apolloClient.cache,
      record: newCachedRecord,
      recordGqlFields,
    });
    return result;
  };

  return { createWorkflowVersionStep };
};
