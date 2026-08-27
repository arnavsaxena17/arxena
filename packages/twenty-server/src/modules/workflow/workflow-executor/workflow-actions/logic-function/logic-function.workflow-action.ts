import { Injectable } from '@nestjs/common';

import { isDefined, resolveInput } from 'twenty-shared/utils';

import { type WorkflowAction } from 'src/modules/workflow/workflow-executor/interfaces/workflow-action.interface';

import {
  isAccountRateLimitDeferredError,
  parseMethodFromAccountRateLimitMessage,
  parseWaitMsFromAccountRateLimitMessage,
} from 'src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error';
import { runWithAccountRateLimitReservation } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-reservation.context';
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
import { deferWorkflowForAccountRateLimit } from 'src/modules/workflow/workflow-executor/utils/defer-workflow-for-account-rate-limit.util';
import { findStepOrThrow } from 'src/modules/workflow/workflow-executor/utils/find-step-or-throw.util';
import { isWorkflowLogicFunctionAction } from 'src/modules/workflow/workflow-executor/workflow-actions/logic-function/guards/is-workflow-logic-function-action.guard';
import { WorkflowLogicFunctionActionInput } from 'src/modules/workflow/workflow-executor/workflow-actions/logic-function/types/workflow-logic-function-action-input.type';

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

    return runWithAccountRateLimitReservation(
      `${runInfo.workflowRunId}:${currentStepId}`,
      async () => {
        if (nativeHandler) {
          try {
            const nativeResult = await nativeHandler.execute({
              name: logicFunction.name,
              workspaceId,
              payload: workflowActionInput.logicFunctionInput ?? {},
              workflowRunId: runInfo.workflowRunId,
              stepId: currentStepId,
            });

            const isNativeFailure =
              nativeResult &&
              typeof nativeResult === 'object' &&
              'success' in nativeResult &&
              (nativeResult as { success?: unknown }).success === false;
            const nativeError =
              isNativeFailure && 'error' in nativeResult
                ? (nativeResult as { error?: unknown }).error
                : undefined;
            const nativeErrorMessage =
              typeof nativeError === 'string'
                ? nativeError
                : isNativeFailure
                  ? `Native logic function ${logicFunction.name} failed`
                  : undefined;

            if (nativeErrorMessage) {
              if (/rate limit reached/i.test(nativeErrorMessage)) {
                const waitMs =
                  parseWaitMsFromAccountRateLimitMessage(nativeErrorMessage);

                if (isDefined(waitMs) && waitMs > 0) {
                  return this.deferForLinkedinRateLimit({
                    waitMs,
                    currentStepId,
                    workspaceId,
                    workflowRunId: runInfo.workflowRunId,
                    method:
                      parseMethodFromAccountRateLimitMessage(nativeErrorMessage),
                  });
                }
              }

              return { error: nativeErrorMessage };
            }

            const isPending =
              nativeResult &&
              typeof nativeResult === 'object' &&
              'pending' in nativeResult &&
              (nativeResult as { pending?: unknown }).pending === true;

            if (isPending) {
              return {
                pendingEvent: true,
                result: nativeResult,
              };
            }

            return { result: nativeResult };
          } catch (error) {
            if (isAccountRateLimitDeferredError(error) && error.waitMs > 0) {
              return this.deferForLinkedinRateLimit({
                waitMs: error.waitMs,
                currentStepId,
                workspaceId,
                workflowRunId: runInfo.workflowRunId,
                method: error.method,
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
                method: parseMethodFromAccountRateLimitMessage(errorMessage),
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
              method: error.method,
            });
          }

          throw error;
        }
      },
    );
  }

  private async deferForLinkedinRateLimit({
    waitMs,
    currentStepId,
    workspaceId,
    workflowRunId,
    method,
  }: {
    waitMs: number;
    currentStepId: string;
    workspaceId: string;
    workflowRunId: string;
    method?: string;
  }): Promise<WorkflowActionOutput> {
    return deferWorkflowForAccountRateLimit({
      delayedQueue: this.delayedQueue,
      waitMs,
      currentStepId,
      workspaceId,
      workflowRunId,
      method,
    });
  }
}
