import { getTokenPair } from '@/apollo/utils/getTokenPair';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

const getServerBaseUrl = (): string =>
  (REACT_APP_SERVER_BASE_URL ?? '').replace(/\/$/, '');

const getAccessToken = (): string => {
  const tokenPair = getTokenPair();
  return tokenPair?.accessOrWorkspaceAgnosticToken?.token ?? '';
};

const authHeaders = (): HeadersInit => {
  const accessToken = getAccessToken();
  return {
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
};

export type WebsiteTrackerSnippet = {
  appId: string;
  enabled: boolean;
  snippet: string;
  siteBaseUrl: string;
  apiBaseUrl: string;
};

export type WebsiteDomainRecord = {
  id: string;
  name?: string | null;
  domain?: string | null;
  status?: string | null;
  trackingLevel?: string | null;
  lastSeenAt?: string | null;
  lastError?: string | null;
  verifiedAt?: string | null;
};

export const fetchWebsiteTrackerSnippet =
  async (): Promise<WebsiteTrackerSnippet> => {
    const response = await fetch(
      `${getServerBaseUrl()}/website-tracker/snippet`,
      { headers: authHeaders() },
    );

    if (!response.ok) {
      throw new Error('Failed to load website tracker snippet');
    }

    const json = (await response.json()) as WebsiteTrackerSnippet & {
      status?: string;
    };

    return {
      appId: json.appId,
      enabled: json.enabled,
      snippet: json.snippet,
      siteBaseUrl: json.siteBaseUrl,
      apiBaseUrl: json.apiBaseUrl,
    };
  };

export const fetchWebsiteDomains = async (): Promise<WebsiteDomainRecord[]> => {
  const response = await fetch(`${getServerBaseUrl()}/website-tracker/domains`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load website domains');
  }

  const json = (await response.json()) as {
    domains?: WebsiteDomainRecord[];
  };

  return json.domains ?? [];
};

export const createWebsiteDomain = async (
  domain: string,
): Promise<WebsiteDomainRecord> => {
  const response = await fetch(`${getServerBaseUrl()}/website-tracker/domains`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ domain }),
  });

  if (!response.ok) {
    const json = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(json?.message ?? 'Failed to add domain');
  }

  const json = (await response.json()) as { domain?: WebsiteDomainRecord };
  if (!json.domain) {
    throw new Error('Failed to add domain');
  }

  return json.domain;
};

export const deleteWebsiteDomain = async (domainId: string): Promise<void> => {
  const response = await fetch(
    `${getServerBaseUrl()}/website-tracker/domains/${encodeURIComponent(domainId)}`,
    {
      method: 'DELETE',
      headers: authHeaders(),
    },
  );

  if (!response.ok) {
    throw new Error('Failed to delete domain');
  }
};

export const testWebsiteDomainConnection = async (
  domainId: string,
): Promise<{ status: string; lastError: string | null }> => {
  const response = await fetch(
    `${getServerBaseUrl()}/website-tracker/domains/${encodeURIComponent(domainId)}/test-connection`,
    {
      method: 'POST',
      headers: authHeaders(),
    },
  );

  if (!response.ok) {
    throw new Error('Failed to test connection');
  }

  const json = (await response.json()) as {
    status?: string;
    lastError?: string | null;
  };

  return {
    status: json.status ?? 'FAILED',
    lastError: json.lastError ?? null,
  };
};

export type WebsiteVisitorRecord = {
  id: string;
  name?: string | null;
  companyName?: string | null;
  companyDomain?: string | null;
  country?: string | null;
  city?: string | null;
  pagePath?: string | null;
  confidence?: string | null;
  visitCount?: number | null;
  lastSeenAt?: string | null;
  companyId?: string | null;
};

export const fetchWebsiteVisitors = async (): Promise<
  WebsiteVisitorRecord[]
> => {
  const response = await fetch(
    `${getServerBaseUrl()}/website-tracker/visitors`,
    { headers: authHeaders() },
  );

  if (!response.ok) {
    throw new Error('Failed to load website visitors');
  }

  const json = (await response.json()) as {
    visitors?: WebsiteVisitorRecord[];
  };

  return json.visitors ?? [];
};
