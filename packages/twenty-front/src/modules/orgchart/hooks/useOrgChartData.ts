import { useCallback, useState } from 'react';
import { useRecoilValue } from 'recoil';

import { tokenPairState } from '@/auth/states/tokenPairState';

type OrgChartCompanyInput = {
  companyId: string | null;
  companyName?: string;
  website?: string;
  country?: string;
  functionRoot?: string;
};

export const useOrgChartData = (company: OrgChartCompanyInput | null) => {
  const tokenPair = useRecoilValue(tokenPairState);
  const accessToken = tokenPair?.accessToken?.token ?? undefined;

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
      const baseUrl = process.env.REACT_APP_SERVER_BASE_URL ?? '';
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
      const url = `${baseUrl}/org-chart/${encodeURIComponent(companyId)}${
        queryString ? `?${queryString}` : ''
      }`;

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
  }, [companyId, companyName, website, country, functionRoot, accessToken]);

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
