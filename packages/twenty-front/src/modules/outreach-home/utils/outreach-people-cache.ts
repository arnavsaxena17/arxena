import { REACT_APP_SERVER_BASE_URL } from '~/config';

import { type OutreachPersonRow } from '@/outreach-home/types/outreach-home.types';

const getBaseUrl = (): string => REACT_APP_SERVER_BASE_URL ?? '';

export const fetchOutreachPeopleCache = async (
  projectId: string | undefined,
  accessToken: string | undefined,
): Promise<OutreachPersonRow[]> => {
  if (!projectId || projectId === 'project-id' || !accessToken) {
    return [];
  }

  const baseUrl = getBaseUrl();

  if (!baseUrl) {
    return [];
  }

  try {
    const response = await fetch(
      `${baseUrl}/outreach-command/cache/people?projectId=${encodeURIComponent(projectId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = (await response.json()) as {
      people?: OutreachPersonRow[];
    };

    return Array.isArray(data.people) ? data.people : [];
  } catch (error) {
    console.error('Failed to fetch GTM people cache:', error);

    return [];
  }
};

export const persistOutreachPeopleCache = async (
  projectId: string | undefined,
  people: OutreachPersonRow[],
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
    const response = await fetch(`${baseUrl}/outreach-command/cache/people`, {
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
