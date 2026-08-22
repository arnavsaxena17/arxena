import { Test, type TestingModule } from '@nestjs/testing';

import { WorkflowActionType } from 'twenty-shared/workflow';

import { AccountRateLimitDeferredError } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error';
import { LogicFunctionExecutorService } from 'src/engine/core-modules/logic-function/logic-function-executor/logic-function-executor.service';
import { NativeLogicFunctionRegistry } from 'src/engine/core-modules/logic-function/logic-function-executor/native-logic-function.registry';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { getQueueToken } from 'src/engine/core-modules/message-queue/utils/get-queue-token.util';
import { WorkspaceManyOrAllFlatEntityMapsCacheService } from 'src/engine/metadata-modules/flat-entity/services/workspace-many-or-all-flat-entity-maps-cache.service';
import { RESUME_DELAYED_WORKFLOW_JOB_NAME } from 'src/modules/workflow/workflow-executor/workflow-actions/delay/contants/resume-delayed-workflow-job-name';
import { LogicFunctionWorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/logic-function/logic-function.workflow-action';
import { type WorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';

const buildLogicFunctionStep = (): WorkflowAction =>
  ({
    id: 'step-1',
    type: WorkflowActionType.LOGIC_FUNCTION,
    name: 'Search people',
    valid: true,
    settings: {
      outputSchema: {},
      errorHandlingOptions: {
        retryOnFailure: { value: false },
        continueOnFailure: { value: false },
      },
      input: {
        logicFunctionId: 'fn-1',
        logicFunctionInput: { query: 'aeo' },
      },
    },
  }) as WorkflowAction;

describe('LogicFunctionWorkflowAction', () => {
  let action: LogicFunctionWorkflowAction;
  let delayedQueueAdd: jest.Mock;
  let nativeExecute: jest.Mock;

  beforeEach(async () => {
    delayedQueueAdd = jest.fn().mockResolvedValue(undefined);
    nativeExecute = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogicFunctionWorkflowAction,
        {
          provide: LogicFunctionExecutorService,
          useValue: { execute: jest.fn() },
        },
        {
          provide: WorkspaceManyOrAllFlatEntityMapsCacheService,
          useValue: {
            getOrRecomputeManyOrAllFlatEntityMaps: jest.fn().mockResolvedValue({
              flatLogicFunctionMaps: {
                universalIdentifierById: { 'fn-1': 'uid-1' },
                byUniversalIdentifier: {
                  'uid-1': {
                    id: 'fn-1',
                    name: 'search-people',
                    workflowActionTriggerSettings: {},
                  },
                },
              },
            }),
          },
        },
        {
          provide: NativeLogicFunctionRegistry,
          useValue: {
            find: jest.fn().mockReturnValue({
              isNative: () => true,
              execute: nativeExecute,
            }),
          },
        },
        {
          provide: getQueueToken(MessageQueue.delayedJobsQueue),
          useValue: { add: delayedQueueAdd },
        },
      ],
    }).compile();

    action = module.get(LogicFunctionWorkflowAction);
  });

  it('queues a delayed resume instead of failing when LinkedIn rate limits are hit', async () => {
    nativeExecute.mockRejectedValue(
      new AccountRateLimitDeferredError({
        waitMs: 81_711_000,
        accountId: 'acc-1',
        method: 'search',
      }),
    );

    const output = await action.execute({
      currentStepId: 'step-1',
      steps: [buildLogicFunctionStep()],
      context: {},
      runInfo: { workspaceId: 'workspace-1', workflowRunId: 'run-1' },
    });

    expect(delayedQueueAdd).toHaveBeenCalledWith(
      RESUME_DELAYED_WORKFLOW_JOB_NAME,
      {
        workspaceId: 'workspace-1',
        workflowRunId: 'run-1',
        stepId: 'step-1',
        retryPendingStep: true,
      },
      expect.objectContaining({
        delay: 81_711_000,
      }),
    );

    expect(output.pendingEvent).toBe(true);
    expect(output.waitMs).toBe(81_711_000);
    expect(output.pendingReason).toBe('linkedin_rate_limit');
    expect(output.scheduledAt).toEqual(expect.any(String));
    expect(output.error).toBeUndefined();
  });
});
