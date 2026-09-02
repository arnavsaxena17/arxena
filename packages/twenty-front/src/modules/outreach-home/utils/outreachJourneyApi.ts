import axios from 'axios';

import {
  type CandidateOutreachJourney,
  type OutreachProjectJourneySummary,
} from '@/outreach-home/types/outreach-journey.types';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

const outreachJourneyHeaders = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
});

export const fetchCandidateOutreachJourney = async ({
  projectId,
  candidateId,
  accessToken,
}: {
  projectId: string;
  candidateId: string;
  accessToken: string;
}): Promise<CandidateOutreachJourney> => {
  const response = await axios.get<CandidateOutreachJourney>(
    `${REACT_APP_SERVER_BASE_URL}/outreach-command/projects/${projectId}/candidates/${candidateId}/journey`,
    { headers: outreachJourneyHeaders(accessToken) },
  );

  return response.data;
};

export const fetchOutreachProjectJourneySummary = async ({
  projectId,
  accessToken,
}: {
  projectId: string;
  accessToken: string;
}): Promise<OutreachProjectJourneySummary> => {
  const response = await axios.get<OutreachProjectJourneySummary>(
    `${REACT_APP_SERVER_BASE_URL}/outreach-command/projects/${projectId}/journey-summary`,
    { headers: outreachJourneyHeaders(accessToken) },
  );

  return response.data;
};

export const pauseCandidateOutreachJourney = async ({
  projectId,
  candidateId,
  accessToken,
}: {
  projectId: string;
  candidateId: string;
  accessToken: string;
}): Promise<{ pausedSteps: number }> => {
  const response = await axios.post<{ pausedSteps: number }>(
    `${REACT_APP_SERVER_BASE_URL}/outreach-command/projects/${projectId}/candidates/${candidateId}/pause`,
    {},
    { headers: outreachJourneyHeaders(accessToken) },
  );

  return response.data;
};

export const resumeCandidateOutreachJourney = async ({
  projectId,
  candidateId,
  accessToken,
}: {
  projectId: string;
  candidateId: string;
  accessToken: string;
}): Promise<{ resumedSteps: number; kickedIdleRuns: number }> => {
  const response = await axios.post<{
    resumedSteps: number;
    kickedIdleRuns: number;
  }>(
    `${REACT_APP_SERVER_BASE_URL}/outreach-command/projects/${projectId}/candidates/${candidateId}/resume`,
    {},
    { headers: outreachJourneyHeaders(accessToken) },
  );

  return response.data;
};

export const snoozeCandidateOutreachJourney = async ({
  projectId,
  candidateId,
  resumeAt,
  accessToken,
}: {
  projectId: string;
  candidateId: string;
  resumeAt: string;
  accessToken: string;
}): Promise<{ updatedRuns: number }> => {
  const response = await axios.post<{ updatedRuns: number }>(
    `${REACT_APP_SERVER_BASE_URL}/outreach-command/projects/${projectId}/candidates/${candidateId}/snooze`,
    { resumeAt },
    { headers: outreachJourneyHeaders(accessToken) },
  );

  return response.data;
};

export const skipCandidateOutreachDelayStep = async ({
  projectId,
  candidateId,
  workflowRunId,
  stepId,
  accessToken,
}: {
  projectId: string;
  candidateId: string;
  workflowRunId: string;
  stepId: string;
  accessToken: string;
}): Promise<{ ok: boolean }> => {
  const response = await axios.post<{ ok: boolean }>(
    `${REACT_APP_SERVER_BASE_URL}/outreach-command/projects/${projectId}/candidates/${candidateId}/skip-step`,
    { workflowRunId, stepId },
    { headers: outreachJourneyHeaders(accessToken) },
  );

  return response.data;
};

export const approveCandidateOutreachFormStep = async ({
  projectId,
  candidateId,
  workflowRunId,
  stepId,
  response,
  accessToken,
}: {
  projectId: string;
  candidateId: string;
  workflowRunId: string;
  stepId: string;
  response: object;
  accessToken: string;
}): Promise<{ ok: boolean }> => {
  const apiResponse = await axios.post<{ ok: boolean }>(
    `${REACT_APP_SERVER_BASE_URL}/outreach-command/projects/${projectId}/candidates/${candidateId}/approve-form`,
    { workflowRunId, stepId, response },
    { headers: outreachJourneyHeaders(accessToken) },
  );

  return apiResponse.data;
};
