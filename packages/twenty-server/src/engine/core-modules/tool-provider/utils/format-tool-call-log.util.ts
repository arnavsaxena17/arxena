const MAX_LOGGED_CHARS = 1_500;
const SENSITIVE_KEY_PATTERN = /token|password|secret|api[-_]?key|authorization/i;

// Set TOOL_IO_LOG=false to silence the per-call input/output blocks
export const isToolIoLoggingEnabled = (): boolean =>
  process.env.TOOL_IO_LOG?.trim().toLowerCase() !== 'false';

const redact = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(redact);
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? '[redacted]' : redact(entry),
      ]),
    );
  }

  return value;
};

export const truncateForLog = (value: unknown, maxChars = MAX_LOGGED_CHARS) => {
  let text: string;

  try {
    text = JSON.stringify(redact(value), null, 2) ?? String(value);
  } catch {
    text = String(value);
  }

  return text.length > maxChars
    ? `${text.slice(0, maxChars)}\n… (${text.length - maxChars} more chars)`
    : text;
};

const indent = (text: string): string =>
  text
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n');

// One readable block per tool call: what was asked, what came back, how long
export const formatToolCallLog = ({
  toolName,
  workspaceId,
  args,
  output,
  durationMs,
}: {
  toolName: string;
  workspaceId: string;
  args: unknown;
  output: { success?: boolean; message?: string; error?: string };
  durationMs: number;
}): string =>
  [
    `▶ ${toolName} (workspace ${workspaceId})`,
    '  input:',
    indent(truncateForLog(args)),
    `◀ ${toolName} ${output.success === false ? 'FAILED' : 'ok'} in ${(durationMs / 1000).toFixed(1)}s` +
      (output.message ? ` — ${output.message}` : ''),
    output.error ? `  error: ${output.error}` : null,
    '  output:',
    indent(truncateForLog(output)),
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
