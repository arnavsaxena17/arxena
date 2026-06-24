import { NextRequest, NextResponse } from 'next/server';
import {
  isValidUuid,
  PRIVACY_CONSENT_ACTIONS,
  PRIVACY_POLICY_VERSION,
  PrivacyConsentAction,
} from 'twenty-shared';

import {
  SubmitPrivacyConsentError,
  submitPrivacyConsentToServer,
} from '@/lib/cookie-consent/submit-privacy-consent-to-server';

export const dynamic = 'force-dynamic';

const isConsentAction = (value: string): value is PrivacyConsentAction =>
  (PRIVACY_CONSENT_ACTIONS as readonly string[]).includes(value);

const parseCategories = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (
    record.necessary !== true ||
    typeof record.analytics !== 'boolean' ||
    typeof record.functional !== 'boolean'
  ) {
    return null;
  }

  return {
    necessary: true as const,
    analytics: record.analytics,
    functional: record.functional,
  };
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const visitorId =
      typeof body.visitorId === 'string' ? body.visitorId.trim() : '';
    const action =
      typeof body.action === 'string' && isConsentAction(body.action)
        ? body.action
        : null;
    const policyVersion =
      typeof body.policyVersion === 'string' && body.policyVersion.trim()
        ? body.policyVersion.trim()
        : PRIVACY_POLICY_VERSION;
    const categories = parseCategories(body.categories);
    const locale =
      typeof body.locale === 'string' ? body.locale.trim() : undefined;

    if (!visitorId || !isValidUuid(visitorId)) {
      return NextResponse.json(
        { message: 'Invalid visitorId.' },
        { status: 400 },
      );
    }

    if (!action || !categories) {
      return NextResponse.json(
        { message: 'Invalid cookie consent payload.' },
        { status: 400 },
      );
    }

    await submitPrivacyConsentToServer({
      visitorId,
      action,
      policyVersion,
      categories,
      locale,
    });

    console.info('Cookie consent captured', {
      visitorId,
      action,
      analytics: categories.analytics,
      functional: categories.functional,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof SubmitPrivacyConsentError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.statusCode >= 400 ? error.statusCode : 500 },
      );
    }

    console.error('Cookie consent submission failed', error);

    return NextResponse.json(
      { message: 'Unable to save your cookie preferences. Please try again.' },
      { status: 500 },
    );
  }
}
