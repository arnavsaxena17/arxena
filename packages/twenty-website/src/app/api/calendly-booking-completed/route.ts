import { NextRequest, NextResponse } from 'next/server';
import {
  isAllowedEmailForNewWorkspaceSignup,
  WORK_EMAIL_REQUIRED_MESSAGE,
} from 'twenty-shared/utils';

import {
  SubmitCalendlyBookingError,
  submitCalendlyBookingToServer,
} from '@/lib/submit-calendly-booking-to-server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : undefined;
    const company =
      typeof body.company === 'string' ? body.company.trim() : undefined;
    const scheduledAt =
      typeof body.scheduledAt === 'string' ? body.scheduledAt : undefined;
    const calendlyEventUri =
      typeof body.calendlyEventUri === 'string'
        ? body.calendlyEventUri
        : undefined;
    const calendlyInviteeUri =
      typeof body.calendlyInviteeUri === 'string'
        ? body.calendlyInviteeUri
        : undefined;
    const calendlyPayload =
      body.calendlyPayload && typeof body.calendlyPayload === 'object'
        ? (body.calendlyPayload as {
            event?: { uri?: string };
            invitee?: { uri?: string };
          })
        : undefined;

    if (!email) {
      return NextResponse.json(
        { message: 'Email is required.' },
        { status: 400 },
      );
    }

    if (!isAllowedEmailForNewWorkspaceSignup(email)) {
      return NextResponse.json(
        { message: WORK_EMAIL_REQUIRED_MESSAGE },
        { status: 400 },
      );
    }

    const result = await submitCalendlyBookingToServer({
      email,
      name,
      company,
      scheduledAt,
      calendlyEventUri,
      calendlyInviteeUri,
      calendlyPayload,
    });

    console.info('Calendly booking captured', {
      email,
      opportunityId: result.opportunityId,
      meetingScheduledAt: result.meetingScheduledAt,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof SubmitCalendlyBookingError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.statusCode >= 400 ? error.statusCode : 500 },
      );
    }

    console.error('Calendly booking submission failed', error);

    return NextResponse.json(
      { message: 'Unable to confirm your booking. Please try again.' },
      { status: 500 },
    );
  }
}
