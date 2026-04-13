import { useCallback, useState } from 'react';

import { normalizeCompanyIdForUrl } from '../utils/normalizeCompanyId';

type OrgChartCompanyInput = {
  companyId: string | null;
  companyName?: string;
  website?: string;
  country?: string;
  functionRoot?: string;
  /**
   * Expected headcount / profile count hint (autocomplete, PDL, LinkedIn).
   * Sent as `expectedEmployeeCount` so the server can scale the blank template.
   */
  expectedEmployeeCount?: number;
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
  const expectedEmployeeCount = company?.expectedEmployeeCount;

  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orgChartEsTransportError, setOrgChartEsTransportError] =
    useState(false);

  const fetchOrgChart = useCallback(async () => {
    if (!companyId) {
      setData(null);
      setError(null);
      setOrgChartEsTransportError(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setOrgChartEsTransportError(false);

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

      if (
        typeof expectedEmployeeCount === 'number' &&
        Number.isFinite(expectedEmployeeCount) &&
        expectedEmployeeCount > 0
      ) {
        params.set(
          'expectedEmployeeCount',
          String(Math.floor(expectedEmployeeCount)),
        );
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
        orgChartEsTransportError?: boolean;
      };

      if (json?.status === 'ok' && json.result) {
        setData(json.result);
        setOrgChartEsTransportError(json.orgChartEsTransportError === true);
      } else {
        setError('Failed to load org chart');
        setData(null);
        setOrgChartEsTransportError(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch org chart');
      setData(null);
      setOrgChartEsTransportError(false);
    } finally {
      setIsLoading(false);
    }
  }, [
    companyId,
    companyName,
    website,
    country,
    functionRoot,
    expectedEmployeeCount,
    baseUrl,
    accessToken,
    useOrgChartPrefix,
  ]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
    setOrgChartEsTransportError(false);
  }, []);

  return {
    data,
    isLoading,
    error,
    orgChartEsTransportError,
    fetchOrgChart,
    reset,
  };
};
