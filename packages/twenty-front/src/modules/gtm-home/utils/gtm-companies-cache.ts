import { REACT_APP_SERVER_BASE_URL } from '~/config';

import { type GtmCompanyRow } from '@/gtm-home/types/gtm-home.types';

const getBaseUrl = (): string => REACT_APP_SERVER_BASE_URL ?? '';

export const fetchGtmCompaniesCache = async (
  projectId: string | undefined,
  accessToken: string | undefined,
): Promise<GtmCompanyRow[]> => {
  if (!projectId || projectId === 'project-id' || !accessToken) {
    return [];
  }

  const baseUrl = getBaseUrl();

  if (!baseUrl) {
    return [];
  }

  try {
    const response = await fetch(
      `${baseUrl}/gtm-command/cache/companies?projectId=${encodeURIComponent(projectId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = (await response.json()) as {
      companies?: GtmCompanyRow[];
    };

    return Array.isArray(data.companies) ? data.companies : [];
  } catch (error) {
    console.error('Failed to fetch GTM companies cache:', error);

    return [];
  }
};

export const persistGtmCompaniesCache = async (
  projectId: string | undefined,
  companies: GtmCompanyRow[],
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
    const response = await fetch(`${baseUrl}/gtm-command/cache/companies`, {
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
