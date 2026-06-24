import {
  ORG_CHART_PDL_PROXY_HEADER,
  PrivacyConsentAction,
  PrivacyConsentCategories,
} from 'twenty-shared';

import { getServerBaseUrl } from '@/lib/get-server-base-url';

export class SubmitPrivacyConsentError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'SubmitPrivacyConsentError';
    this.statusCode = statusCode;
  }
}

export type SubmitPrivacyConsentPayload = {
  visitorId: string;
  action: PrivacyConsentAction;
  policyVersion: string;
  categories: PrivacyConsentCategories;
  locale?: string;
};

export const submitPrivacyConsentToServer = async (
  payload: SubmitPrivacyConsentPayload,
): Promise<void> => {
  const secret = process.env.ORG_CHART_PDL_PROXY_SECRET?.trim();

  if (!secret) {
    console.error(
      'ORG_CHART_PDL_PROXY_SECRET is not configured on twenty-website',
    );
    throw new SubmitPrivacyConsentError(
      'Cookie preferences are not configured. Please try again later.',
      500,
    );
  }

  const serverBaseUrl = getServerBaseUrl();
  const response = await fetch(`${serverBaseUrl}/website/privacy-consent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [ORG_CHART_PDL_PROXY_HEADER]: secret,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    const message =
      body?.message ??
      (response.status === 401
        ? 'Cookie preferences submission is not authorized.'
        : 'Unable to save your cookie preferences. Please try again.');

    throw new SubmitPrivacyConsentError(message, response.status);
  }
};
