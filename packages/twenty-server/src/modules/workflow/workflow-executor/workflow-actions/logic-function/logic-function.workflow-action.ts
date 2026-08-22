import { Injectable } from '@nestjs/common';

import { isDefined, resolveInput } from 'twenty-shared/utils';

import { type WorkflowAction } from 'src/modules/workflow/workflow-executor/interfaces/workflow-action.interface';

import {
  isAccountRateLimitDeferredError,
  LINKEDIN_RATE_LIMIT_PENDING_REASON,
  parseWaitMsFromAccountRateLimitMessage,
} from 'src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';

import { LogicFunctionExecutorService } from 'src/engine/core-modules/logic-function/logic-function-executor/logic-function-executor.service';
import { NativeLogicFunctionRegistry } from 'src/engine/core-modules/logic-function/logic-function-executor/native-logic-function.registry';
import { findFlatEntityByIdInFlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-id-in-flat-entity-maps.util';
import { WorkspaceManyOrAllFlatEntityMapsCacheService } from 'src/engine/metadata-modules/flat-entity/services/workspace-many-or-all-flat-entity-maps-cache.service';
import {
  WorkflowStepExecutorException,
  WorkflowStepExecutorExceptionCode,
} from 'src/modules/workflow/workflow-executor/exceptions/workflow-step-executor.exception';
import { type WorkflowActionInput } from 'src/modules/workflow/workflow-executor/types/workflow-action-input';
import { type WorkflowActionOutput } from 'src/modules/workflow/workflow-executor/types/workflow-action-output.type';
import { findStepOrThrow } from 'src/modules/workflow/workflow-executor/utils/find-step-or-throw.util';
import { RESUME_DELAYED_WORKFLOW_JOB_NAME } from 'src/modules/workflow/workflow-executor/workflow-actions/delay/contants/resume-delayed-workflow-job-name';
import { ResumeDelayedWorkflowJobData } from 'src/modules/workflow/workflow-executor/workflow-actions/delay/types/resume-delayed-workflow-job-data.type';
import { isWorkflowLogicFunctionAction } from 'src/modules/workflow/workflow-executor/workflow-actions/logic-function/guards/is-workflow-logic-function-action.guard';
import { WorkflowLogicFunctionActionInput } from 'src/modules/workflow/workflow-executor/workflow-actions/logic-function/types/workflow-logic-function-action-input.type';
import { buildRunWorkflowJobOptions } from 'src/modules/workflow/workflow-runner/utils/build-run-workflow-job-options.util';

@Injectable()
export class LogicFunctionWorkflowAction implements WorkflowAction {
  constructor(
    private readonly logicFunctionExecutorService: LogicFunctionExecutorService,
    private readonly flatEntityMapsCacheService: WorkspaceManyOrAllFlatEntityMapsCacheService,
    private readonly nativeLogicFunctionRegistry: NativeLogicFunctionRegistry,
    @InjectMessageQueue(MessageQueue.delayedJobsQueue)
    private readonly delayedQueue: MessageQueueService,
  ) {}

  async execute({
    currentStepId,
    steps,
    context,
    runInfo,
  }: WorkflowActionInput): Promise<WorkflowActionOutput> {
    const step = findStepOrThrow({
      stepId: currentStepId,
      steps,
    });

    if (!isWorkflowLogicFunctionAction(step)) {
      throw new WorkflowStepExecutorException(
        'Step is not a logic function action',
        WorkflowStepExecutorExceptionCode.INVALID_STEP_TYPE,
      );
    }

    const workflowActionInput = resolveInput(
      step.settings.input,
      context,
    ) as WorkflowLogicFunctionActionInput;

    const { workspaceId } = runInfo;

    const { flatLogicFunctionMaps } =
      await this.flatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps(
        {
          workspaceId,
          flatMapsKeys: ['flatLogicFunctionMaps'],
        },
      );

    const logicFunction = findFlatEntityByIdInFlatEntityMaps({
      flatEntityId: workflowActionInput.logicFunctionId,
      flatEntityMaps: flatLogicFunctionMaps,
    });

    if (!logicFunction) {
      throw new WorkflowStepExecutorException(
        `Logic function with id ${workflowActionInput.logicFunctionId} not found`,
        WorkflowStepExecutorExceptionCode.INVALID_STEP_TYPE,
      );
    }

    if (!isDefined(logicFunction.workflowActionTriggerSettings)) {
      throw new WorkflowStepExecutorException(
        `Logic function ${logicFunction.name} is not exposed as a workflow action`,
        WorkflowStepExecutorExceptionCode.INVALID_STEP_TYPE,
      );
    }

    const nativeHandler = this.nativeLogicFunctionRegistry.find(
      logicFunction.name,
    );

    if (nativeHandler) {
      try {
        const nativeResult = await nativeHandler.execute({
          name: logicFunction.name,
          workspaceId,
          payload: workflowActionInput.logicFunctionInput ?? {},
        });

        const nativeError =
          nativeResult &&
          typeof nativeResult === 'object' &&
          'success' in nativeResult &&
          (nativeResult as { success?: unknown }).success === false &&
          'error' in nativeResult
            ? (nativeResult as { error?: unknown }).error
            : undefined;
        const nativeErrorMessage =
          typeof nativeError === 'string' ? nativeError : undefined;

        if (
          nativeErrorMessage &&
          /rate limit reached/i.test(nativeErrorMessage)
        ) {
          const waitMs =
            parseWaitMsFromAccountRateLimitMessage(nativeErrorMessage);

          if (isDefined(waitMs) && waitMs > 0) {
            return this.deferForLinkedinRateLimit({
              waitMs,
              currentStepId,
              workspaceId,
              workflowRunId: runInfo.workflowRunId,
            });
          }

          return { error: nativeErrorMessage };
        }

        return { result: nativeResult };
      } catch (error) {
        if (isAccountRateLimitDeferredError(error) && error.waitMs > 0) {
          return this.deferForLinkedinRateLimit({
            waitMs: error.waitMs,
            currentStepId,
            workspaceId,
            workflowRunId: runInfo.workflowRunId,
          });
        }

        throw error;
      }
    }

    try {
      const result = await this.logicFunctionExecutorService.execute({
        logicFunctionId: workflowActionInput.logicFunctionId,
        workspaceId,
        payload: workflowActionInput.logicFunctionInput,
      });

      if (result.error) {
        const errorMessage = result.error.errorMessage;
        const waitMs = parseWaitMsFromAccountRateLimitMessage(errorMessage);

        if (
          /rate limit reached/i.test(errorMessage) &&
          isDefined(waitMs) &&
          waitMs > 0
        ) {
          return this.deferForLinkedinRateLimit({
            waitMs,
            currentStepId,
            workspaceId,
            workflowRunId: runInfo.workflowRunId,
          });
        }

        return { error: errorMessage };
      }

      return { result: result.data || {} };
    } catch (error) {
      if (isAccountRateLimitDeferredError(error) && error.waitMs > 0) {
        return this.deferForLinkedinRateLimit({
          waitMs: error.waitMs,
          currentStepId,
          workspaceId,
          workflowRunId: runInfo.workflowRunId,
        });
      }

      throw error;
    }
  }

  private async deferForLinkedinRateLimit({
    waitMs,
    currentStepId,
    workspaceId,
    workflowRunId,
  }: {
    waitMs: number;
    currentStepId: string;
    workspaceId: string;
    workflowRunId: string;
  }): Promise<WorkflowActionOutput> {
    await this.delayedQueue.add<ResumeDelayedWorkflowJobData>(
      RESUME_DELAYED_WORKFLOW_JOB_NAME,
      {
        workspaceId,
        workflowRunId,
        stepId: currentStepId,
        retryPendingStep: true,
      },
      {
        ...buildRunWorkflowJobOptions(workflowRunId),
        delay: waitMs,
      },
    );

    return {
      pendingEvent: true,
      waitMs,
      scheduledAt: new Date(Date.now() + waitMs).toISOString(),
      pendingReason: LINKEDIN_RATE_LIMIT_PENDING_REASON,
    };
  }
}
