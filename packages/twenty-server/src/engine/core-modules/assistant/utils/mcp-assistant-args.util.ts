/** Sanitize tool args for logging (redact tokens, truncate long strings). */
export const sanitizeArgsForLog = (
  args: Record<string, unknown>,
): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  const redactKeys = ['apiToken', 'api_token', 'token', 'password'];
  for (const [k, v] of Object.entries(args)) {
    if (redactKeys.some((rk) => k.toLowerCase().includes(rk))) {
      out[k] = '[redacted]';
    } else if (typeof v === 'string' && v.length > 100) {
      out[k] = v.slice(0, 100) + '...';
    } else {
      out[k] = v;
    }
  }
  return out;
};
