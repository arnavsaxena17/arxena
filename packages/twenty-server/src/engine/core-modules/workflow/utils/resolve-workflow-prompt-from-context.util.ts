import { isDefined, resolveInput } from 'twenty-shared/utils';
import { extractVariablesFromInput } from 'twenty-shared/workflow';

export const getValueAtWorkflowVariablePath = (
  context: Record<string, unknown>,
  path: string,
): unknown => {
  const parts = path.split('.').filter((part) => part.length > 0);
  let current: unknown = context;

  for (const part of parts) {
    if (!isDefined(current) || typeof current !== 'object') {
      return undefined;
    }

    current = (current as Record<string, unknown>)[part];
  }

  return current;
};

export const resolveWorkflowPromptFromContext = ({
  prompt,
  context,
}: {
  prompt: string;
  context: Record<string, unknown>;
}): {
  resolvedPrompt: string;
  missingVariablePaths: string[];
} => {
  const missingVariablePaths = extractVariablesFromInput(prompt).filter(
    (path) => !isDefined(getValueAtWorkflowVariablePath(context, path)),
  );

  if (missingVariablePaths.length > 0) {
    return {
      resolvedPrompt: prompt,
      missingVariablePaths,
    };
  }

  return {
    resolvedPrompt: resolveInput(prompt, context) as string,
    missingVariablePaths: [],
  };
};

export const buildFindRecordsStepResult = (
  records: unknown[],
): {
  first: unknown;
  all: unknown[];
  totalCount: number;
} => ({
  first: records[0],
  all: records,
  totalCount: records.length,
});
