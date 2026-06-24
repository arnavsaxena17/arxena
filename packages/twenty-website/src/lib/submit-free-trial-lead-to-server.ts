import { ORG_CHART_PDL_PROXY_HEADER } from 'twenty-shared';

import { FreeTrialLeadPayload } from '@/lib/free-trial-types';
import { getServerBaseUrl } from '@/lib/get-server-base-url';

export class SubmitFreeTrialLeadError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'SubmitFreeTrialLeadError';
    this.statusCode = statusCode;
  }
}

export const submitFreeTrialLeadToServer = async (
  lead: FreeTrialLeadPayload,
): Promise<{ emailSent: boolean }> => {
  const secret = process.env.ORG_CHART_PDL_PROXY_SECRET?.trim();

  if (!secret) {
    console.error(
      'ORG_CHART_PDL_PROXY_SECRET is not configured on twenty-website',
    );
    throw new SubmitFreeTrialLeadError(
      'Lead submission is not configured. Please try again later.',
      500,
    );
  }

  const serverBaseUrl = getServerBaseUrl();
  const response = await fetch(`${serverBaseUrl}/website/free-trial-lead`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [ORG_CHART_PDL_PROXY_HEADER]: secret,
    },
    body: JSON.stringify(lead),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    const message =
      body?.message ??
      (response.status === 401
        ? 'Lead submission is not authorized.'
        : 'Unable to submit your request. Please try again.');

    throw new SubmitFreeTrialLeadError(message, response.status);
  }

  const result = (await response.json()) as { emailSent?: boolean };

  return { emailSent: result.emailSent === true };
};
