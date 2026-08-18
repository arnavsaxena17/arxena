import { isDefined } from 'twenty-shared/utils';
import {
  workflowActionSchema,
  WorkflowActionType,
  workflowTriggerSchema,
} from 'twenty-shared/workflow';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { type RolePermissionConfig } from 'src/engine/twenty-orm/types/role-permission-config';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import {
  WorkflowVersionStepException,
  WorkflowVersionStepExceptionCode,
} from 'src/modules/workflow/common/exceptions/workflow-version-step.exception';
import { WorkflowVersionStatus } from 'src/modules/workflow/common/standard-objects/workflow-version.workspace-entity';
import {
  WorkflowStatus,
  type WorkflowWorkspaceEntity,
} from 'src/modules/workflow/common/standard-objects/workflow.workspace-entity';
import { type WorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';
import { createCompleteWorkflowLearnSchema } from 'src/modules/workflow/workflow-tools/tools/create-complete-workflow-learn.schema';
import {
  type WorkflowToolContext,
  type WorkflowToolDependencies,
} from 'src/modules/workflow/workflow-tools/types/workflow-tool-dependencies.type';
import { coerceCreateCompleteWorkflowInput } from 'src/modules/workflow/workflow-tools/utils/coerce-create-complete-workflow-input.util';
import { summarizeValidation } from 'src/modules/workflow/workflow-tools/utils/summarize-validation.util';
import { type WorkflowTrigger } from 'src/modules/workflow/workflow-trigger/types/workflow-trigger.type';

const createCompleteWorkflowSchema = z.object({
  name: z.string().describe('The name of the workflow'),
  description: z
    .string()
    .optional()
    .describe('Optional description of the workflow'),
  trigger: workflowTriggerSchema,
  steps: z
    .array(workflowActionSchema)
    .describe('Array of workflow action steps'),
  edges: z
    .array(
      z.object({
        source: z
          .string()
          .describe(
            'The ID of the source step (use "trigger" for trigger step)',
          ),
        target: z.string().describe('The ID of the target step'),
      }),
    )
    .optional()
    .describe('Optional array of connections between steps'),
  activate: z
    .boolean()
    .optional()
    .describe('Whether to activate the workflow immediately (default: false)'),
});

const formatZodError = (error: z.ZodError): string =>
  error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'input';

      return `${path}: ${issue.message}`;
    })
    .join('; ');

type CreateCompleteWorkflowToolDeps = Pick<
  WorkflowToolDependencies,
  | 'workflowVersionService'
  | 'workflowVersionEdgeService'
  | 'workflowTriggerService'
  | 'globalWorkspaceOrmManager'
  | 'recordPositionService'
  | 'workflowValidationService'
  | 'workflowVersionCoreSyncService'
  | 'workflowCommonService'
>;

type CreateCompleteWorkflowToolContext = WorkflowToolContext & {
  rolePermissionConfig: RolePermissionConfig;
};

export const createCreateCompleteWorkflowTool = (
  deps: CreateCompleteWorkflowToolDeps,
  context: CreateCompleteWorkflowToolContext,
) => ({
  name: 'create_complete_workflow' as const,
  description: `Create a complete workflow with trigger, steps, and connections in a single operation.

Do NOT inspect the spilled JSON Schema with code_interpreter. Use this description + list_logic_function_tools (includes inputSchema).

Trigger:
- type MUST be DATABASE_EVENT | MANUAL | CRON | WEBHOOK (never RECORD_CREATED)
- DATABASE_EVENT settings.eventName is "objectName.action" e.g. "company.created"
- Trigger record fields: {{trigger.properties.after.<field>}} — NOT {{trigger.fieldName}} or {{trigger.object.fieldName}}
- Step outputs: {{<step-uuid>.<field>}} — NOT {{step.result.field}}

Edges:
- { "source": "trigger", "target": "<step-uuid>" } — never from/to

LOGIC_FUNCTION steps:
- settings.input.logicFunctionId
- settings.input.logicFunctionInput (never flatten params onto settings.input)
- Call list_logic_function_tools for inputSchema. Native functions (isNative) ignore source code — do not call get_logic_function_source for them.
- GTM company.created / outreach recipes: load_skills(["gtm-outreach-workflows"]) — do not invent FIND_RECORDS + icpSpec unpacking.

Other:
- Each step needs id (UUID), name, type, valid, settings
- No CODE or AI_AGENT steps in this tool
- Positions are computed automatically
- errorHandlingOptions.retryOnFailure.value and continueOnFailure.value are booleans

Returns a compact validation summary. Call validate_workflow once after edits if needed.`,
  inputSchema: createCompleteWorkflowLearnSchema,
  execute: async (parameters: {
    name: string;
    description?: string;
    trigger: WorkflowTrigger;
    steps: WorkflowAction[];
    edges?: Array<{ source: string; target: string }>;
    activate?: boolean;
  }) => {
    let createdWorkflowId: string | undefined;

    try {
      const parsed = createCompleteWorkflowSchema.safeParse(
        coerceCreateCompleteWorkflowInput(parameters),
      );

      if (!parsed.success) {
        return {
          success: false,
          message: `Invalid workflow definition for "${parameters.name}"`,
          error: formatZodError(parsed.error),
        };
      }

      const definition = parsed.data;
      const codeSteps = definition.steps.filter(
        (step) => step.type === ('CODE' as string),
      );

      if (codeSteps.length > 0) {
        throw new WorkflowVersionStepException(
          'CODE steps cannot be created via create_complete_workflow because it does not create the underlying logic function. Use create_workflow_version_step instead.',
          WorkflowVersionStepExceptionCode.INVALID_REQUEST,
        );
      }

      const aiAgentSteps = definition.steps.filter(
        (step) => step.type === WorkflowActionType.AI_AGENT,
      );

      if (aiAgentSteps.length > 0) {
        throw new WorkflowVersionStepException(
          'AI_AGENT steps cannot be created via create_complete_workflow because it does not create the underlying agent. Use create_workflow_version_step instead, then call update_agent to configure the agent.',
          WorkflowVersionStepExceptionCode.INVALID_REQUEST,
        );
      }

      createdWorkflowId = await createWorkflow({
        deps,
        context,
        name: definition.name,
      });

      const workflowVersionId = await createWorkflowVersion({
        deps,
        context,
        workflowId: createdWorkflowId,
        trigger: definition.trigger,
        steps: definition.steps,
      });

      if (isDefined(definition.edges) && definition.edges.length > 0) {
        for (const edge of definition.edges) {
          await deps.workflowVersionEdgeService.createWorkflowVersionEdge({
            source: edge.source === 'trigger' ? 'trigger' : edge.source,
            target: edge.target,
            workflowVersionId,
            workspaceId: context.workspaceId,
          });
        }
      }

      await deps.workflowVersionService.autoLayoutWorkflowVersion({
        workflowVersionId,
        workspaceId: context.workspaceId,
      });

      if (definition.activate) {
        await deps.workflowTriggerService.activateWorkflowVersion(
          workflowVersionId,
          context.workspaceId,
        );

        await updateWorkflowStatus({
          deps,
          context,
          workflowId: createdWorkflowId,
          workflowVersionId,
        });
      }

      const validation =
        await deps.workflowValidationService.validateWorkflowDefinition({
          workspaceId: context.workspaceId,
          trigger: definition.trigger,
          steps: definition.steps,
        });

      return {
        success: true,
        message: `Workflow "${definition.name}" created successfully with ${definition.steps.length} steps`,
        result: {
          workflowId: createdWorkflowId,
          workflowVersionId,
          name: definition.name,
          stepIds: definition.steps.map((step) => step.id),
          validation: summarizeValidation(validation),
        },
        recordReferences: [
          {
            objectNameSingular: 'workflow',
            recordId: createdWorkflowId,
            displayName: definition.name,
          },
        ],
      };
    } catch (error) {
      if (isDefined(createdWorkflowId)) {
        await rollbackCreatedWorkflow({
          deps,
          context,
          workflowId: createdWorkflowId,
        });
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return {
        success: false,
        message: `Failed to create workflow "${parameters.name}": ${errorMessage}`,
        error: errorMessage,
      };
    }
  },
});

const rollbackCreatedWorkflow = async ({
  deps,
  context,
  workflowId,
}: {
  deps: CreateCompleteWorkflowToolDeps;
  context: CreateCompleteWorkflowToolContext;
  workflowId: string;
}) => {
  try {
    const authContext = buildSystemAuthContext(context.workspaceId);

    await deps.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      const workflowRepository =
        await deps.globalWorkspaceOrmManager.getRepository<WorkflowWorkspaceEntity>(
          context.workspaceId,
          'workflow',
          context.rolePermissionConfig,
        );

      await workflowRepository.softDelete(workflowId);
    }, authContext);

    await deps.workflowCommonService.handleWorkflowSubEntities({
      workflowIds: [workflowId],
      workspaceId: context.workspaceId,
      operation: 'delete',
    });
  } catch {
    // Best-effort: the original create error is more useful to the caller.
  }
};

const createWorkflow = async ({
  deps,
  context,
  name,
}: {
  deps: CreateCompleteWorkflowToolDeps;
  context: CreateCompleteWorkflowToolContext;
  name: string;
}): Promise<string> => {
  const authContext = buildSystemAuthContext(context.workspaceId);

  return deps.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
    const workflowRepository =
      await deps.globalWorkspaceOrmManager.getRepository(
        context.workspaceId,
        'workflow',
        context.rolePermissionConfig,
      );

    const workflowPosition =
      await deps.recordPositionService.buildRecordPosition({
        value: 'first',
        objectMetadata: {
          isCustom: false,
          nameSingular: 'workflow',
        },
        workspaceId: context.workspaceId,
      });

    const workflow = {
      id: uuidv4(),
      name,
      statuses: [WorkflowStatus.DRAFT],
      position: workflowPosition,
    };

    await workflowRepository.insert(workflow);

    return workflow.id;
  }, authContext);
};

const createWorkflowVersion = async ({
  deps,
  context,
  workflowId,
  trigger,
  steps,
}: {
  deps: CreateCompleteWorkflowToolDeps;
  context: CreateCompleteWorkflowToolContext;
  workflowId: string;
  trigger: WorkflowTrigger;
  steps: WorkflowAction[];
}): Promise<string> => {
  const workflowVersionId = uuidv4();

  await deps.workflowVersionCoreSyncService.writeWorkflowVersionAndMirror(
    context.workspaceId,
    async (workflowVersionRepository, entityManager) => {
      const versionPosition =
        await deps.recordPositionService.buildRecordPosition({
          value: 'first',
          objectMetadata: {
            isCustom: false,
            nameSingular: 'workflowVersion',
          },
          workspaceId: context.workspaceId,
        });

      await workflowVersionRepository.insert(
        {
          id: workflowVersionId,
          workflowId,
          name: 'v1',
          status: WorkflowVersionStatus.DRAFT,
          trigger,
          steps,
          position: versionPosition,
        },
        entityManager,
      );

      return workflowVersionId;
    },
  );

  return workflowVersionId;
};

const updateWorkflowStatus = async ({
  deps,
  context,
  workflowId,
  workflowVersionId,
}: {
  deps: CreateCompleteWorkflowToolDeps;
  context: CreateCompleteWorkflowToolContext;
  workflowId: string;
  workflowVersionId: string;
}) => {
  const authContext = buildSystemAuthContext(context.workspaceId);

  await deps.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
    const workflowRepository =
      await deps.globalWorkspaceOrmManager.getRepository(
        context.workspaceId,
        'workflow',
        context.rolePermissionConfig,
      );

    await workflowRepository.update(workflowId, {
      statuses: [WorkflowStatus.ACTIVE],
      lastPublishedVersionId: workflowVersionId,
    });
  }, authContext);
};
