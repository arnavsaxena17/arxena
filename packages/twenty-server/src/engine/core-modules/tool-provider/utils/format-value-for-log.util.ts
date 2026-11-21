import { redactForLog } from 'src/engine/core-modules/tool-provider/utils/format-tool-call-log.util';

// Same 200-char leaf bound the tool output preview uses; longer multi-line
// strings are lifted out of the JSON and printed in full below it, so the \n
// escapes a JSON dump would show become real lines (skill markdown, tool result
// text). A long single-line value (a tool description) has no escapes to
// recover, so it stays in place and the JSON keeps its shape.
const INLINE_STRING_LIMIT = 200;

type LiftedString = { path: string; text: string };

const liftLongStrings = (
  value: unknown,
  path: string,
  lifted: LiftedString[],
): unknown => {
  if (typeof value === 'string') {
    if (value.length <= INLINE_STRING_LIMIT || !value.includes('\n')) {
      return value;
    }

    lifted.push({ path, text: value });

    return `<${value.length} chars, printed below>`;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) =>
      liftLongStrings(item, `${path}[${index}]`, lifted),
    );
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        liftLongStrings(entry, path === '' ? key : `${path}.${key}`, lifted),
      ]),
    );
  }

  return value;
};

// Redacted, full-length, and readable: the JSON keeps its shape so array and
// object structure still read, and long strings are printed uncut underneath.
export const formatValueForLog = (value: unknown): string => {
  const lifted: LiftedString[] = [];

  let json: string;

  try {
    const skeleton = liftLongStrings(redactForLog(value), '', lifted);

    json = JSON.stringify(skeleton, null, 2) ?? String(value);
  } catch {
    // A tool output can be circular or otherwise unserialisable; a log line
    // must not take the turn down with it
    return String(value);
  }

  return [json, ...lifted.map(({ path, text }) => `\n${path}:\n${text}`)].join(
    '\n',
  );
};

export const fenceValueForLog = (value: unknown): string =>
  `\`\`\`\n${formatValueForLog(value)}\n\`\`\``;
