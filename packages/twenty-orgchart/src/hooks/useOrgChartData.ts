import { useCallback, useState } from 'react';

/**
 * Normalizes a company ID that may be over-encoded (e.g. h%2526m from H&M).
 * Decodes repeatedly until stable, then returns the canonical form for URL encoding.
 */
export function normalizeCompanyIdForUrl(companyId: string): string {
  if (!companyId?.trim()) return companyId;
  let decoded = companyId.trim();
  let prev = '';
  while (prev !== decoded) {
    prev = decoded;
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      break;
    }
  }
  return decoded;
}

type OrgChartCompanyInput = {
  companyId: string | null;
  companyName?: string;
  website?: string;
  country?: string;
  functionRoot?: string;
};

export type UseOrgChartDataOptions = {
  /** Base URL. For direct server: full URL (e.g. https://server.com). For proxy: /api/org-chart */
  baseUrl: string;
  accessToken?: string;
  /** When true (default), path is /org-chart/{id}. When false (proxy), path is /{id} */
  useOrgChartPrefix?: boolean;
};

export const useOrgChartData = (
  company: OrgChartCompanyInput | null,
  options: UseOrgChartDataOptions,
) => {
  const { baseUrl, accessToken, useOrgChartPrefix = true } = options;

  const companyId = company?.companyId ?? null;
  const companyName = company?.companyName;
  const website = company?.website;
  const country = company?.country;
  const functionRoot = company?.functionRoot;

  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrgChart = useCallback(async () => {
    if (!companyId) {
      setData(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
      const canonicalCompanyId = normalizeCompanyIdForUrl(companyId);
      const slugForPath =
        canonicalCompanyId.replace(/-/g, '_').toLowerCase();
      const params = new URLSearchParams();

      if (companyName && companyName.trim().length > 0) {
        params.set('companyName', companyName.trim());
      }

      if (website && website.trim().length > 0) {
        params.set('website', website.trim());
      }

      if (country && country.trim().length > 0) {
        params.set('country', country.trim());
      }

      if (functionRoot && functionRoot.trim().length > 0) {
        params.set('functionRoot', functionRoot.trim());
      }

      const queryString = params.toString();
      const prefix = useOrgChartPrefix ? '/org-chart' : '';
      const endpointPath =
        slugForPath === 'yuga_labs'
          ? `${prefix}/manual/${encodeURIComponent(canonicalCompanyId)}`
          : `${prefix}/${encodeURIComponent(canonicalCompanyId)}`;

      const url = `${normalizedBaseUrl}${endpointPath}${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...(accessToken && {
            Authorization: `Bearer ${accessToken}`,
          }),
        },
      });

      const json = (await response.json()) as {
        status?: string;
        result?: Record<string, unknown>;
      };

      if (json?.status === 'ok' && json.result) {
        setData(json.result);
      } else {
        setError('Failed to load org chart');
        setData(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch org chart');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [companyId, companyName, website, country, functionRoot, baseUrl, accessToken, useOrgChartPrefix]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    data,
    isLoading,
    error,
    fetchOrgChart,
    reset,
  };
};
