type HeaderLike =
  | {
      get(name: string): string | null | undefined;
    }
  | Record<string, string | string[] | undefined>;

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
 * Stricter than {@link isLikelyBrowserRequest}: requires Fetch Metadata typical of
 * `<img src="...">` or same-origin subresource loads. Blocks scrapers that only
 * spoof User-Agent / Sec-CH-UA without Sec-Fetch-*.
 */
export const isLikelyBrowserLogoRequest = (headers: HeaderLike): boolean => {
  const secFetchDest = getHeaderValue(headers, 'sec-fetch-dest')?.toLowerCase();
  if (secFetchDest === 'image') {
    return true;
  }

  const secFetchSite = getHeaderValue(headers, 'sec-fetch-site')?.toLowerCase();
  const secFetchMode = getHeaderValue(headers, 'sec-fetch-mode')?.toLowerCase();
  if (
    secFetchSite &&
    (secFetchSite === 'same-origin' || secFetchSite === 'same-site') &&
    secFetchMode &&
    (secFetchMode === 'no-cors' || secFetchMode === 'cors')
  ) {
    return true;
  }

  return false;
};
