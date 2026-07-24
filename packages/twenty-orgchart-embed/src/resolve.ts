export type ArxenaOrgChartInlineInit = {
  embedKey: string;
  domain?: string;
  container?: string | HTMLElement;
  height?: string;
  baseUrl?: string;
  theme?: Record<string, string>;
  onNodeClick?: (node: Record<string, unknown>) => void;
};

export type ArxenaOrgChartInlineResolveResponse = {
  status: string;
  companyId?: string;
  companyName?: string;
  mode?: string;
  result?: Record<string, unknown>;
};

export const fetchEmbedOrgChart = async (
  config: ArxenaOrgChartInlineInit,
  baseUrl: string,
): Promise<ArxenaOrgChartInlineResolveResponse> => {
  const params = new URLSearchParams();
  if (config.domain?.trim()) {
    params.set('domain', config.domain.trim());
  }

  const query = params.toString();
  const url = `${baseUrl.replace(/\/$/, '')}/api/embed/org-chart${query ? `?${query}` : ''}`;

  const response = await fetch(url, {
    headers: {
      'X-Embed-Key': config.embedKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Embed resolve failed (${response.status})`);
  }

  return (await response.json()) as ArxenaOrgChartInlineResolveResponse;
};

export const postEmbedMessage = (
  type: string,
  payload: Record<string, unknown>,
): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.parent.postMessage(
    {
      source: 'arxena-orgchart-embed',
      type,
      ...payload,
    },
    '*',
  );
};
