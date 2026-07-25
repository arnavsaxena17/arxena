import { ORG_CHART_PDL_PROXY_HEADER } from 'twenty-shared/constants';

import { getServerBaseUrl } from '@/lib/get-server-base-url';

export type CalendlyScheduledPayload = {
  event?: {
    uri?: string;
  };
  invitee?: {
    uri?: string;
  };
};

export type CalendlyBookingCompletedPayload = {
  email: string;
  name?: string;
  company?: string;
  scheduledAt?: string;
  calendlyEventUri?: string;
  calendlyInviteeUri?: string;
  calendlyPayload?: CalendlyScheduledPayload;
};

export class SubmitCalendlyBookingError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'SubmitCalendlyBookingError';
    this.statusCode = statusCode;
  }
}

export const submitCalendlyBookingToServer = async (
  payload: CalendlyBookingCompletedPayload,
): Promise<{ opportunityId?: string; meetingScheduledAt?: string }> => {
  const secret = process.env.ORG_CHART_PDL_PROXY_SECRET?.trim();

  if (!secret) {
    console.error(
      'ORG_CHART_PDL_PROXY_SECRET is not configured on twenty-website',
    );
    throw new SubmitCalendlyBookingError(
      'Booking confirmation is not configured. Please try again later.',
      500,
    );
  }

  const serverBaseUrl = getServerBaseUrl();
  const response = await fetch(
    `${serverBaseUrl}/website/calendly-booking-completed`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [ORG_CHART_PDL_PROXY_HEADER]: secret,
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    const message =
      body?.message ??
      (response.status === 401
        ? 'Booking confirmation is not authorized.'
        : 'Unable to confirm your booking. Please try again.');

    throw new SubmitCalendlyBookingError(message, response.status);
  }

  const result = (await response.json()) as {
    opportunityId?: string;
    meetingScheduledAt?: string;
  };

  return {
    opportunityId: result.opportunityId,
    meetingScheduledAt: result.meetingScheduledAt,
  };
};
