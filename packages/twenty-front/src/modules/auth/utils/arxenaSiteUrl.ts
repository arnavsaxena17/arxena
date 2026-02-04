/**
 * Base URL for arxena-site (Python org charts app). Used to open the same
 * authenticated user on arxena-site by passing the Twenty access token in the URL hash.
 * Local: redirect to localhost:5050. Production: redirect to arxena.com.
 */
export const getArxenaSiteBaseUrl = (): string => {
  if (process.env.REACT_APP_ARXENA_SITE_BASE_URL) {
    return process.env.REACT_APP_ARXENA_SITE_BASE_URL;
  }
  const isLocal =
    (typeof window !== 'undefined' && window.location?.hostname?.includes('localhost')) ||
    (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development');
  return isLocal ? 'http://localhost:5050' : 'https://arxena.com';
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
