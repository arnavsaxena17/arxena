// Bright Data rejects a business search query longer than this
export const LINKEDIN_URL_LOOKUP_MAX_QUERY_LENGTH = 200;

// `https://in.linkedin.com/in/jane-doe/` -> `linkedin.com/in/jane-doe`. The
// shorter form matches the same profile and fits more profiles in one query.
export const toShortLinkedinProfileUrl = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, '');

    if (
      !/(^|\.)linkedin\.com$/i.test(parsed.hostname) ||
      !/^\/in\/[^/]+$/.test(path)
    ) {
      return null;
    }

    return `linkedin.com${path}`;
  } catch {
    return null;
  }
};

// Space-separated profile URLs, packed greedily into queries that stay under
// the limit. A single URL longer than the limit is dropped, not truncated.
export const packLinkedinUrlLookupQueries = (
  urls: string[],
  maxLength: number = LINKEDIN_URL_LOOKUP_MAX_QUERY_LENGTH,
): string[][] => {
  const shortUrls = [
    ...new Set(
      urls
        .map(toShortLinkedinProfileUrl)
        .filter(
          (url): url is string => url !== null && url.length <= maxLength,
        ),
    ),
  ];
  const batches: string[][] = [];
  let current: string[] = [];
  let currentLength = 0;

  for (const url of shortUrls) {
    const addedLength = current.length === 0 ? url.length : url.length + 1;

    if (current.length > 0 && currentLength + addedLength > maxLength) {
      batches.push(current);
      current = [];
      currentLength = 0;
    }

    currentLength += current.length === 0 ? url.length : url.length + 1;
    current.push(url);
  }

  if (current.length > 0) {
    batches.push(current);
  }

  return batches;
};
