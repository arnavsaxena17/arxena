import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CoreObjectNameSingular } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { gtmCommandContextState } from '@/gtm-home/states/gtmCommandContextState';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';

export type GtmWorkflowEmbedMode = 'definition' | 'run';

type GtmWorkflowRecord = ObjectRecord & {
  name?: string;
};

type GtmWorkflowRunRecord = ObjectRecord & {
  workflowId?: string;
  status?: string;
};

type GtmProjectRecord = ObjectRecord & {
  gtmRunKey?: string | null;
  outreachWorkflowId?: string | null;
};

export const useGtmWorkflowEmbed = () => {
  const [searchParams] = useSearchParams();
  const workflowIdFromQuery = searchParams.get('workflowId');
  const workflowRunIdFromQuery = searchParams.get('workflowRunId');
  const commandContext = useAtomStateValue(gtmCommandContextState);

  const { records: projects, loading: projectsLoading } =
    useFindManyRecords<GtmProjectRecord>({
      objectNameSingular: 'project',
      filter: isDefined(commandContext.projectId)
        ? {
            id: {
              eq: commandContext.projectId,
            },
          }
        : undefined,
      limit: 1,
      skip: !isDefined(commandContext.projectId),
      recordGqlFields: {
        id: true,
        gtmRunKey: true,
        outreachWorkflowId: true,
      },
    });

  const projectOutreachWorkflowId =
    commandContext.outreachWorkflowId ??
    projects[0]?.outreachWorkflowId ??
    null;

  const { records: workflows, loading: workflowsLoading } =
    useFindManyRecords<GtmWorkflowRecord>({
      objectNameSingular: CoreObjectNameSingular.Workflow,
      orderBy: [{ createdAt: 'DescNullsFirst' }],
      limit: 20,
      recordGqlFields: {
        id: true,
        name: true,
      },
    });

  const resolvedWorkflowId =
    workflowIdFromQuery ??
    projectOutreachWorkflowId ??
    workflows[0]?.id ??
    null;

  const { records: workflowRuns, loading: runsLoading } =
    useFindManyRecords<GtmWorkflowRunRecord>({
      objectNameSingular: CoreObjectNameSingular.WorkflowRun,
      filter: resolvedWorkflowId
        ? {
            workflowId: {
              eq: resolvedWorkflowId,
            },
          }
        : undefined,
      orderBy: [{ createdAt: 'DescNullsFirst' }],
      limit: 10,
      skip: !resolvedWorkflowId,
      recordGqlFields: {
        id: true,
        workflowId: true,
        status: true,
      },
    });

  const resolvedWorkflowRunId =
    workflowRunIdFromQuery ?? workflowRuns[0]?.id ?? null;

  const workflowOptions = useMemo(
    () =>
      workflows.map((workflow) => ({
        id: workflow.id,
        label: workflow.name ?? workflow.id,
      })),
    [workflows],
  );

  return {
    workflowId: resolvedWorkflowId,
    workflowRunId: resolvedWorkflowRunId,
    workflowOptions,
    workflowsLoading: workflowsLoading || projectsLoading,
    runsLoading,
    hasWorkflow: resolvedWorkflowId !== null,
    hasWorkflowRun: resolvedWorkflowRunId !== null,
    projectId: commandContext.projectId ?? projects[0]?.id ?? null,
    projectOutreachWorkflowId,
  };
};
