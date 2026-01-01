/**
 * Extracts API token from request headers
 * @param headers - Request headers object
 * @returns The API token or null if not found
 */
export function extractApiToken(headers: any): string | null {
  const authHeader = headers.authorization || headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

