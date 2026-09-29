import { createHmac, timingSafeEqual } from 'crypto';

const UNINSTALL_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type ExtensionUninstallTokenPayload = {
  workspaceId: string;
  workspaceMemberId: string;
  exp: number;
};

const signBody = (body: string, appSecret: string): string =>
  createHmac('sha256', appSecret).update(body).digest('base64url');

export const createExtensionUninstallToken = ({
  workspaceId,
  workspaceMemberId,
  appSecret,
  nowMs = Date.now(),
}: {
  workspaceId: string;
  workspaceMemberId: string;
  appSecret: string;
  nowMs?: number;
}): string => {
  const payload: ExtensionUninstallTokenPayload = {
    workspaceId,
    workspaceMemberId,
    exp: nowMs + UNINSTALL_TOKEN_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');

  return `${body}.${signBody(body, appSecret)}`;
};

export const readExtensionUninstallToken = ({
  token,
  appSecret,
  nowMs = Date.now(),
}: {
  token: string;
  appSecret: string;
  nowMs?: number;
}): ExtensionUninstallTokenPayload | null => {
  const separatorIndex = token.indexOf('.');

  if (separatorIndex <= 0) {
    return null;
  }

  const body = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  const expectedSignature = signBody(body, appSecret);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8'),
    ) as Partial<ExtensionUninstallTokenPayload>;

    if (
      typeof parsed.workspaceId !== 'string' ||
      typeof parsed.workspaceMemberId !== 'string' ||
      typeof parsed.exp !== 'number' ||
      parsed.exp < nowMs
    ) {
      return null;
    }

    return {
      workspaceId: parsed.workspaceId,
      workspaceMemberId: parsed.workspaceMemberId,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
};
