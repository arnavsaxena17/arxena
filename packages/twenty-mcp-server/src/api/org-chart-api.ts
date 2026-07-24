const TIMEOUT_MS = 30_000;

/**
 * Fetch org chart data for a company
 */
export async function fetchOrgChart(
  baseUrl: string,
  apiToken: string,
  companyId: string,
  options?: {
    companyName?: string;
    country?: string;
    functionRoot?: string;
  },
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const params = new URLSearchParams();
    if (options?.companyName) {
      params.set('companyName', options.companyName);
    }
    if (options?.country) {
      params.set('country', options.country);
    }
    if (options?.functionRoot) {
      params.set('functionRoot', options.functionRoot);
    }

    const queryString = params.toString();
    const url = `${baseUrl}/org-chart/${encodeURIComponent(companyId)}${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to fetch org chart: ${response.status} ${text}`);
    }

    const json = (await response.json()) as {
      status?: string;
      result?: Record<string, unknown>;
    };

    if (json?.status === 'ok' && json.result) {
      return json.result;
    }

    throw new Error('Invalid response format from org chart endpoint');
  } finally {
    clearTimeout(timeoutId);
  }
}
