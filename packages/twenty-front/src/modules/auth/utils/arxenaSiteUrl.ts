const CANONICAL_PRODUCTION_SITE_URL = 'https://arxena.com';
const DEFAULT_LOCAL_SITE_PORT = '3002';

const isProductionHostname = (hostname: string): boolean =>
  hostname === 'arxena.com' ||
  hostname === 'www.arxena.com' ||
  (hostname.endsWith('.arxena.com') && !hostname.includes('localhost'));

const isLocalDevelopmentHostname = (hostname: string): boolean =>
  hostname === 'localhost' ||
  hostname.endsWith('.localhost') ||
  hostname.includes('localhost');

/**
 * Base URL for the marketing site (twenty-website) where public org-chart pages
 * and /org/{slug} published links are served.
 */
const normalizeSiteBaseUrl = (url: string): string => url.replace(/\/$/, '');

const isCanonicalProductionSiteUrl = (url: string): boolean => {
  const normalized = normalizeSiteBaseUrl(url);
  return (
    normalized === CANONICAL_PRODUCTION_SITE_URL ||
    normalized === 'https://www.arxena.com'
  );
};

export const getArxenaSiteBaseUrl = (): string => {
  const fromEnv = process.env.REACT_APP_ARXENA_SITE_BASE_URL?.trim();
  if (
    fromEnv &&
    !(
      process.env.NODE_ENV === 'development' &&
      isCanonicalProductionSiteUrl(fromEnv)
    )
  ) {
    return normalizeSiteBaseUrl(fromEnv);
  }

  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location;

    if (isProductionHostname(hostname)) {
      return CANONICAL_PRODUCTION_SITE_URL;
    }

    if (isLocalDevelopmentHostname(hostname)) {
      const port =
        process.env.REACT_APP_ARXENA_SITE_PORT?.trim() ||
        DEFAULT_LOCAL_SITE_PORT;
      return `${protocol}//${hostname}:${port}`;
    }
  }

  if (process.env.NODE_ENV === 'development') {
    return `http://localhost:${DEFAULT_LOCAL_SITE_PORT}`;
  }

  return CANONICAL_PRODUCTION_SITE_URL;
};

export const resolveArxenaSiteBaseUrlForTests = (input: {
  envBaseUrl?: string;
  nodeEnv?: string;
  hostname?: string;
  protocol?: string;
  sitePort?: string;
}): string => {
  const fromEnv = input.envBaseUrl?.trim();
  if (
    fromEnv &&
    !(
      input.nodeEnv === 'development' &&
      isCanonicalProductionSiteUrl(fromEnv)
    )
  ) {
    return normalizeSiteBaseUrl(fromEnv);
  }

  const hostname = input.hostname ?? '';
  if (hostname && isProductionHostname(hostname)) {
    return CANONICAL_PRODUCTION_SITE_URL;
  }
  if (hostname && isLocalDevelopmentHostname(hostname)) {
    const port = input.sitePort?.trim() || DEFAULT_LOCAL_SITE_PORT;
    const protocol = input.protocol ?? 'http:';
    return `${protocol}//${hostname}:${port}`;
  }

  if (input.nodeEnv === 'development') {
    return `http://localhost:${DEFAULT_LOCAL_SITE_PORT}`;
  }

  return CANONICAL_PRODUCTION_SITE_URL;
};

/** Host (+ port) for display in share UI, e.g. `arxena.com` or `arxena.localhost:3002`. */
export const getArxenaSitePublicHost = (): string => {
  try {
    return new URL(getArxenaSiteBaseUrl()).host;
  } catch {
    return 'arxena.com';
  }
};

/**
 * Builds arxena-site URL with the Twenty access token in the hash.
 * Arxena-site will read the token, set the auth_token cookie, and treat the user as logged in (no MongoDB linking).
 *
 * @param accessToken - Twenty JWT access token (e.g. from tokenPairState)
 * @param path - Optional path on arxena-site (default '/')
 */
export const getArxenaSiteUrlWithToken = (
  accessToken: string,
  path: string = '/',
): string => {
  const base = getArxenaSiteBaseUrl().replace(/\/$/, '');
  const pathPart = path.startsWith('/') ? path : `/${path}`;
  const tokenEncoded = encodeURIComponent(accessToken);
  return `${base}${pathPart}#token=${tokenEncoded}`;
};
