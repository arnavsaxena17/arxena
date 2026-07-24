/**
 * Returns a same-origin proxy URL for external image URLs so the browser
 * can load them without Cross-Origin-Resource-Policy blocking (e.g. LinkedIn).
 * Same-origin or non-http(s) URLs are returned unchanged.
 */
const ALLOWED_IMAGE_HOSTS = new Set([
  'media.licdn.com',
  'media-exp1.licdn.com',
  'static.licdn.com',
  'st2.depositphotos.com',
]);

const ALLOWED_IMAGE_HOST_SUFFIXES = ['.theorg.com'];
const PERSISTED_AVATAR_PATH_PREFIX = '/avatars/';
/** Marketing site org-chart API base (e.g. https://arxena.com/api/org-chart). */
const MARKETING_ORG_CHART_API_SUFFIX = '/api/org-chart';

const isPersistedAvatarUrl = (url: string): boolean => {
  const trimmed = url.trim();
  if (trimmed.startsWith(PERSISTED_AVATAR_PATH_PREFIX)) {
    return true;
  }
  try {
    return new URL(trimmed).pathname.startsWith(PERSISTED_AVATAR_PATH_PREFIX);
  } catch {
    return false;
  }
};

const toBase64Url = (value: string): string => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'utf8').toString('base64url');
  }

  const utf8 = encodeURIComponent(value).replace(
    /%([0-9A-F]{2})/giu,
    (_, hex: string) => String.fromCharCode(parseInt(hex, 16)),
  );

  return btoa(utf8)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
};

const buildDeterministicProxyPath = (imageUrl: string): string | null => {
  const parsed = new URL(imageUrl);
  const normalizedHost = parsed.hostname.toLowerCase();

  if (ALLOWED_IMAGE_HOST_SUFFIXES.some((suffix) => normalizedHost.endsWith(suffix))) {
    const match = parsed.pathname.match(
      /^\/([a-z0-9-]+?)(?:_([a-z0-9-]+))?\.([a-z0-9]+)$/iu,
    );

    if (match) {
      const [, imageId, variant, ext] = match;

      return `/org-chart/image-proxy/images-1/${imageId}/${variant || 'original'}/${ext.toLowerCase()}`;
    }
  }

  if (ALLOWED_IMAGE_HOSTS.has(normalizedHost)) {
    const encodedHost = toBase64Url(normalizedHost);
    const encodedPath = toBase64Url(`${parsed.pathname}${parsed.search}`);

    return `/org-chart/image-proxy/images-2/${encodedHost}/${encodedPath}`;
  }

  return null;
};

const extractPersistedAvatarPath = (url: string): string | null => {
  const trimmed = url.trim();
  if (trimmed.startsWith(PERSISTED_AVATAR_PATH_PREFIX)) {
    return trimmed;
  }
  try {
    const pathname = new URL(trimmed).pathname;
    if (pathname.startsWith(PERSISTED_AVATAR_PATH_PREFIX)) {
      return pathname;
    }
  } catch {
    return null;
  }
  return null;
};

/** Maps `/avatars/{key}` to the public URL for the current API base. */
const resolvePersistedAvatarPublicUrl = (
  url: string,
  normalizedBase: string,
): string => {
  const avatarPath = extractPersistedAvatarPath(url);
  if (!avatarPath) {
    return url;
  }

  if (normalizedBase.endsWith(MARKETING_ORG_CHART_API_SUFFIX)) {
    const siteOrigin = normalizedBase.slice(
      0,
      -MARKETING_ORG_CHART_API_SUFFIX.length,
    );
    return `${siteOrigin}/api${avatarPath}`;
  }

  if (normalizedBase) {
    return `${normalizedBase}${avatarPath}`;
  }

  return avatarPath;
};

/** Next.js website proxy uses `/api/org-chart` + `/image-proxy/...` (not `/org-chart/image-proxy`). */
const resolveProxyPathForApiBase = (
  proxyPath: string,
  normalizedBase: string,
): string => {
  if (
    normalizedBase.endsWith('/org-chart') &&
    proxyPath.startsWith('/org-chart/image-proxy/')
  ) {
    return proxyPath.replace(/^\/org-chart/u, '');
  }

  return proxyPath;
};

export function getProxiedImageUrl(
  imageUrl: string | null | undefined,
  apiBaseUrl: string,
): string {
  if (!imageUrl || typeof imageUrl !== 'string') return imageUrl ?? '';
  const trimmed = imageUrl.trim();
  if (!trimmed) {
    return imageUrl;
  }

  const normalizedBase = apiBaseUrl.replace(/\/$/, '');

  if (isPersistedAvatarUrl(trimmed)) {
    return resolvePersistedAvatarPublicUrl(trimmed, normalizedBase);
  }

  if (trimmed.startsWith('/org-chart/image-proxy/')) {
    const proxyPath = resolveProxyPathForApiBase(trimmed, normalizedBase);

    return normalizedBase ? `${normalizedBase}${proxyPath}` : trimmed;
  }

  if (!trimmed.startsWith('http:') && !trimmed.startsWith('https:')) {
    return imageUrl;
  }
  try {
    const imageOrigin = new URL(trimmed).origin;
    const apiOrigin = new URL(normalizedBase).origin;
    if (imageOrigin === apiOrigin) return imageUrl;

    const proxyPath = buildDeterministicProxyPath(trimmed);

    if (!proxyPath) {
      return imageUrl;
    }

    const resolvedPath = resolveProxyPathForApiBase(proxyPath, normalizedBase);

    return normalizedBase ? `${normalizedBase}${resolvedPath}` : proxyPath;
  } catch {
    return imageUrl;
  }
}
