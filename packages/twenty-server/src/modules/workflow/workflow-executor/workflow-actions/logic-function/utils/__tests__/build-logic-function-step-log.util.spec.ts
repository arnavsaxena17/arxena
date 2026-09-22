import { LogicFunctionExecutionStatus } from 'src/engine/metadata-modules/logic-function/dtos/logic-function-execution-result.dto';
import {
  buildLogicFunctionStepLogFromExecutorResult,
  buildLogicFunctionStepLogFromNativeResult,
} from 'src/modules/workflow/workflow-executor/workflow-actions/logic-function/utils/build-logic-function-step-log.util';

describe('buildLogicFunctionStepLog', () => {
  it('builds a CODE success log for native results', () => {
    const stepLog = buildLogicFunctionStepLogFromNativeResult({
      logicFunctionName: 'search-people',
      durationMs: 42,
    });

    expect(stepLog.details).toEqual({
      type: 'CODE',
      durationMs: 42,
      status: 'SUCCESS',
      error: null,
    });
    expect(stepLog.entries[0]).toEqual(
      expect.objectContaining({
        level: 'info',
        message: 'search-people completed successfully',
      }),
    );
  });

  it('builds a CODE error log for native failures', () => {
    const stepLog = buildLogicFunctionStepLogFromNativeResult({
      logicFunctionName: 'search-people',
      durationMs: 12,
      errorMessage: 'location is not defined',
    });

    expect(stepLog.details).toEqual({
      type: 'CODE',
      durationMs: 12,
      status: 'ERROR',
      error: {
        type: 'NativeLogicFunctionError',
        message: 'location is not defined',
        stackTrace: '',
      },
    });
    expect(stepLog.entries[0]).toEqual(
      expect.objectContaining({
        level: 'error',
        message: 'search-people failed: location is not defined',
      }),
    );
  });

  it('reuses executor logs and prefixes a status entry', () => {
    const stepLog = buildLogicFunctionStepLogFromExecutorResult({
      logicFunctionName: 'custom-fn',
      result: {
        data: { ok: true },
        duration: 9,
        logs: 'INFO 2024-01-01T00:00:00.000Z hello\n',
        status: LogicFunctionExecutionStatus.SUCCESS,
      },
    });

    expect(stepLog.details.status).toBe('SUCCESS');
    expect(stepLog.entries[0]?.message).toBe(
      'custom-fn completed successfully',
    );
  });
});
