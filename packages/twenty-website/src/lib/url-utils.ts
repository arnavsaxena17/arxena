/**
 * Decode path that may have been over-encoded (e.g. by crawlers/proxies that
 * re-encode % to %25 repeatedly). Decodes until stable to handle l%2526... -> l&t.
 */
export function decodeOverEncodedPath(encoded: string): string {
  let decoded = encoded;
  let prev = '';
  while (decoded !== prev) {
    prev = decoded;
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      break;
    }
  }
  return decoded;
}
