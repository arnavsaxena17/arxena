const normalizeOrigin = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const withProtocol =
      trimmed.startsWith('http://') || trimmed.startsWith('https://')
        ? trimmed
        : `https://${trimmed}`;
    const url = new URL(withProtocol);
    return `${url.protocol}//${url.host}`.toLowerCase();
  } catch {
    return null;
  }
};

const originMatchesPattern = (
  requestOrigin: string,
  allowedPattern: string,
): boolean => {
  const normalizedPattern = normalizeOrigin(allowedPattern);
  if (!normalizedPattern) {
    return false;
  }

  if (!normalizedPattern.includes('*')) {
    return requestOrigin === normalizedPattern;
  }

  try {
    const patternUrl = new URL(normalizedPattern.replace('*.', 'wildcard.'));
    const patternHost = patternUrl.host.replace('wildcard.', '');
    const requestUrl = new URL(requestOrigin);
    const requestHost = requestUrl.host;

    return (
      requestHost === patternHost || requestHost.endsWith(`.${patternHost}`)
    );
  } catch {
    return false;
  }
};

export const extractRequestOrigin = (input: {
  origin?: string | null;
  referer?: string | null;
}): string | null => {
  const fromOrigin = input.origin ? normalizeOrigin(input.origin) : null;
  if (fromOrigin) {
    return fromOrigin;
  }

  const referer = input.referer?.trim();
  if (!referer) {
    return null;
  }

  try {
    const refererUrl = new URL(referer);
    return `${refererUrl.protocol}//${refererUrl.host}`.toLowerCase();
  } catch {
    return null;
  }
};

export const isOriginAllowed = (
  requestOrigin: string | null,
  allowedOrigins: string[],
): boolean => {
  if (!requestOrigin || allowedOrigins.length === 0) {
    return false;
  }

  return allowedOrigins.some((allowed) =>
    originMatchesPattern(requestOrigin, allowed),
  );
};

export const normalizeAllowedOrigins = (origins: string[]): string[] => {
  const normalized = origins
    .map((origin) => normalizeOrigin(origin))
    .filter((origin): origin is string => Boolean(origin));

  return [...new Set(normalized)];
};
