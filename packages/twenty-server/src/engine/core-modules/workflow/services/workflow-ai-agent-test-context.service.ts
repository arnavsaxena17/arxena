import { Injectable } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined, isValidUuid, resolveInput } from 'twenty-shared/utils';
import { TRIGGER_STEP_ID } from 'twenty-shared/workflow';
import { type ObjectLiteral } from 'typeorm';

import { isUserAuthContext } from 'src/engine/core-modules/auth/guards/is-user-auth-context.guard';
import { getWorkspaceAuthContext } from 'src/engine/core-modules/auth/storage/workspace-auth-context.storage';
import { NativeLogicFunctionRegistry } from 'src/engine/core-modules/logic-function/logic-function-executor/native-logic-function.registry';
import {
  findWorkflowStepOrThrow,
  getWorkflowStepsToHydrateForPrompt,
} from 'src/engine/core-modules/workflow/utils/get-workflow-previous-steps.util';
import {
  buildFindRecordsStepResult,
  resolveWorkflowPromptFromContext,
} from 'src/engine/core-modules/workflow/utils/resolve-workflow-prompt-from-context.util';
import { WorkspaceManyOrAllFlatEntityMapsCacheService } from 'src/engine/metadata-modules/flat-entity/services/workspace-many-or-all-flat-entity-maps-cache.service';
import { findFlatEntityByIdInFlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-id-in-flat-entity-maps.util';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { WorkflowCommonWorkspaceService } from 'src/modules/workflow/common/workspace-services/workflow-common.workspace-service';
import { isWorkflowLogicFunctionAction } from 'src/modules/workflow/workflow-executor/workflow-actions/logic-function/guards/is-workflow-logic-function-action.guard';
import { isWorkflowFindRecordsAction } from 'src/modules/workflow/workflow-executor/workflow-actions/record-crud/guards/is-workflow-find-records-action.guard';
import { type WorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';

const CANDIDATE_OBJECT_NAME = 'candidate';
const WORKSPACE_MEMBER_OBJECT_NAME = 'workspaceMember';
const WORKSPACE_MEMBER_PROFILE_OBJECT_NAME = 'workspaceMemberProfile';
const CHAT_MESSAGE_OBJECT_NAME = 'chatMessage';

type RecordWithId = ObjectLiteral & { id: string };

@Injectable()
export class WorkflowAiAgentTestContextService {
  constructor(
    private readonly workflowCommonWorkspaceService: WorkflowCommonWorkspaceService,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly flatEntityMapsCacheService: WorkspaceManyOrAllFlatEntityMapsCacheService,
    private readonly nativeLogicFunctionRegistry: NativeLogicFunctionRegistry,
  ) {}

  async resolvePromptForCandidate({
    workspaceId,
    workflowVersionId,
    stepId,
    candidateId,
    prompt,
  }: {
    workspaceId: string;
    workflowVersionId: string;
    stepId: string;
    candidateId: string;
    prompt: string;
  }): Promise<string> {
    if (!isValidUuid(candidateId)) {
      throw new Error('Candidate id must be a valid UUID');
    }

    const authContext = getWorkspaceAuthContext();

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const workflowVersion =
          await this.workflowCommonWorkspaceService.getWorkflowVersionOrFail({
            workspaceId,
            workflowVersionId,
          });
        const steps = workflowVersion.steps;

        if (!isDefined(steps) || steps.length === 0) {
          throw new Error('Workflow version has no steps');
        }

        const currentStep = findWorkflowStepOrThrow({ steps, stepId });
        const candidate = await this.findRecordById({
          workspaceId,
          objectName: CANDIDATE_OBJECT_NAME,
          recordId: candidateId,
        });

        if (!isDefined(candidate)) {
          throw new Error(`Candidate ${candidateId} was not found`);
        }

        const workspaceMemberId = isUserAuthContext(authContext)
          ? authContext.workspaceMemberId
          : undefined;

        const context: Record<string, unknown> = {
          [TRIGGER_STEP_ID]: {
            properties: {
              after: candidate,
            },
          },
        };

        const previousSteps = getWorkflowStepsToHydrateForPrompt({
          steps,
          currentStep,
          prompt,
        });

        for (const previousStep of previousSteps) {
          const stepResult = await this.executePredecessorStep({
            workspaceId,
            step: previousStep,
            candidateId,
            workspaceMemberId,
            context,
          });

          if (isDefined(stepResult)) {
            context[previousStep.id] = stepResult;
          }
        }

        const { resolvedPrompt, missingVariablePaths } =
          resolveWorkflowPromptFromContext({ prompt, context });

        if (missingVariablePaths.length > 0) {
          throw new Error(
            `Could not fill prompt chips from this candidate: ${missingVariablePaths.join(', ')}`,
          );
        }

        return resolvedPrompt;
      },
      authContext,
    );
  }

  private async executePredecessorStep({
    workspaceId,
    step,
    context,
    candidateId,
    workspaceMemberId,
  }: {
    workspaceId: string;
    step: WorkflowAction;
    context: Record<string, unknown>;
    candidateId: string;
    workspaceMemberId?: string;
  }): Promise<unknown> {
    if (isWorkflowFindRecordsAction(step)) {
      return this.executeFindRecordsPredecessor({
        workspaceId,
        objectName: step.settings.input.objectName,
        candidateId,
        workspaceMemberId,
      });
    }

    if (isWorkflowLogicFunctionAction(step)) {
      return this.executeLogicFunctionPredecessor({
        workspaceId,
        step,
        context,
      });
    }

    return undefined;
  }

  private async executeFindRecordsPredecessor({
    workspaceId,
    objectName,
    candidateId,
    workspaceMemberId,
  }: {
    workspaceId: string;
    objectName: string;
    candidateId: string;
    workspaceMemberId?: string;
  }): Promise<unknown> {
    if (objectName === CANDIDATE_OBJECT_NAME) {
      const candidate = await this.findRecordById({
        workspaceId,
        objectName,
        recordId: candidateId,
      });

      return isDefined(candidate)
        ? buildFindRecordsStepResult([candidate])
        : undefined;
    }

    if (objectName === WORKSPACE_MEMBER_OBJECT_NAME) {
      if (!isNonEmptyString(workspaceMemberId)) {
        return undefined;
      }

      const workspaceMember = await this.findRecordById({
        workspaceId,
        objectName,
        recordId: workspaceMemberId,
      });

      return isDefined(workspaceMember)
        ? buildFindRecordsStepResult([workspaceMember])
        : undefined;
    }

    if (objectName === WORKSPACE_MEMBER_PROFILE_OBJECT_NAME) {
      if (!isNonEmptyString(workspaceMemberId)) {
        return undefined;
      }

      const profiles = await this.findRecords({
        workspaceId,
        objectName,
        where: { workspaceMemberId },
        take: 1,
      });

      return buildFindRecordsStepResult(profiles);
    }

    if (objectName === CHAT_MESSAGE_OBJECT_NAME) {
      const chatMessages = await this.findRecords({
        workspaceId,
        objectName,
        where: { candidateId },
        order: { createdAt: 'DESC' },
        take: 20,
      });

      return buildFindRecordsStepResult(chatMessages);
    }

    return undefined;
  }

  private async executeLogicFunctionPredecessor({
    workspaceId,
    step,
    context,
  }: {
    workspaceId: string;
    step: WorkflowAction;
    context: Record<string, unknown>;
  }): Promise<unknown> {
    if (!isWorkflowLogicFunctionAction(step)) {
      return undefined;
    }

    const { logicFunctionId, logicFunctionInput } = step.settings.input;
    const { flatLogicFunctionMaps } =
      await this.flatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps(
        {
          workspaceId,
          flatMapsKeys: ['flatLogicFunctionMaps'],
        },
      );
    const logicFunction = findFlatEntityByIdInFlatEntityMaps({
      flatEntityId: logicFunctionId,
      flatEntityMaps: flatLogicFunctionMaps,
    });

    if (!isDefined(logicFunction)) {
      throw new Error(`Logic function ${logicFunctionId} was not found`);
    }

    const nativeHandler = this.nativeLogicFunctionRegistry.find(
      logicFunction.name,
    );

    if (!isDefined(nativeHandler)) {
      return undefined;
    }

    const payload = resolveInput(logicFunctionInput ?? {}, context) as object;
    const nativeResult = await nativeHandler.execute({
      name: logicFunction.name,
      workspaceId,
      payload,
      stepId: step.id,
    });

    const nativeErrorMessage = this.readNativeLogicFunctionError(nativeResult);

    if (isNonEmptyString(nativeErrorMessage)) {
      throw new Error(`${logicFunction.name} failed: ${nativeErrorMessage}`);
    }

    return nativeResult;
  }

  private readNativeLogicFunctionError(
    nativeResult: unknown,
  ): string | undefined {
    if (
      !isDefined(nativeResult) ||
      typeof nativeResult !== 'object' ||
      !('success' in nativeResult) ||
      (nativeResult as { success?: unknown }).success !== false
    ) {
      return undefined;
    }

    const nativeError =
      'error' in nativeResult
        ? (nativeResult as { error?: unknown }).error
        : undefined;

    return typeof nativeError === 'string'
      ? nativeError
      : 'Native logic function failed';
  }

  private async findRecordById({
    workspaceId,
    objectName,
    recordId,
  }: {
    workspaceId: string;
    objectName: string;
    recordId: string;
  }): Promise<RecordWithId | null> {
    const records = await this.findRecords({
      workspaceId,
      objectName,
      where: { id: recordId },
      take: 1,
    });

    return records[0] ?? null;
  }

  private async findRecords({
    workspaceId,
    objectName,
    where,
    order,
    take,
  }: {
    workspaceId: string;
    objectName: string;
    where: Record<string, unknown>;
    order?: Record<string, 'ASC' | 'DESC'>;
    take?: number;
  }): Promise<RecordWithId[]> {
    const repository =
      await this.globalWorkspaceOrmManager.getRepository<RecordWithId>(
        workspaceId,
        objectName,
        { shouldBypassPermissionChecks: true },
      );

    return repository.find({
      where,
      ...(isDefined(order) ? { order } : {}),
      ...(isDefined(take) ? { take } : {}),
    });
  }
}
