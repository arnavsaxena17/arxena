import { NextRequest, NextResponse } from 'next/server';
import { isValidPhoneNumber } from 'libphonenumber-js';
import {
  isAllowedEmailForNewWorkspaceSignup,
  WORK_EMAIL_REQUIRED_MESSAGE,
} from 'twenty-shared/utils';

import {
  FreeTrialLeadPayload,
  FreeTrialOrgChartContext,
  FreeTrialSource,
} from '@/lib/free-trial-types';
import {
  SubmitFreeTrialLeadError,
  submitFreeTrialLeadToServer,
} from '@/lib/submit-free-trial-lead-to-server';

export const dynamic = 'force-dynamic';

const FREE_TRIAL_SOURCES: FreeTrialSource[] = [
  'homepage_hero',
  'header',
  'header_mobile',
  'org_chart_banner',
  'org_chart_node_modal',
];

const isFreeTrialSource = (value: string): value is FreeTrialSource =>
  FREE_TRIAL_SOURCES.includes(value as FreeTrialSource);

const parseOrgChartContext = (
  value: unknown,
): FreeTrialOrgChartContext | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  return {
    companyName:
      typeof record.companyName === 'string'
        ? record.companyName.trim()
        : undefined,
    selectedCountry:
      typeof record.selectedCountry === 'string'
        ? record.selectedCountry.trim()
        : undefined,
    selectedFunctionRoot:
      typeof record.selectedFunctionRoot === 'string'
        ? record.selectedFunctionRoot.trim()
        : undefined,
    nodeHeadline:
      typeof record.nodeHeadline === 'string'
        ? record.nodeHeadline.trim()
        : undefined,
  };
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<FreeTrialLeadPayload>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const company = typeof body.company === 'string' ? body.company.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const source =
      typeof body.source === 'string' && isFreeTrialSource(body.source)
        ? body.source
        : null;

    if (!name) {
      return NextResponse.json(
        { message: 'Name is required.' },
        { status: 400 },
      );
    }
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
    if (!phone) {
      return NextResponse.json(
        { message: 'Phone number is required.' },
        { status: 400 },
      );
    }
    if (!isValidPhoneNumber(phone)) {
      return NextResponse.json(
        { message: 'Please enter a valid phone number.' },
        { status: 400 },
      );
    }
    if (!company) {
      return NextResponse.json(
        { message: 'Company name is required.' },
        { status: 400 },
      );
    }
    if (!source) {
      return NextResponse.json({ message: 'Invalid source.' }, { status: 400 });
    }

    const lead: FreeTrialLeadPayload = {
      name,
      email,
      company,
      phone,
      source,
      orgChartContext: parseOrgChartContext(body.orgChartContext),
    };

    const { emailSent } = await submitFreeTrialLeadToServer(lead);

    console.info('Free trial lead captured', {
      source: lead.source,
      email: lead.email,
      emailSent,
    });

    return NextResponse.json({ success: true, emailSent });
  } catch (error) {
    if (error instanceof SubmitFreeTrialLeadError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.statusCode >= 400 ? error.statusCode : 500 },
      );
    }

    console.error('Free trial lead submission failed', error);

    return NextResponse.json(
      { message: 'Unable to submit your request. Please try again.' },
      { status: 500 },
    );
  }
}
