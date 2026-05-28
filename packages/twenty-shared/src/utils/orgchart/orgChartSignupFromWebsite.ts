/** Query params used when reading legacy / bookmarked sign-up links (no longer written from marketing pages). */
export const ORG_CHART_SIGNUP_SEARCH_PARAMS = {
  company: 'orgChartCompany',
  function: 'orgChartFunction',
  country: 'orgChartCountry',
} as const;

export const ORG_CHART_SIGNUP_CONTEXT_STORAGE_KEY =
  'arxena:orgChartSignupContext';

/** Short-lived cookie shared across arxena.com and app.arxena.com subdomains. */
export const ORG_CHART_SIGNUP_CONTEXT_COOKIE_NAME = 'arx_org_chart_signup';

const ORG_CHART_SIGNUP_COOKIE_MAX_AGE_SECONDS = 600;

export const formatOrgChartSliceLabel = (s: string): string =>
  s
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

export type OrgChartSignupUrlParams = {
  companyName?: string;
  selectedCountry?: string;
  selectedFunctionRoot?: string;
};

export type OrgChartSignupContext = {
  companyName?: string;
  selectedCountry?: string;
  selectedFunctionRoot?: string;
};

const normalizeSignupContext = (
  params: OrgChartSignupUrlParams,
): OrgChartSignupContext | null => {
  const companyName = params.companyName?.trim();
  const selectedCountry = params.selectedCountry?.trim();
  const selectedFunctionRoot = params.selectedFunctionRoot?.trim();

  if (!companyName && !selectedCountry && !selectedFunctionRoot) {
    return null;
  }

  const context: OrgChartSignupContext = {};
  if (companyName) {
    context.companyName = companyName;
  }
  if (selectedCountry && selectedCountry !== 'global') {
    context.selectedCountry = selectedCountry;
  }
  if (selectedFunctionRoot && selectedFunctionRoot !== 'fullcompany') {
    context.selectedFunctionRoot = selectedFunctionRoot;
  }

  return Object.keys(context).length > 0 ? context : null;
};

const getSharedCookieDomain = (): string | undefined => {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const host = window.location.hostname;
  if (host === 'arxena.com' || host.endsWith('.arxena.com')) {
    return '.arxena.com';
  }

  if (host.endsWith('.localhost')) {
    return '.localhost';
  }

  return undefined;
};

const isSecureCookieContext = (): boolean => {
  if (typeof window === 'undefined') {
    return true;
  }
  return window.location.protocol === 'https:';
};

const encodeCookieValue = (context: OrgChartSignupContext): string =>
  encodeURIComponent(JSON.stringify(context));

const parseCookieValue = (raw: string): OrgChartSignupContext | null => {
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as OrgChartSignupContext;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const readOrgChartSignupContextCookie = (): OrgChartSignupContext | null => {
  if (typeof document === 'undefined') {
    return null;
  }

  const prefix = `${ORG_CHART_SIGNUP_CONTEXT_COOKIE_NAME}=`;
  const entry = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  if (!entry) {
    return null;
  }

  return parseCookieValue(entry.slice(prefix.length));
};

const writeOrgChartSignupContextCookie = (
  context: OrgChartSignupContext,
): void => {
  if (typeof document === 'undefined') {
    return;
  }

  const sharedDomain = getSharedCookieDomain();
  const domainPart = sharedDomain ? `; domain=${sharedDomain}` : '';
  const securePart = isSecureCookieContext() ? '; Secure' : '';

  document.cookie = `${ORG_CHART_SIGNUP_CONTEXT_COOKIE_NAME}=${encodeCookieValue(context)}; path=/; max-age=${ORG_CHART_SIGNUP_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${securePart}${domainPart}`;
};

const clearOrgChartSignupContextCookie = (): void => {
  if (typeof document === 'undefined') {
    return;
  }

  const sharedDomain = getSharedCookieDomain();
  const domainPart = sharedDomain ? `; domain=${sharedDomain}` : '';
  const securePart = isSecureCookieContext() ? '; Secure' : '';

  document.cookie = `${ORG_CHART_SIGNUP_CONTEXT_COOKIE_NAME}=; path=/; max-age=0${securePart}${domainPart}`;
};

/** Strips org-chart signup query params so crawlers only see a plain sign-up path in HTML. */
export const stripOrgChartSignupSearchParams = (urlString: string): string => {
  const baseForRelative =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://app.arxena.com';

  try {
    const url = urlString.startsWith('http')
      ? new URL(urlString)
      : new URL(urlString, baseForRelative);
    for (const key of Object.values(ORG_CHART_SIGNUP_SEARCH_PARAMS)) {
      url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return urlString;
  }
};

/** @deprecated Prefer {@link persistOrgChartSignupContext} + plain sign-up URL in public links. */
export const appendOrgChartSignupSearchParams = (
  baseUrl: string,
  params: OrgChartSignupUrlParams,
): string => {
  const baseForRelative =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://app.arxena.com';

  let url: URL;
  try {
    url = baseUrl.startsWith('http')
      ? new URL(baseUrl)
      : new URL(baseUrl, baseForRelative);
  } catch {
    return baseUrl;
  }

  const context = normalizeSignupContext(params);
  if (!context) {
    return stripOrgChartSignupSearchParams(url.toString());
  }

  if (context.companyName) {
    url.searchParams.set(
      ORG_CHART_SIGNUP_SEARCH_PARAMS.company,
      context.companyName,
    );
  }
  if (context.selectedFunctionRoot) {
    url.searchParams.set(
      ORG_CHART_SIGNUP_SEARCH_PARAMS.function,
      context.selectedFunctionRoot,
    );
  }
  if (context.selectedCountry) {
    url.searchParams.set(
      ORG_CHART_SIGNUP_SEARCH_PARAMS.country,
      context.selectedCountry,
    );
  }

  return url.toString();
};

export const persistOrgChartSignupContext = (
  params: OrgChartSignupUrlParams,
): void => {
  const context = normalizeSignupContext(params);

  if (typeof window === 'undefined') {
    return;
  }

  if (!context) {
    clearOrgChartSignupContext();
    return;
  }

  writeOrgChartSignupContextCookie(context);

  if (window.sessionStorage) {
    window.sessionStorage.setItem(
      ORG_CHART_SIGNUP_CONTEXT_STORAGE_KEY,
      JSON.stringify(context),
    );
  }
};

export const readOrgChartSignupContext = (): OrgChartSignupContext | null => {
  const fromCookie = readOrgChartSignupContextCookie();
  if (fromCookie) {
    return fromCookie;
  }

  if (typeof window === 'undefined' || !window.sessionStorage) {
    return null;
  }

  const raw = window.sessionStorage.getItem(
    ORG_CHART_SIGNUP_CONTEXT_STORAGE_KEY,
  );
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as OrgChartSignupContext;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const clearOrgChartSignupContext = (): void => {
  clearOrgChartSignupContextCookie();

  if (typeof window !== 'undefined' && window.sessionStorage) {
    window.sessionStorage.removeItem(ORG_CHART_SIGNUP_CONTEXT_STORAGE_KEY);
  }
};

/** Browser-only: store context and navigate to a plain sign-up URL (no query params). */
export const navigateToOrgChartSignup = (
  baseUrl: string,
  params: OrgChartSignupUrlParams,
): void => {
  if (typeof window === 'undefined') {
    return;
  }

  persistOrgChartSignupContext(params);
  window.location.assign(stripOrgChartSignupSearchParams(baseUrl));
};

export const consumeOrgChartSignupContext = (): OrgChartSignupContext | null => {
  const context = readOrgChartSignupContext();
  clearOrgChartSignupContext();
  return context;
};
