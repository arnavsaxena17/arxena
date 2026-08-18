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

  it('parses double-stringified arguments', () => {
    expect(
      coerceExecuteToolArguments({
        toolName: 'code_interpreter',
        arguments: JSON.stringify(JSON.stringify({ code: 'print(1)' })),
      }),
    ).toEqual({
      toolName: 'code_interpreter',
      arguments: { code: 'print(1)' },
    });
  });

  it('parses a fully stringified execute_tool payload', () => {
    expect(
      coerceExecuteToolArguments(
        JSON.stringify({
          toolName: 'extract_json_paths',
          arguments: { path: '$.result.items', maxDepth: 3 },
        }),
      ),
    ).toEqual({
      toolName: 'extract_json_paths',
      arguments: { path: '$.result.items', maxDepth: 3 },
    });
  });

  it('defaults missing arguments to an empty object', () => {
    expect(
      coerceExecuteToolArguments({
        toolName: 'search_output',
      }),
    ).toEqual({
      toolName: 'search_output',
      arguments: {},
    });
  });

  it('lifts flattened nested tool fields into arguments', () => {
    expect(
      coerceExecuteToolArguments({
        toolName: 'code_interpreter',
        code: 'print(1)',
        files: ['a.json'],
      }),
    ).toEqual({
      toolName: 'code_interpreter',
      arguments: {
        code: 'print(1)',
        files: ['a.json'],
      },
    });
  });

  it('accepts parameters / args / input aliases', () => {
    expect(
      coerceExecuteToolArguments({
        toolName: 'upsert_gtm_target_people',
        parameters: { projectId: 'abc', people: [] },
      }),
    ).toEqual({
      toolName: 'upsert_gtm_target_people',
      arguments: { projectId: 'abc', people: [] },
    });

    expect(
      coerceExecuteToolArguments({
        toolName: 'upsert_gtm_target_people',
        args: { projectId: 'abc', people: [] },
      }),
    ).toEqual({
      toolName: 'upsert_gtm_target_people',
      arguments: { projectId: 'abc', people: [] },
    });

    expect(
      coerceExecuteToolArguments({
        toolName: 'upsert_gtm_target_people',
        input: { projectId: 'abc', people: [] },
      }),
    ).toEqual({
      toolName: 'upsert_gtm_target_people',
      arguments: { projectId: 'abc', people: [] },
    });
  });

  it('leaves object arguments unchanged aside from normalizing shape', () => {
    expect(
      coerceExecuteToolArguments({
        toolName: 'upsert_gtm_target_companies',
        arguments: { projectId: 'abc', companies: [] },
      }),
    ).toEqual({
      toolName: 'upsert_gtm_target_companies',
      arguments: { projectId: 'abc', companies: [] },
    });
  });

  it('leaves invalid JSON strings unchanged for Zod to reject', () => {
    const value = {
      toolName: 'code_interpreter',
      arguments: '{not-json',
    };

    expect(coerceExecuteToolArguments(value)).toBe(value);
  });

  it('strips leaked tool-call markup from toolName', () => {
    expect(
      coerceExecuteToolArguments({
        toolName:
          'code_interpreter<tool_sep:6124c78e>\n<arg_key:6124c78e>arguments',
        arguments: { code: 'print(1)' },
      }),
    ).toEqual({
      toolName: 'code_interpreter',
      arguments: { code: 'print(1)' },
    });
  });
});
