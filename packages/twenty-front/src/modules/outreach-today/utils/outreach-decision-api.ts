import axios from 'axios';

import {
  type OutreachDecisionListItem,
  type OutreachDecisionResolution,
} from '@/outreach-today/types/outreach-decision.types';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

const decisionHeaders = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
});

export const fetchOpenOutreachDecisions = async ({
  accessToken,
  candidateId,
}: {
  accessToken: string;
  candidateId?: string;
}): Promise<OutreachDecisionListItem[]> => {
  const response = await axios.get<OutreachDecisionListItem[]>(
    `${REACT_APP_SERVER_BASE_URL}/outreach-command/decisions`,
    {
      headers: decisionHeaders(accessToken),
      params: {
        status: 'OPEN',
        ...(candidateId ? { candidateId } : {}),
      },
    },
  );

  return response.data;
};

export const resolveOutreachDecision = async ({
  accessToken,
  decisionId,
  resolution,
  editedBody,
}: {
  accessToken: string;
  decisionId: string;
  resolution: OutreachDecisionResolution;
  editedBody?: string;
}): Promise<void> => {
  await axios.post(
    `${REACT_APP_SERVER_BASE_URL}/outreach-command/decisions/${decisionId}/resolve`,
    { resolution, editedBody },
    { headers: decisionHeaders(accessToken) },
  );
};
