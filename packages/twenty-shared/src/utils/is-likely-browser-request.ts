type HeaderLike =
  | {
      get(name: string): string | null | undefined;
    }
  | Record<string, string | string[] | undefined>;

const SEC_FETCH_SITE_VALUES = new Set([
  'same-origin',
  'same-site',
  'cross-site',
  'none',
]);

const SEC_FETCH_MODE_VALUES = new Set([
  'navigate',
  'cors',
  'no-cors',
  'same-origin',
  'websocket',
]);

const getHeaderValue = (
  headers: HeaderLike,
  name: string,
): string | null => {
  const lower = name.toLowerCase();

  if ('get' in headers && typeof headers.get === 'function') {
    const value = headers.get(lower) ?? headers.get(name);
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    return null;
  }

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== lower) {
      continue;
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    if (Array.isArray(value) && value.length > 0) {
      const first = value[0];
      if (typeof first === 'string' && first.trim().length > 0) {
        return first.trim();
      }
    }
  }

  return null;
};

/**
 * Best-effort signal that the request originated from a real browser fetch/navigation.
 * Modern browsers send Sec-Fetch-* and Sec-CH-UA; most scripts/scrapers omit them even
 * when spoofing Chrome User-Agent.
 */
export const isLikelyBrowserRequest = (headers: HeaderLike): boolean => {
  const secFetchSite = getHeaderValue(headers, 'sec-fetch-site')?.toLowerCase();
  if (secFetchSite && SEC_FETCH_SITE_VALUES.has(secFetchSite)) {
    return true;
  }

  const secFetchMode = getHeaderValue(headers, 'sec-fetch-mode')?.toLowerCase();
  if (secFetchMode && SEC_FETCH_MODE_VALUES.has(secFetchMode)) {
    return true;
  }

  const secChUa = getHeaderValue(headers, 'sec-ch-ua');
  if (secChUa && secChUa.includes('"')) {
    return true;
  }

  return false;
};
