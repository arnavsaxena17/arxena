import { REACT_APP_SERVER_BASE_URL } from '~/config';

import { type OutreachCompanyRow } from '@/outreach-home/types/outreach-home.types';

const getBaseUrl = (): string => REACT_APP_SERVER_BASE_URL ?? '';

export const fetchOutreachCompaniesCache = async (
  projectId: string | undefined,
  accessToken: string | undefined,
): Promise<OutreachCompanyRow[]> => {
  if (!projectId || projectId === 'project-id' || !accessToken) {
    return [];
  }

  const baseUrl = getBaseUrl();

  if (!baseUrl) {
    return [];
  }

  try {
    const response = await fetch(
      `${baseUrl}/outreach-command/cache/companies?projectId=${encodeURIComponent(projectId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = (await response.json()) as {
      companies?: OutreachCompanyRow[];
    };

    return Array.isArray(data.companies) ? data.companies : [];
  } catch (error) {
    console.error('Failed to fetch GTM companies cache:', error);

    return [];
  }
};

export const persistOutreachCompaniesCache = async (
  projectId: string | undefined,
  companies: OutreachCompanyRow[],
  accessToken: string | undefined,
): Promise<void> => {
  if (!projectId || projectId === 'project-id' || !accessToken) {
    return;
  }

  const baseUrl = getBaseUrl();

  if (!baseUrl) {
    return;
  }

  try {
    const response = await fetch(`${baseUrl}/outreach-command/cache/companies`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ projectId, companies }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }
  } catch (error) {
    console.error('Failed to persist GTM companies cache:', error);
  }
};
