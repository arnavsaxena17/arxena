import axios from 'axios';

import {
  type OutreachTableFilter,
  type OutreachTableTab,
  type OutreachTableView,
} from '@/outreach-home/constants/outreach-cache-realtime.constants';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

// The filters and sort the agent applied to this project's table.
export const fetchOutreachTableView = async (
  projectId: string,
  tab: OutreachTableTab,
  accessToken: string,
): Promise<OutreachTableView | null> => {
  try {
    const response = await axios.get<{ view: OutreachTableView | null }>(
      `${REACT_APP_SERVER_BASE_URL}/outreach-command/table-view`,
      {
        params: { projectId, tab },
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    return response.data.view ?? null;
  } catch {
    return null;
  }
};

const OPERATOR_LABELS: Record<string, string> = {
  contains: 'contains',
  notContains: 'does not contain',
  equals: '=',
  empty: 'is empty',
  notEmpty: 'is not empty',
  greaterThan: '>',
  greaterThanOrEqual: '≥',
  lessThan: '<',
  lessThanOrEqual: '≤',
};

export const describeOutreachTableFilter = (
  filter: OutreachTableFilter,
  label: string,
): string => {
  if (filter.kind === 'values') {
    return `${label}: ${filter.values.join(', ')}`;
  }

  return filter.operator === 'empty' || filter.operator === 'notEmpty'
    ? `${label} ${OPERATOR_LABELS[filter.operator]}`
    : `${label} ${OPERATOR_LABELS[filter.operator]} ${filter.value}`;
};

const dismissedKey = (projectId: string, tab: OutreachTableTab) =>
  `outreach-ai-view-dismissed:${projectId}:${tab}`;

export const readDismissedOutreachTableView = (
  projectId: string,
  tab: OutreachTableTab,
): string | null => {
  try {
    return localStorage.getItem(dismissedKey(projectId, tab));
  } catch {
    return null;
  }
};

export const writeDismissedOutreachTableView = (
  projectId: string,
  tab: OutreachTableTab,
  updatedAt: string,
) => {
  try {
    localStorage.setItem(dismissedKey(projectId, tab), updatedAt);
  } catch {
    // storage unavailable: the view just reappears after a reload
  }
};
