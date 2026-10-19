import { type OutreachDraftTemplateKey } from 'twenty-shared/arx';
import { type WorkflowEmailFiles } from 'twenty-shared/workflow';

import {
  readErrorMessage,
  requireAccessToken,
  requireBaseUrl,
} from '@/outreach-home/utils/outreach-sender-profile-api';

export type OutreachDraftSettings = {
  templates: Record<OutreachDraftTemplateKey, string>;
  attachments: Partial<Record<OutreachDraftTemplateKey, WorkflowEmailFiles>>;
  senderName: string;
  senderWebsite: string;
};

const request = async (input: {
  accessToken: string | undefined;
  method: 'GET' | 'PUT';
  body?: unknown;
  failureMessage: string;
}): Promise<OutreachDraftSettings> => {
  const accessToken = requireAccessToken(input.accessToken);
  const response = await fetch(
    `${requireBaseUrl()}/outreach-command/draft-templates`,
    {
      method: input.method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
    },
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, input.failureMessage));
  }

  return (await response.json()) as OutreachDraftSettings;
};

export const fetchOutreachDraftSettings = (accessToken: string | undefined) =>
  request({
    accessToken,
    method: 'GET',
    failureMessage: 'Failed to load draft messages.',
  });

export const saveOutreachDraftSettings = (input: {
  accessToken: string | undefined;
  templates?: Partial<Record<OutreachDraftTemplateKey, string>>;
  attachments?: Partial<Record<OutreachDraftTemplateKey, WorkflowEmailFiles>>;
}) =>
  request({
    accessToken: input.accessToken,
    method: 'PUT',
    body: { templates: input.templates, attachments: input.attachments },
    failureMessage: 'Failed to save draft messages.',
  });
