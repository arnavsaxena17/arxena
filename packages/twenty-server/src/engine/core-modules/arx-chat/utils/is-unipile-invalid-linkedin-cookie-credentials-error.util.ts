import { HttpException, HttpStatus } from '@nestjs/common';

const INVALID_LINKEDIN_COOKIE_CREDENTIALS_TYPE =
  'errors/invalid_credentials';

const responseToMessage = (response: unknown): string => {
  if (typeof response === 'string') {
    return response;
  }

  if (response && typeof response === 'object') {
    const record = response as { detail?: string; message?: string; title?: string };
    return [record.title, record.detail, record.message].filter(Boolean).join(' ');
  }

  return '';
};

const isInvalidCredentialsMessage = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('invalid_credentials') ||
    normalized.includes('invalid credentials') ||
    (normalized.includes('credential') && normalized.includes('invalid'))
  );
};

/**
 * True when Unipile POST /accounts rejected LinkedIn session cookies (li_at / li_a).
 * Distinct from errors/disconnected_account (existing Unipile account session died).
 */
export const isUnipileInvalidLinkedinCookieCredentialsError = (
  error: unknown,
): boolean => {
  if (!(error instanceof HttpException)) {
    return false;
  }

  if (error.getStatus() !== HttpStatus.UNAUTHORIZED) {
    return false;
  }

  const response = error.getResponse();

  if (typeof response === 'object' && response !== null) {
    const type = (response as { type?: string }).type;
    if (type === INVALID_LINKEDIN_COOKIE_CREDENTIALS_TYPE) {
      return true;
    }
  }

  return isInvalidCredentialsMessage(responseToMessage(response));
};
