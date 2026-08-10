import { coerceExecuteToolArguments } from 'src/engine/core-modules/tool-provider/utils/coerce-execute-tool-arguments.util';

describe('coerceExecuteToolArguments', () => {
  it('parses stringified arguments into an object', () => {
    expect(
      coerceExecuteToolArguments({
        toolName: 'code_interpreter',
        arguments: '{"code":"print(1)"}',
      }),
    ).toEqual({
      toolName: 'code_interpreter',
      arguments: { code: 'print(1)' },
    });
  });

  it('leaves object arguments unchanged', () => {
    const value = {
      toolName: 'upsert_gtm_target_companies',
      arguments: { projectId: 'abc', companies: [] },
    };

    expect(coerceExecuteToolArguments(value)).toBe(value);
  });

  it('leaves invalid JSON strings unchanged', () => {
    const value = {
      toolName: 'code_interpreter',
      arguments: '{not-json',
    };

    expect(coerceExecuteToolArguments(value)).toBe(value);
  });
});
