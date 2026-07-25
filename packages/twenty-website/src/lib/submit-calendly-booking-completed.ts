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

export const submitCalendlyBookingCompleted = async (
  payload: CalendlyBookingCompletedPayload,
): Promise<{ opportunityId?: string; meetingScheduledAt?: string }> => {
  const response = await fetch('/api/calendly-booking-completed', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;

    throw new Error(
      body?.message ?? 'Unable to confirm your booking. Please try again.',
    );
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
