import { FieldActorSource } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { z } from 'zod';

import { type RolePermissionConfig } from 'src/engine/twenty-orm/types/role-permission-config';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { SEEDED_OUTREACH_WORKFLOW } from 'src/engine/workspace-manager/standard-objects-prefill-data/constants/seeded-outreach-workflow-names.const';
import { WorkflowVersionStatus } from 'src/modules/workflow/common/standard-objects/workflow-version.workspace-entity';
import { type WorkflowVersionWorkspaceEntity } from 'src/modules/workflow/common/standard-objects/workflow-version.workspace-entity';
import { type WorkflowRunWorkspaceEntity } from 'src/modules/workflow/common/standard-objects/workflow-run.workspace-entity';
import { type WorkflowWorkspaceEntity } from 'src/modules/workflow/common/standard-objects/workflow.workspace-entity';
import { WorkflowTriggerType } from 'src/modules/workflow/workflow-trigger/types/workflow-trigger.type';
import {
  type WorkflowToolContext,
  type WorkflowToolDependencies,
} from 'src/modules/workflow/workflow-tools/types/workflow-tool-dependencies.type';

type RunWorkflowToolContext = WorkflowToolContext & {
  rolePermissionConfig: RolePermissionConfig;
};

// One entry per seeded campaign workflow the agent may start by name.
// The tool description is generated from this map so the skill text and the
// tool cannot disagree about payload shapes.
export const RUN_WORKFLOW_PAYLOAD_SCHEMAS = {
  'Find companies': z.object({
    projectId: z.uuid(),
    limit: z.number().int().min(1).max(200).optional(),
    query: z.string().optional(),
    keywords: z.string().optional(),
    industry: z.string().optional(),
    location: z.string().optional(),
    url: z.string().optional(),
  }),
  'Find people by company': z.object({
    projectId: z.uuid(),
    companyId: z.uuid(),
    limit: z.number().int().min(1).max(50).optional(),
  }),
  'Find people by search': z
    .object({
      projectId: z.uuid(),
      limit: z.number().int().min(1).max(200).optional(),
    })
    .passthrough(),
} as const;

export type RunnableWorkflowName = keyof typeof RUN_WORKFLOW_PAYLOAD_SCHEMAS;

const RUNNABLE_WORKFLOW_NAMES = Object.keys(RUN_WORKFLOW_PAYLOAD_SCHEMAS) as [
  RunnableWorkflowName,
  ...RunnableWorkflowName[],
];

const PAYLOAD_SHAPES: Record<RunnableWorkflowName, string> = {
  'Find companies':
    '{ projectId, limit?, query?, keywords?, industry?, location?, url? }',
  'Find people by company':
    '{ projectId, companyId, limit? } (one company per call)',
  'Find people by search':
    '{ projectId, limit?, ...LinkedIn people-search parameters }',
};

// Tool-facing names are the seeded workflow names.
// Each already contains the AI filtering step; the tool only starts them.
export const RUN_WORKFLOW_SEEDED_NAMES: Record<RunnableWorkflowName, string> = {
  'Find companies': SEEDED_OUTREACH_WORKFLOW.harvest.name,
  'Find people by company': SEEDED_OUTREACH_WORKFLOW.companySearch.name,
  'Find people by search':
    SEEDED_OUTREACH_WORKFLOW.searchAndUploadPeopleProfiles.name,
};

const runWorkflowSchema = z.object({
  workflow: z.enum(RUNNABLE_WORKFLOW_NAMES),
  payload: z.record(z.string(), z.unknown()),
});

type RunWorkflowInput = z.infer<typeof runWorkflowSchema>;

const ACTIVE_RUN_STATUSES = ['NOT_STARTED', 'ENQUEUED', 'RUNNING'];

export const createRunWorkflowTool = (
  deps: Pick<
    WorkflowToolDependencies,
    'globalWorkspaceOrmManager' | 'workflowTriggerService'
  >,
  context: RunWorkflowToolContext,
) => ({
  name: 'run_workflow' as const,
  description: `Start a seeded outreach workflow by name with a validated payload and return the run id. Follow the run with get_workflow_run; a run that is rate limited resumes on its own, never resend it. Payloads: ${Object.entries(
    PAYLOAD_SHAPES,
  )
    .map(([name, shape]) => `"${name}" ${shape}`)
    .join('; ')}.`,
  inputSchema: runWorkflowSchema,
  execute: async (parameters: RunWorkflowInput) => {
    try {
      const parsedPayload = RUN_WORKFLOW_PAYLOAD_SCHEMAS[
        parameters.workflow
      ].safeParse(parameters.payload);

      if (!parsedPayload.success) {
        return {
          success: false,
          error: `Invalid payload for "${parameters.workflow}". Expected ${PAYLOAD_SHAPES[parameters.workflow]}. ${parsedPayload.error.message}`,
        };
      }

      const payload = parsedPayload.data as Record<string, unknown>;
      const authContext = buildSystemAuthContext(context.workspaceId);

      const resolved =
        await deps.globalWorkspaceOrmManager.executeInWorkspaceContext(
          async () => {
            const workflowRepository =
              await deps.globalWorkspaceOrmManager.getRepository<WorkflowWorkspaceEntity>(
                context.workspaceId,
                'workflow',
                context.rolePermissionConfig,
              );
            const workflow = await workflowRepository.findOne({
              where: {
                name: RUN_WORKFLOW_SEEDED_NAMES[parameters.workflow],
              },
            });

            if (!isDefined(workflow) || !workflow.lastPublishedVersionId) {
              return {
                error: `Workflow "${parameters.workflow}" (seeded as "${RUN_WORKFLOW_SEEDED_NAMES[parameters.workflow]}") is missing or has no published version: activate its draft with activate_workflow_version.`,
              } as const;
            }

            const versionRepository =
              await deps.globalWorkspaceOrmManager.getRepository<WorkflowVersionWorkspaceEntity>(
                context.workspaceId,
                'workflowVersion',
                context.rolePermissionConfig,
              );
            const version = await versionRepository.findOne({
              where: { id: workflow.lastPublishedVersionId },
            });

            if (
              !isDefined(version) ||
              version.status !== WorkflowVersionStatus.ACTIVE ||
              version.trigger?.type !== WorkflowTriggerType.WEBHOOK
            ) {
              return {
                error: `Workflow "${parameters.workflow}" has no active webhook-triggered version. Seeded workflows start as drafts: activate it with activate_workflow_version, then run it again.`,
              } as const;
            }

            // Skip a duplicate start: the agent may repeat a call.
            const companyId = payload.companyId;

            if (typeof companyId === 'string') {
              const runRepository =
                await deps.globalWorkspaceOrmManager.getRepository<WorkflowRunWorkspaceEntity>(
                  context.workspaceId,
                  'workflowRun',
                  context.rolePermissionConfig,
                );
              const recentRuns = await runRepository.find({
                where: { workflowId: workflow.id },
                order: { createdAt: 'DESC' },
                take: 200,
              });
              // The webhook payload is the trigger step's result in stepInfos.
              const duplicate = recentRuns.find(
                (run) =>
                  ACTIVE_RUN_STATUSES.includes(run.status) &&
                  JSON.stringify(run.state?.stepInfos ?? {}).includes(
                    companyId,
                  ),
              );

              if (isDefined(duplicate)) {
                return { duplicateRunId: duplicate.id } as const;
              }
            }

            return { workflow, version } as const;
          },
          authContext,
        );

      if ('error' in resolved) {
        return { success: false, error: resolved.error };
      }

      if ('duplicateRunId' in resolved) {
        return {
          success: true,
          skipped: true,
          workflowRunId: resolved.duplicateRunId,
          message: `A run for this company is already active (${resolved.duplicateRunId}); not started again.`,
        };
      }

      const { workflowRunId } =
        await deps.workflowTriggerService.runWorkflowVersion({
          workflowVersionId: resolved.version.id,
          payload,
          createdBy: {
            source: FieldActorSource.AGENT,
            workspaceMemberId: null,
            name: 'Ask AI',
            context: {},
          },
          workspaceId: context.workspaceId,
        });

      return {
        success: true,
        workflowRunId,
        workflow: parameters.workflow,
        message: `Started "${parameters.workflow}". Follow it with get_workflow_run.`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      return {
        success: false,
        error: message,
        message: `Failed to run workflow: ${message}`,
      };
    }
  },
});
