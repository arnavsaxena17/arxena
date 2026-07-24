import { useCallback, useRef, useState } from 'react';

import { resolveOrgChartCanonicalCompanyId } from 'twenty-shared/utils';

import { normalizeCompanyIdForUrl } from '../utils/normalizeCompanyId';

type OrgChartCompanyInput = {
  companyId: string | null;
  companyName?: string;
  website?: string;
  companyDomain?: string;
  country?: string;
  functionRoot?: string;
  /** Optional MonthYear snapshot filter in YYYY-MM (server best-effort). */
  asOfMonth?: string;
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
  const companyDomain = company?.companyDomain;
  const country = company?.country;
  const functionRoot = company?.functionRoot;
  const asOfMonth = company?.asOfMonth;
  const expectedEmployeeCount = company?.expectedEmployeeCount;

  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orgChartEsTransportError, setOrgChartEsTransportError] =
    useState(false);
  const [firstSourceRequested, setFirstSourceRequested] = useState<
    'apollo' | 'elasticsearch' | null
  >(null);
  const [firstSourceUsed, setFirstSourceUsed] = useState<
    'apollo' | 'elasticsearch' | null
  >(null);
  const [fallbackApplied, setFallbackApplied] = useState(false);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [apolloTotalCount, setApolloTotalCount] = useState<number | null>(null);
  const [apolloQueued, setApolloQueued] = useState(false);
  const [apolloQueueRequestId, setApolloQueueRequestId] = useState<
    string | null
  >(null);

  const fetchGenerationRef = useRef(0);

  const fetchOrgChart = useCallback(async () => {
    const fetchGeneration = fetchGenerationRef.current + 1;
    fetchGenerationRef.current = fetchGeneration;

    const isStale = () => fetchGeneration !== fetchGenerationRef.current;

    if (!companyId) {
      setData(null);
      setError(null);
      setOrgChartEsTransportError(false);
      setFirstSourceRequested(null);
      setFirstSourceUsed(null);
      setFallbackApplied(false);
      setFallbackReason(null);
      setApolloTotalCount(null);
      setApolloQueued(false);
      setApolloQueueRequestId(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setOrgChartEsTransportError(false);
    setFirstSourceRequested(null);
    setFirstSourceUsed(null);
    setFallbackApplied(false);
    setFallbackReason(null);
    setApolloTotalCount(null);
    setApolloQueued(false);
    setApolloQueueRequestId(null);

    try {
      const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
      const canonicalCompanyId = resolveOrgChartCanonicalCompanyId(
        normalizeCompanyIdForUrl(companyId),
      );
      const slugForPath = canonicalCompanyId.replace(/-/g, '_').toLowerCase();
      const params = new URLSearchParams();

      if (companyName && companyName.trim().length > 0) {
        params.set('companyName', companyName.trim());
      }

      if (website && website.trim().length > 0) {
        params.set('website', website.trim());
      }

      if (companyDomain && companyDomain.trim().length > 0) {
        params.set('companyDomain', companyDomain.trim());
      }

      if (country && country.trim().length > 0) {
        params.set('country', country.trim());
      }

      if (functionRoot && functionRoot.trim().length > 0) {
        params.set('functionRoot', functionRoot.trim());
      }

      if (asOfMonth && asOfMonth.trim().length > 0) {
        params.set('asOfMonth', asOfMonth.trim());
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
        message?: string | string[];
        orgChartEsTransportError?: boolean;
        firstSourceRequested?: 'apollo' | 'elasticsearch';
        firstSourceUsed?: 'apollo' | 'elasticsearch';
        fallbackApplied?: boolean;
        fallbackReason?: string;
        apolloTotalCount?: number;
        apolloQueued?: boolean;
        apolloQueueRequestId?: string;
      };

      if (isStale()) {
        return;
      }

      if (response.ok && json?.status === 'ok' && json.result) {
        const didUseApolloSource = json.firstSourceUsed === 'apollo';
        const shouldKeepApolloQueued =
          json.apolloQueued === true && didUseApolloSource === false;

        setData(json.result);
        setOrgChartEsTransportError(json.orgChartEsTransportError === true);
        setFirstSourceRequested(json.firstSourceRequested ?? null);
        setFirstSourceUsed(json.firstSourceUsed ?? null);
        setFallbackApplied(json.fallbackApplied === true);
        setFallbackReason(
          typeof json.fallbackReason === 'string' ? json.fallbackReason : null,
        );
        setApolloTotalCount(
          typeof json.apolloTotalCount === 'number'
            ? json.apolloTotalCount
            : null,
        );
        setApolloQueued(shouldKeepApolloQueued);
        setApolloQueueRequestId(
          shouldKeepApolloQueued &&
            typeof json.apolloQueueRequestId === 'string'
            ? json.apolloQueueRequestId
            : null,
        );
      } else {
        const messageFromServer = Array.isArray(json?.message)
          ? json.message.join(', ')
          : typeof json?.message === 'string'
            ? json.message
            : null;
        setError(
          messageFromServer?.trim() ||
            `Failed to load org chart (status ${response.status})`,
        );
        setData(null);
        setOrgChartEsTransportError(false);
        setFirstSourceRequested(null);
        setFirstSourceUsed(null);
        setFallbackApplied(false);
        setFallbackReason(null);
        setApolloTotalCount(null);
        setApolloQueued(false);
        setApolloQueueRequestId(null);
      }
    } catch (err) {
      if (isStale()) {
        return;
      }
      setError(
        err instanceof Error ? err.message : 'Failed to fetch org chart',
      );
      setData(null);
      setOrgChartEsTransportError(false);
      setFirstSourceRequested(null);
      setFirstSourceUsed(null);
      setFallbackApplied(false);
      setFallbackReason(null);
      setApolloTotalCount(null);
      setApolloQueued(false);
      setApolloQueueRequestId(null);
    } finally {
      if (!isStale()) {
        setIsLoading(false);
      }
    }
  }, [
    companyId,
    companyName,
    website,
    companyDomain,
    country,
    functionRoot,
    asOfMonth,
    expectedEmployeeCount,
    baseUrl,
    accessToken,
    useOrgChartPrefix,
  ]);

  const reset = useCallback(() => {
    fetchGenerationRef.current += 1;
    setData(null);
    setError(null);
    setIsLoading(false);
    setOrgChartEsTransportError(false);
    setFirstSourceRequested(null);
    setFirstSourceUsed(null);
    setFallbackApplied(false);
    setFallbackReason(null);
    setApolloTotalCount(null);
    setApolloQueued(false);
    setApolloQueueRequestId(null);
  }, []);

  return {
    data,
    isLoading,
    error,
    orgChartEsTransportError,
    firstSourceRequested,
    firstSourceUsed,
    fallbackApplied,
    fallbackReason,
    apolloTotalCount,
    apolloQueued,
    apolloQueueRequestId,
    fetchOrgChart,
    reset,
  };
};
