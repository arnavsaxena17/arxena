import { Injectable, Logger } from '@nestjs/common';

import { isDefined, resolveInput } from 'twenty-shared/utils';
import { type WorkflowRunStepLog } from 'twenty-shared/workflow';

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
import { maybeWithLlmFormattedText } from 'src/engine/core-modules/outreach-command/utils/with-llm-formatted-text.util';
import { WorkspaceManyOrAllFlatEntityMapsCacheService } from 'src/engine/metadata-modules/flat-entity/services/workspace-many-or-all-flat-entity-maps-cache.service';
import { findFlatEntityByIdInFlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-id-in-flat-entity-maps.util';
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
import {
  buildLogicFunctionStepLogFromExecutorResult,
  buildLogicFunctionStepLogFromNativeResult,
} from 'src/modules/workflow/workflow-executor/workflow-actions/logic-function/utils/build-logic-function-step-log.util';
import { WorkflowRunStepLogWorkspaceService } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run-step-log.workspace-service';

@Injectable()
export class LogicFunctionWorkflowAction implements WorkflowAction {
  private readonly logger = new Logger(LogicFunctionWorkflowAction.name);

  constructor(
    private readonly logicFunctionExecutorService: LogicFunctionExecutorService,
    private readonly flatEntityMapsCacheService: WorkspaceManyOrAllFlatEntityMapsCacheService,
    private readonly nativeLogicFunctionRegistry: NativeLogicFunctionRegistry,
    private readonly workflowRunStepLogService: WorkflowRunStepLogWorkspaceService,
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
          const startedAtMs = Date.now();

          try {
            const nativeResult = await nativeHandler.execute({
              name: logicFunction.name,
              workspaceId,
              payload: workflowActionInput.logicFunctionInput ?? {},
              workflowRunId: runInfo.workflowRunId,
              stepId: currentStepId,
            });

            const durationMs = Date.now() - startedAtMs;

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
                  await this.persistStepLog({
                    workflowRunId: runInfo.workflowRunId,
                    workspaceId,
                    stepId: currentStepId,
                    stepLog: buildLogicFunctionStepLogFromNativeResult({
                      logicFunctionName: logicFunction.name,
                      durationMs,
                      errorMessage: nativeErrorMessage,
                      pending: true,
                    }),
                  });

                  return this.deferForLinkedinRateLimit({
                    waitMs,
                    currentStepId,
                    workspaceId,
                    workflowRunId: runInfo.workflowRunId,
                    method:
                      parseMethodFromAccountRateLimitMessage(
                        nativeErrorMessage,
                      ),
                  });
                }
              }

              await this.persistStepLog({
                workflowRunId: runInfo.workflowRunId,
                workspaceId,
                stepId: currentStepId,
                stepLog: buildLogicFunctionStepLogFromNativeResult({
                  logicFunctionName: logicFunction.name,
                  durationMs,
                  errorMessage: nativeErrorMessage,
                }),
              });

              return { error: nativeErrorMessage };
            }

            const isPending =
              nativeResult &&
              typeof nativeResult === 'object' &&
              'pending' in nativeResult &&
              (nativeResult as { pending?: unknown }).pending === true;

            await this.persistStepLog({
              workflowRunId: runInfo.workflowRunId,
              workspaceId,
              stepId: currentStepId,
              stepLog: buildLogicFunctionStepLogFromNativeResult({
                logicFunctionName: logicFunction.name,
                durationMs,
                pending: isPending === true,
              }),
            });

            if (isPending) {
              return {
                pendingEvent: true,
                result: maybeWithLlmFormattedText(
                  logicFunction.name,
                  nativeResult,
                ),
              };
            }

            return {
              result: maybeWithLlmFormattedText(
                logicFunction.name,
                nativeResult,
              ),
            };
          } catch (error) {
            const durationMs = Date.now() - startedAtMs;

            if (isAccountRateLimitDeferredError(error) && error.waitMs > 0) {
              await this.persistStepLog({
                workflowRunId: runInfo.workflowRunId,
                workspaceId,
                stepId: currentStepId,
                stepLog: buildLogicFunctionStepLogFromNativeResult({
                  logicFunctionName: logicFunction.name,
                  durationMs,
                  errorMessage: error.message,
                  pending: true,
                }),
              });

              return this.deferForLinkedinRateLimit({
                waitMs: error.waitMs,
                currentStepId,
                workspaceId,
                workflowRunId: runInfo.workflowRunId,
                method: error.method,
              });
            }

            await this.persistStepLog({
              workflowRunId: runInfo.workflowRunId,
              workspaceId,
              stepId: currentStepId,
              stepLog: buildLogicFunctionStepLogFromNativeResult({
                logicFunctionName: logicFunction.name,
                durationMs,
                errorMessage:
                  error instanceof Error
                    ? error.message
                    : `Native logic function ${logicFunction.name} failed`,
              }),
            });

            throw error;
          }
        }

        try {
          const result = await this.logicFunctionExecutorService.execute({
            logicFunctionId: workflowActionInput.logicFunctionId,
            workspaceId,
            payload: workflowActionInput.logicFunctionInput,
          });

          await this.persistStepLog({
            workflowRunId: runInfo.workflowRunId,
            workspaceId,
            stepId: currentStepId,
            stepLog: buildLogicFunctionStepLogFromExecutorResult({
              logicFunctionName: logicFunction.name,
              result,
            }),
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
            await this.persistStepLog({
              workflowRunId: runInfo.workflowRunId,
              workspaceId,
              stepId: currentStepId,
              stepLog: buildLogicFunctionStepLogFromNativeResult({
                logicFunctionName: logicFunction.name,
                durationMs: 0,
                errorMessage: error.message,
                pending: true,
              }),
            });

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

  private async persistStepLog({
    workflowRunId,
    workspaceId,
    stepId,
    stepLog,
  }: {
    workflowRunId: string;
    workspaceId: string;
    stepId: string;
    stepLog: WorkflowRunStepLog;
  }): Promise<void> {
    try {
      await this.workflowRunStepLogService.setStepLog({
        workflowRunId,
        workspaceId,
        stepId,
        stepLog,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to persist step log for workflowRun=${workflowRunId} step=${stepId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
