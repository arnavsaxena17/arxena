import { HttpException, HttpStatus } from '@nestjs/common';

import { UnipileLinkedinAccountUnusableError } from '../errors/unipile-linkedin-account-unusable.error';
import { isUnipileDisconnectedAccountApiError } from './unipile-disconnected-account.util';

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

const isAccountNotFoundHttpResponse = (status: number, response: unknown): boolean => {
  if (status !== HttpStatus.NOT_FOUND) {
    return false;
  }

  const message = responseToMessage(response).toLowerCase();
  return (
    message.includes('account') &&
    (message.includes('not found') ||
      message.includes('does not exist') ||
      message.includes('unknown account'))
  );
};

const isLinkedinSearchAccountFailureMessage = (message: string): boolean => {
  const normalized = message.toLowerCase();
  if (!normalized.includes('linkedin search failed')) {
    return false;
  }

  return (
    normalized.includes('disconnected') ||
    normalized.includes('disconnected_account') ||
    normalized.includes('invalid account') ||
    normalized.includes('account not found') ||
    normalized.includes('unknown account')
  );
};

export const isUnipileLinkedinAccountUnusableError = (error: unknown): boolean => {
  if (error instanceof UnipileLinkedinAccountUnusableError) {
    return true;
  }

  if (error instanceof HttpException) {
    const status = error.getStatus();
    const response = error.getResponse();

    if (status === HttpStatus.UNAUTHORIZED) {
      return isUnipileDisconnectedAccountApiError(
        status,
        typeof response === 'object' && response !== null ? response : {},
      );
    }

    if (isAccountNotFoundHttpResponse(status, response)) {
      return true;
    }
  }

  if (error instanceof Error) {
    return isLinkedinSearchAccountFailureMessage(error.message);
  }

  return false;
};
