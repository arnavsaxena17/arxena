import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { isNonEmptyString } from '@sniptt/guards';
import { CoreObjectNameSingular } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import { GTM_OUTREACH_WORKFLOW_B_NAME } from '@/gtm-home/constants/gtm-command.constants';
import { gtmCommandContextState } from '@/gtm-home/states/gtmCommandContextState';
import { useCreateOneRecord } from '@/object-record/hooks/useCreateOneRecord';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { type WorkflowStatus } from '@/workflow/types/Workflow';

export type GtmWorkflowEmbedMode = 'definition' | 'run';

export type GtmWorkflowOption = {
  id: string;
  label: string;
};

type GtmWorkflowRecord = ObjectRecord & {
  name?: string;
  statuses?: Array<WorkflowStatus> | null;
};

type GtmWorkflowRunRecord = ObjectRecord & {
  workflowId?: string;
  status?: string;
};

type GtmProjectRecord = ObjectRecord & {
  outreachWorkflowId?: string | null;
};

const isAvailableActiveWorkflow = (workflow: GtmWorkflowRecord): boolean => {
  const statuses = workflow.statuses ?? [];

  return statuses.includes('ACTIVE') === true;
};

export const useGtmWorkflowEmbed = (options?: { enabled?: boolean }) => {
  const isEnabled = options?.enabled !== false;
  const [searchParams, setSearchParams] = useSearchParams();
  const workflowIdFromQuery = searchParams.get('workflowId');
  const workflowRunIdFromQuery = searchParams.get('workflowRunId');
  const gtmCommandContext = useAtomStateValue(gtmCommandContextState);
  const setGtmCommandContext = useSetAtomState(gtmCommandContextState);
  const { updateOneRecord } = useUpdateOneRecord();
  const { createOneRecord: createWorkflow } = useCreateOneRecord({
    objectNameSingular: CoreObjectNameSingular.Workflow,
  });

  const [ensuredWorkflowId, setEnsuredWorkflowId] = useState<string | null>(
    null,
  );
  const [isEnsuringDefaultWorkflow, setIsEnsuringDefaultWorkflow] =
    useState(false);
  const [isSelectingWorkflow, setIsSelectingWorkflow] = useState(false);
  // Bridges the gap between dropdown click and Project/Apollo pin catching up.
  const [selectedWorkflowIdOverride, setSelectedWorkflowIdOverride] = useState<
    string | null
  >(null);
  const ensureInFlightRef = useRef(false);

  const { records: projects, loading: projectsLoading } =
    useFindManyRecords<GtmProjectRecord>({
      objectNameSingular: 'project',
      filter: isDefined(gtmCommandContext.projectId)
        ? {
            id: {
              eq: gtmCommandContext.projectId,
            },
          }
        : undefined,
      limit: 1,
      skip: !isEnabled || !isDefined(gtmCommandContext.projectId),
      recordGqlFields: {
        id: true,
        outreachWorkflowId: true,
      },
    });

  const projectId = gtmCommandContext.projectId ?? projects[0]?.id ?? null;
  const projectOutreachWorkflowId =
    gtmCommandContext.outreachWorkflowId ??
    projects[0]?.outreachWorkflowId ??
    null;

  const { records: defaultOutreachWorkflows, loading: defaultWorkflowLoading } =
    useFindManyRecords<GtmWorkflowRecord>({
      objectNameSingular: CoreObjectNameSingular.Workflow,
      filter: {
        name: {
          eq: GTM_OUTREACH_WORKFLOW_B_NAME,
        },
      },
      limit: 1,
      skip: !isEnabled,
      recordGqlFields: {
        id: true,
        name: true,
        statuses: true,
      },
    });

  const { records: workflows, loading: workflowsLoading } =
    useFindManyRecords<GtmWorkflowRecord>({
      objectNameSingular: CoreObjectNameSingular.Workflow,
      orderBy: [{ createdAt: 'DescNullsFirst' }],
      limit: 50,
      skip: !isEnabled,
      recordGqlFields: {
        id: true,
        name: true,
        statuses: true,
      },
    });

  const defaultOutreachWorkflowId =
    defaultOutreachWorkflows[0]?.id ??
    workflows.find((workflow) => workflow.name === GTM_OUTREACH_WORKFLOW_B_NAME)
      ?.id ??
    ensuredWorkflowId;

  const resolvedWorkflowId =
    selectedWorkflowIdOverride ??
    workflowIdFromQuery ??
    (isNonEmptyString(projectOutreachWorkflowId)
      ? projectOutreachWorkflowId
      : null) ??
    defaultOutreachWorkflowId ??
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
      skip: !isEnabled || !resolvedWorkflowId,
      recordGqlFields: {
        id: true,
        workflowId: true,
        status: true,
      },
    });

  const resolvedWorkflowRunId =
    workflowRunIdFromQuery ?? workflowRuns[0]?.id ?? null;

  const workflowOptions = useMemo((): GtmWorkflowOption[] => {
    const options = workflows
      .filter(isAvailableActiveWorkflow)
      .map((workflow) => ({
        id: workflow.id,
        label: workflow.name ?? workflow.id,
      }));

    // Keep the current pin visible even if it is not ACTIVE (e.g. Stage B draft).
    if (
      isDefined(resolvedWorkflowId) &&
      !options.some((option) => option.id === resolvedWorkflowId)
    ) {
      const selectedWorkflow = workflows.find(
        (workflow) => workflow.id === resolvedWorkflowId,
      );

      options.unshift({
        id: resolvedWorkflowId,
        label: selectedWorkflow?.name ?? resolvedWorkflowId,
      });
    }

    return options;
  }, [resolvedWorkflowId, workflows]);

  const bindOutreachWorkflowToProject = useCallback(
    async (workflowId: string) => {
      setGtmCommandContext((previous) => ({
        ...previous,
        outreachWorkflowId: workflowId,
      }));

      if (!isDefined(projectId)) {
        return;
      }

      if (projects[0]?.outreachWorkflowId === workflowId) {
        return;
      }

      await updateOneRecord({
        objectNameSingular: 'project',
        idToUpdate: projectId,
        updateOneRecordInput: {
          outreachWorkflowId: workflowId,
        },
      });
    },
    [projectId, projects, setGtmCommandContext, updateOneRecord],
  );

  const selectOutreachWorkflow = useCallback(
    async (workflowId: string) => {
      if (!isNonEmptyString(workflowId) || workflowId === resolvedWorkflowId) {
        return;
      }

      setIsSelectingWorkflow(true);
      setSelectedWorkflowIdOverride(workflowId);

      try {
        // Drop deep-link overrides so Project.outreachWorkflowId wins after switch.
        if (
          searchParams.has('workflowId') ||
          searchParams.has('workflowRunId')
        ) {
          const nextSearchParams = new URLSearchParams(searchParams);

          nextSearchParams.delete('workflowId');
          nextSearchParams.delete('workflowRunId');
          setSearchParams(nextSearchParams, { replace: true });
        }

        await bindOutreachWorkflowToProject(workflowId);
      } catch (error) {
        setSelectedWorkflowIdOverride(null);
        throw error;
      } finally {
        setIsSelectingWorkflow(false);
      }
    },
    [
      bindOutreachWorkflowToProject,
      resolvedWorkflowId,
      searchParams,
      setSearchParams,
    ],
  );

  useEffect(() => {
    if (
      isNonEmptyString(selectedWorkflowIdOverride) &&
      projectOutreachWorkflowId === selectedWorkflowIdOverride
    ) {
      setSelectedWorkflowIdOverride(null);
    }
  }, [projectOutreachWorkflowId, selectedWorkflowIdOverride]);

  useEffect(() => {
    setSelectedWorkflowIdOverride(null);
  }, [projectId]);

  // Create the Stage B default when missing, and bind it only if Project has none.
  useEffect(() => {
    if (!isEnabled || !isDefined(projectId)) {
      return;
    }

    if (
      projectsLoading ||
      defaultWorkflowLoading ||
      workflowsLoading ||
      ensureInFlightRef.current
    ) {
      return;
    }

    if (isNonEmptyString(workflowIdFromQuery)) {
      return;
    }

    // Keep an explicit Project pin — do not overwrite with the Stage B default.
    if (isNonEmptyString(projectOutreachWorkflowId)) {
      return;
    }

    if (isNonEmptyString(defaultOutreachWorkflowId)) {
      void bindOutreachWorkflowToProject(defaultOutreachWorkflowId);

      return;
    }

    ensureInFlightRef.current = true;
    setIsEnsuringDefaultWorkflow(true);

    void (async () => {
      try {
        const created = await createWorkflow({
          name: GTM_OUTREACH_WORKFLOW_B_NAME,
        });

        if (!isDefined(created?.id)) {
          return;
        }

        setEnsuredWorkflowId(created.id);
        await bindOutreachWorkflowToProject(created.id);
      } finally {
        ensureInFlightRef.current = false;
        setIsEnsuringDefaultWorkflow(false);
      }
    })();
  }, [
    bindOutreachWorkflowToProject,
    createWorkflow,
    defaultOutreachWorkflowId,
    defaultWorkflowLoading,
    isEnabled,
    projectId,
    projectOutreachWorkflowId,
    projectsLoading,
    workflowIdFromQuery,
    workflowsLoading,
  ]);

  return {
    workflowId: resolvedWorkflowId,
    workflowRunId: resolvedWorkflowRunId,
    workflowOptions,
    selectOutreachWorkflow,
    isSelectingWorkflow,
    workflowsLoading:
      workflowsLoading ||
      projectsLoading ||
      defaultWorkflowLoading ||
      isEnsuringDefaultWorkflow,
    runsLoading,
    hasWorkflow: resolvedWorkflowId !== null,
    hasWorkflowRun: resolvedWorkflowRunId !== null,
    projectId,
    projectOutreachWorkflowId,
    defaultOutreachWorkflowId,
    isEnsuringDefaultWorkflow,
  };
};
