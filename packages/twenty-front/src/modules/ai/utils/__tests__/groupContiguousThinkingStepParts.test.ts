import { groupContiguousThinkingStepParts } from '@/ai/utils/groupContiguousThinkingStepParts';
import { type ExtendedUIMessagePart } from 'twenty-shared/ai';

describe('groupContiguousThinkingStepParts', () => {
  it('should keep code_interpreter tool parts out of thinking-steps groups', () => {
    const parts = [
      {
        type: 'tool-load_skills',
        toolCallId: '1',
        state: 'output-available',
        input: {},
        output: {},
      },
      {
        type: 'tool-execute_tool',
        toolCallId: '2',
        state: 'output-available',
        input: { toolName: 'code_interpreter', arguments: { code: 'print(1)' } },
        output: {
          stdout: '1',
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
      },
      {
        type: 'text',
        text: 'Here is your CSV.',
      },
    ] as ExtendedUIMessagePart[];

    const renderItems = groupContiguousThinkingStepParts(parts);

    expect(renderItems).toEqual([
      {
        type: 'thinking-steps',
        parts: [parts[0]],
      },
      {
        type: 'part',
        part: parts[1],
      },
      {
        type: 'part',
        part: parts[2],
      },
    ]);
  });

  it('should keep tool-code_interpreter parts out of thinking-steps groups', () => {
    const parts = [
      {
        type: 'tool-code_interpreter',
        toolCallId: '1',
        state: 'output-available',
        input: { code: 'print(1)' },
        output: { stdout: '1', stderr: '', exitCode: 0, files: [] },
      },
    ] as ExtendedUIMessagePart[];

    const renderItems = groupContiguousThinkingStepParts(parts);

    expect(renderItems).toEqual([
      {
        type: 'part',
        part: parts[0],
      },
    ]);
  });
});
