import { isDefined, resolveInput } from 'twenty-shared/utils';
import { CAPTURE_ALL_VARIABLE_TAG_INNER_REGEX } from 'twenty-shared/workflow';

export const extractWorkflowVariablePaths = (prompt: string): string[] => {
  return [...prompt.matchAll(CAPTURE_ALL_VARIABLE_TAG_INNER_REGEX)]
    .map((match) => match[1]?.trim())
    .filter((path): path is string => isDefined(path) && path.length > 0);
};

export const getValueAtVariablePath = (
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

export const buildVariableContextFromStepInfos = (
  stepInfos: Record<string, { result?: unknown } | undefined> | null | undefined,
): Record<string, unknown> => {
  const context: Record<string, unknown> = {};

  if (!isDefined(stepInfos)) {
    return context;
  }

  for (const [stepId, stepInfo] of Object.entries(stepInfos)) {
    if (isDefined(stepInfo?.result)) {
      context[stepId] = stepInfo.result;
    }
  }

  return context;
};

export const resolveAiAgentTestPrompt = ({
  prompt,
  context,
}: {
  prompt: string;
  context: Record<string, unknown>;
}): {
  resolvedPrompt: string;
  missingVariablePaths: string[];
} => {
  const missingVariablePaths = extractWorkflowVariablePaths(prompt).filter(
    (path) => !isDefined(getValueAtVariablePath(context, path)),
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
