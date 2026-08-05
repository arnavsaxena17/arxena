import { getToolName, isToolUIPart } from 'ai';
import { type ExtendedUIMessagePart } from 'twenty-shared/ai';
import { isDefined } from 'twenty-shared/utils';

import { isCodeInterpreterToolPart } from '@/ai/utils/isCodeInterpreterToolPart';
import { unwrapToolInput } from '@/ai/utils/tool-display/unwrap-tool-input.util';

export type CodeExecutionDisplayPropsFromToolPart = {
  code: string;
  stdout: string;
  stderr: string;
  exitCode?: number;
  files?: Array<{
    fileId: string;
    filename: string;
    url: string;
    mimeType?: string;
  }>;
  isRunning: boolean;
};

export const getCodeExecutionDisplayPropsFromToolPart = (
  part: ExtendedUIMessagePart,
): CodeExecutionDisplayPropsFromToolPart | null => {
  if (!isCodeInterpreterToolPart(part) || !isToolUIPart(part)) {
    return null;
  }

  const { toolInput } = unwrapToolInput({
    input: part.input,
    toolName: getToolName(part),
  });

  const codeInput = toolInput as { code?: string } | null | undefined;
  const outputObj =
    typeof part.output === 'object' && part.output !== null
      ? (part.output as Record<string, unknown>)
      : null;

  const nestedResult =
    typeof outputObj?.result === 'object' && outputObj.result !== null
      ? (outputObj.result as Record<string, unknown>)
      : null;

  const codeOutput = nestedResult ?? outputObj;

  const files = Array.isArray(codeOutput?.files)
    ? (codeOutput.files as Array<{
        fileId: string;
        filename: string;
        url: string;
        mimeType?: string;
      }>)
    : undefined;

  const exitCode =
    typeof codeOutput?.exitCode === 'number' ? codeOutput.exitCode : undefined;

  const isRunning =
    part.state === 'input-streaming' ||
    part.state === 'input-available' ||
    (!isDefined(part.output) && !isDefined(part.errorText));

  return {
    code: typeof codeInput?.code === 'string' ? codeInput.code : '',
    stdout: typeof codeOutput?.stdout === 'string' ? codeOutput.stdout : '',
    stderr:
      (typeof codeOutput?.stderr === 'string' ? codeOutput.stderr : '') ||
      part.errorText ||
      '',
    exitCode,
    files,
    isRunning,
  };
};
