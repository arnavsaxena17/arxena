import { REACT_APP_SERVER_BASE_URL } from '~/config';

import { type GtmPersonRow } from '@/gtm-home/types/gtm-home.types';

const getBaseUrl = (): string => REACT_APP_SERVER_BASE_URL ?? '';

export const fetchGtmPeopleCache = async (
  projectId: string | undefined,
  accessToken: string | undefined,
): Promise<GtmPersonRow[]> => {
  if (!projectId || projectId === 'project-id' || !accessToken) {
    return [];
  }

  const baseUrl = getBaseUrl();

  if (!baseUrl) {
    return [];
  }

  try {
    const response = await fetch(
      `${baseUrl}/gtm-command/cache/people?projectId=${encodeURIComponent(projectId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = (await response.json()) as {
      people?: GtmPersonRow[];
    };

    return Array.isArray(data.people) ? data.people : [];
  } catch (error) {
    console.error('Failed to fetch GTM people cache:', error);

    return [];
  }
};

export const persistGtmPeopleCache = async (
  projectId: string | undefined,
  people: GtmPersonRow[],
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
    const response = await fetch(`${baseUrl}/gtm-command/cache/people`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ projectId, people }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }
  } catch (error) {
    console.error('Failed to persist GTM people cache:', error);
  }
};
