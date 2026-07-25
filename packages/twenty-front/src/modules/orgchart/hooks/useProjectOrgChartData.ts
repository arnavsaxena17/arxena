import { useCallback, useState } from 'react';

type UseJobOrgChartDataParams = {
  projectId?: string;
  jobName?: string;
};

type UseJobOrgChartDataOptions = {
  baseUrl: string;
  accessToken?: string;
};

type UseJobOrgChartDataResult = {
  data: Record<string, unknown> | null;
  isLoading: boolean;
  error: string | null;
  fetchOrgChart: () => Promise<void>;
};

export const useProjectOrgChartData = (
  params: UseJobOrgChartDataParams,
  options: UseJobOrgChartDataOptions,
): UseJobOrgChartDataResult => {
  const { projectId, jobName } = params;
  const { baseUrl, accessToken } = options;

  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrgChart = useCallback(async () => {
    if (!projectId) {
      return;
    }

    const trimmedBaseUrl = baseUrl.replace(/\/$/, '');
    if (!trimmedBaseUrl) {
      setError('Server URL is not configured');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${trimmedBaseUrl}/org-chart/from-job`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({
            projectId,
            jobName,
          }),
        },
      );

      const json = (await response.json()) as Record<string, unknown>;

      if (!response.ok) {
        const message =
          (json && typeof json.message === 'string' && json.message) ||
          (typeof json.error === 'string' && json.error) ||
          `Request failed with status ${response.status}`;
        throw new Error(message);
      }

      setData(json);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      const message =
        err instanceof Error ? err.message : 'Failed to fetch job org chart';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, jobName, baseUrl, accessToken]);

  return {
    data,
    isLoading,
    error,
    fetchOrgChart,
  };
};
