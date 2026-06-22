import { normalizeLinkedinConnectionIp } from 'src/engine/core-modules/arx-chat/utils/build-unipile-linkedin-cookie-connect-body.util';
import { isPrivateOrLocalClientIp } from 'twenty-shared';

export const resolveLinkedinSyncClientIp = (args: {
  serverIp?: string | null;
  extensionIp?: string | null;
}): string | undefined => {
  const candidates = [
    normalizeLinkedinConnectionIp(args.serverIp),
    normalizeLinkedinConnectionIp(args.extensionIp),
  ].filter((ip): ip is string => Boolean(ip));

  for (const ip of candidates) {
    if (!isPrivateOrLocalClientIp(ip)) {
      return ip;
    }
  }

  return undefined;
};
