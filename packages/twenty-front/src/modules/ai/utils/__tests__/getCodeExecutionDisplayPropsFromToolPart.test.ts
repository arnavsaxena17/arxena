import { getCodeExecutionDisplayPropsFromToolPart } from '@/ai/utils/getCodeExecutionDisplayPropsFromToolPart';
import { type ExtendedUIMessagePart } from 'twenty-shared/ai';

describe('getCodeExecutionDisplayPropsFromToolPart', () => {
  it('should map execute_tool code_interpreter output to display props', () => {
    const part = {
      type: 'tool-execute_tool',
      toolCallId: '1',
      state: 'output-available',
      input: {
        toolName: 'code_interpreter',
        arguments: { code: 'print("hi")' },
      },
      output: {
        stdout: 'hi',
        stderr: '',
        exitCode: 0,
        files: [
          {
            fileId: 'file-1',
            filename: 'report.csv',
            url: 'http://localhost/report.csv',
            mimeType: 'text/csv',
          },
        ],
      },
    } as ExtendedUIMessagePart;

    expect(getCodeExecutionDisplayPropsFromToolPart(part)).toEqual({
      code: 'print("hi")',
      stdout: 'hi',
      stderr: '',
      exitCode: 0,
      files: [
        {
          fileId: 'file-1',
          filename: 'report.csv',
          url: 'http://localhost/report.csv',
          mimeType: 'text/csv',
        },
      ],
      isRunning: false,
    });
  });

  it('should unwrap nested result payloads from execute_tool', () => {
    const part = {
      type: 'tool-execute_tool',
      toolCallId: '1',
      state: 'output-available',
      input: {
        toolName: 'code_interpreter',
        arguments: { code: 'x = 1' },
      },
      output: {
        success: true,
        result: {
          stdout: 'done',
          stderr: '',
          exitCode: 0,
          files: [],
        },
      },
    } as ExtendedUIMessagePart;

    expect(getCodeExecutionDisplayPropsFromToolPart(part)).toMatchObject({
      code: 'x = 1',
      stdout: 'done',
      exitCode: 0,
      isRunning: false,
    });
  });
});
