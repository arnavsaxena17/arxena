/**
 * Decode JWT payload (no signature verification — integration tests only).
 */
export function decodeJwtPayloadUnsafe(token: string): Record<string, unknown> | null {
  const parts = token.trim().split('.');
  if (parts.length < 2) {
    return null;
  }
  const segment = parts[1];
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  const base64 = padded + '='.repeat(padLen);
  try {
    const json = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getWorkspaceMemberIdFromBearerToken(token: string): string | null {
  const fromEnv = process.env.E2E_WORKSPACE_MEMBER_ID?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  const payload = decodeJwtPayloadUnsafe(token);
  if (!payload) {
    return null;
  }
  const id = payload.workspaceMemberId ?? payload.sub;
  return typeof id === 'string' && id.length > 0 ? id : null;
}
