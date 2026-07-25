export const CDN_COUNTRY_HEADER_NAMES = [
  'cloudfront-viewer-country',
  'cf-ipcountry',
  'x-vercel-ip-country',
  'x-country-code',
] as const;

export type CdnCountryHeaderMatch = {
  source: string;
  countryCode: string;
};

const normalizeHeaderValue = (
  value: string | string[] | undefined | null,
): string => {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (
    Array.isArray(value) &&
    value.length > 0 &&
    typeof value[0] === 'string'
  ) {
    return value[0].trim();
  }
  return '';
};

export const getCountryCodeFromCdnHeaders = (
  getHeader: (name: string) => string | string[] | undefined | null,
): CdnCountryHeaderMatch | null => {
  for (const headerName of CDN_COUNTRY_HEADER_NAMES) {
    const normalized = normalizeHeaderValue(getHeader(headerName));
    if (normalized) {
      return {
        source: headerName,
        countryCode: normalized,
      };
    }
  }

  return null;
};
