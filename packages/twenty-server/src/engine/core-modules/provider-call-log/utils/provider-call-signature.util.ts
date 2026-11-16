import { stableStringifyProviderQueryCacheValue } from 'src/engine/core-modules/cache-storage/utils/provider-query-cache-key.util';

// Requests are stored whole so a run can be replayed; only pathological
// payloads (a pasted company list) are cut
const MAX_REQUEST_BYTES = 64 * 1024;

// The form a request is stored in, so a live call and its recording compare
// equal: objects as they are, anything else wrapped
export const normalizeProviderCallRequest = (
  request: unknown,
): Record<string, unknown> | null => {
  if (request === undefined || request === null) {
    return null;
  }

  try {
    const serialized = JSON.stringify(request);

    if (serialized === undefined) {
      return null;
    }

    if (Buffer.byteLength(serialized) > MAX_REQUEST_BYTES) {
      return {
        truncated: true,
        preview: serialized.slice(0, MAX_REQUEST_BYTES),
      };
    }

    // Cache key parts are usually objects; a bare string or list is wrapped so
    // the column always holds an object
    return typeof request === 'object' && !Array.isArray(request)
      ? (request as Record<string, unknown>)
      : { value: request };
  } catch {
    return { unserializable: true };
  }
};

// The same request asked twice has the same signature, whichever cache layer
// answered it
export const providerCallSignatureOf = ({
  provider,
  operation,
  cacheKey,
  request,
}: {
  provider: string;
  operation: string;
  cacheKey?: string | null;
  request?: unknown;
}): string =>
  `${provider}|${operation}|${
    cacheKey ??
    stableStringifyProviderQueryCacheValue(
      normalizeProviderCallRequest(request) ?? {},
    )
  }`;
