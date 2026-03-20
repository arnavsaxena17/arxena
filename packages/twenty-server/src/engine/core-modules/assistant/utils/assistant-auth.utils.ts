export const extractBearerApiToken = (
  authHeader: string | undefined,
): string | null => {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.slice(7).replace(/[\r\n]+/g, '');
};
