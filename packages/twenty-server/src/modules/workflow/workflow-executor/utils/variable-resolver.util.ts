import { isNil, isString } from '@nestjs/common/utils/shared.utils';

import Handlebars from 'handlebars';

const VARIABLE_PATTERN = RegExp('\\{\\{(.*?)\\}\\}', 'g');

const UUID_STEP_PATH_PATTERN =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(.+)$/i;

const getValueAtPath = (
  context: Record<string, unknown>,
  path: string,
): unknown => {
  const uuidStepPathMatch = path.match(UUID_STEP_PATH_PATTERN);

  const segments = uuidStepPathMatch
    ? [uuidStepPathMatch[1], ...uuidStepPathMatch[2].split('.')]
    : path.split('.');

  const resolvedSegments =
    uuidStepPathMatch && segments[1] === 'result'
      ? [segments[0], ...segments.slice(2)]
      : segments;

  let current: unknown = context;

  for (const segment of resolvedSegments) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
};

export const resolveInput = (
  unresolvedInput: unknown,
  context: Record<string, unknown>,
): unknown => {
  if (isNil(unresolvedInput)) {
    return unresolvedInput;
  }

  if (isString(unresolvedInput)) {
    return resolveString(unresolvedInput, context);
  }

  if (Array.isArray(unresolvedInput)) {
    return resolveArray(unresolvedInput, context);
  }

  if (typeof unresolvedInput === 'object' && unresolvedInput !== null) {
    return resolveObject(unresolvedInput, context);
  }

  return unresolvedInput;
};

const resolveArray = (
  input: unknown[],
  context: Record<string, unknown>,
): unknown[] => {
  const resolvedArray = input;

  for (let i = 0; i < input.length; ++i) {
    resolvedArray[i] = resolveInput(input[i], context);
  }

  return resolvedArray;
};

const resolveObject = (
  input: object,
  context: Record<string, unknown>,
): object => {
  const resolvedObject = input;

  const entries = Object.entries(resolvedObject);

  for (const [key, value] of entries) {
    resolvedObject[key] = resolveInput(value, context);
  }

  return resolvedObject;
};

const resolveString = (
  input: string,
  context: Record<string, unknown>,
): string => {
  const matchedTokens = input.match(VARIABLE_PATTERN);

  if (!matchedTokens || matchedTokens.length === 0) {
    return input;
  }

  if (matchedTokens.length === 1 && matchedTokens[0] === input) {
    return evalFromContext(input, context);
  }

  return input.replace(VARIABLE_PATTERN, (matchedToken, _) => {
    const processedToken = evalFromContext(matchedToken, context);

    return processedToken;
  });
};

const evalFromContext = (input: string, context: Record<string, unknown>) => {
  const trimmedPath = input.replace(/^\{\{|\}\}$/g, '').trim();

  if (/^\{\{[^}]+\}\}$/.test(input) && !trimmedPath.includes(' ')) {
    const value = getValueAtPath(context, trimmedPath);

    if (value !== undefined) {
      return value;
    }
  }

  try {
    Handlebars.registerHelper('json', (input: string) => JSON.stringify(input));

    const inputWithHelper = input
      .replace('{{', '{{{ json ')
      .replace('}}', ' }}}');

    const inferredInput = Handlebars.compile(inputWithHelper)(context, {
      helpers: {
        json: (input: string) => JSON.stringify(input),
      },
    });

    return JSON.parse(inferredInput) ?? '';
  } catch (exception) {
    return undefined;
  }
};
