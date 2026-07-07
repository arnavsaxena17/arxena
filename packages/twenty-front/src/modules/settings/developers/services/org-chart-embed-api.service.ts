import { OrgChartEmbed } from '@/settings/developers/types/org-chart-embed/OrgChartEmbed';

const getServerBaseUrl = (): string =>
  (process.env.REACT_APP_SERVER_BASE_URL ?? '').replace(/\/$/, '');

export const fetchOrgChartEmbeds = async (
  accessToken: string,
): Promise<OrgChartEmbed[]> => {
  const response = await fetch(`${getServerBaseUrl()}/org-chart/embed`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to load org chart embeds');
  }

  const json = (await response.json()) as {
    status?: string;
    embeds?: OrgChartEmbed[];
  };

  return json.embeds ?? [];
};

export const fetchOrgChartEmbed = async (
  accessToken: string,
  embedKey: string,
): Promise<{ embed: OrgChartEmbed; usageToday: number }> => {
  const response = await fetch(
    `${getServerBaseUrl()}/org-chart/embed/${encodeURIComponent(embedKey)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error('Failed to load org chart embed');
  }

  const json = (await response.json()) as {
    status?: string;
    embed?: OrgChartEmbed;
    usageToday?: number;
  };

  if (!json.embed) {
    throw new Error('Embed not found');
  }

  return {
    embed: json.embed,
    usageToday: json.usageToday ?? 0,
    usageMonthly: (json as { usageMonthly?: number }).usageMonthly ?? 0,
  };
};

export const createOrgChartEmbed = async (
  accessToken: string,
  input: {
    name: string;
    allowedOrigins: string[];
    mode: OrgChartEmbed['mode'];
    companyDomain?: string;
    publishSlug?: string;
    allowedDomains?: string[];
    options?: OrgChartEmbed['options'];
  },
): Promise<OrgChartEmbed> => {
  const response = await fetch(`${getServerBaseUrl()}/org-chart/embed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
  });

  const json = (await response.json()) as {
    status?: string;
    embed?: OrgChartEmbed;
    message?: string | string[];
  };

  if (!response.ok || !json.embed) {
    const message = Array.isArray(json.message)
      ? json.message.join(', ')
      : json.message;
    throw new Error(message || 'Failed to create embed');
  }

  return json.embed;
};

export const updateOrgChartEmbed = async (
  accessToken: string,
  embedKey: string,
  input: Partial<{
    name: string;
    allowedOrigins: string[];
    companyDomain: string;
    publishSlug: string;
    allowedDomains: string[];
    options: OrgChartEmbed['options'];
  }>,
): Promise<OrgChartEmbed> => {
  const response = await fetch(
    `${getServerBaseUrl()}/org-chart/embed/${encodeURIComponent(embedKey)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(input),
    },
  );

  const json = (await response.json()) as {
    status?: string;
    embed?: OrgChartEmbed;
    message?: string | string[];
  };

  if (!response.ok || !json.embed) {
    const message = Array.isArray(json.message)
      ? json.message.join(', ')
      : json.message;
    throw new Error(message || 'Failed to update embed');
  }

  return json.embed;
};

export const revokeOrgChartEmbed = async (
  accessToken: string,
  embedKey: string,
): Promise<void> => {
  const response = await fetch(
    `${getServerBaseUrl()}/org-chart/embed/${encodeURIComponent(embedKey)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error('Failed to revoke embed');
  }
};
